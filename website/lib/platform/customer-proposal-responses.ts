/**
 * Customer proposal response — Request Changes and Accept.
 *
 * The write-side sibling of the read-only `CustomerProposalService`, kept as a
 * separate service so that module's documented single-fact, read-only seam
 * stays intact (the lesson of PR #43's IDOR). This module owns both customer
 * response actions and nothing else.
 *
 * Four rules do the work, all from the accepted Customer Proposal Response ADR
 * (docs/decisions/2026-10-06-customer-proposal-response.md):
 *
 * 1. **Append-only history is the source of truth.** A response row is written
 *    once and never edited or deleted; a version's standing (open / changes
 *    requested / accepted) is always derived from those rows, never stored.
 * 2. **Every response is bound to the exact current published version.** The
 *    customer submits the visible version number; the server re-derives the
 *    current version under the shared publication predicate *inside the same
 *    transaction that writes*, and a mismatch rejects the whole submission —
 *    no silent rebinding, no partial record.
 * 3. **The rule table holds server-side.** Request Changes is allowed while a
 *    version is open or already has changes requested; Accept is allowed only
 *    while the version is open; an accepted version is terminal.
 * 4. **Authorization runs inside the service, on every call**, through the
 *    existing `requireProjectAccess` path, and Accept additionally requires the
 *    existing organization Owner/Admin role. The `founder` capability is never
 *    consulted — this is the customer path.
 *
 * Audit events (`proposal_response.accepted` / `proposal_response.changes_requested`)
 * are appended in the same transaction as the row, carrying identifiers only —
 * never the customer's message.
 */

import { requireProjectAccess, type OrganizationContext } from "./authorization";
import type { Clock } from "./clock";
import {
  isProposalResponseAction,
  type ProjectId,
  type ProposalResponseAction,
  type ProposalResponseInternal,
} from "./domain";
import {
  ForbiddenError,
  NotFoundError,
  ProposalNotAcceptableError,
  ProposalUpdatedError,
  ProposalVersionAcceptedError,
  ValidationError,
} from "./errors";
import type { PlatformStore } from "./ports";
import {
  toCustomerProposalResponseStanding,
  type CustomerProposalResponseStanding,
  type CustomerProposalResponseState,
} from "./views";

/** Maximum request-for-changes message length, after trimming. */
export const MAX_RESPONSE_MESSAGE_LENGTH = 5000;

/** Longest accepted idempotency key, in characters. */
const MAX_ACTION_KEY_LENGTH = 128;

export interface CustomerProposalResponseServiceOptions {
  store: PlatformStore;
  clock: Clock;
  newId: () => string;
}

export interface SubmitProposalResponseInput {
  personId: string;
  projectId: ProjectId;
  /** Raw `intent`/action from the form. Validated here, never trusted. */
  action: unknown;
  /** Raw version number the customer was shown. Never used as an identifier. */
  versionNumber: unknown;
  /** Raw request-for-changes message. Null for an acceptance. */
  message?: unknown;
  /** Raw idempotency key rendered into the form. Required. */
  actionKey: unknown;
}

/** What a successful submission (or an idempotent replay) returns. */
export interface SubmittedProposalResponse {
  action: ProposalResponseAction;
  versionNumber: number;
  createdAt: number;
}

export class CustomerProposalResponseService {
  constructor(private readonly options: CustomerProposalResponseServiceOptions) {}

  /**
   * Records one explicit customer response against the current published
   * version, or rejects it and writes nothing.
   *
   * Everything the ADR requires to be atomic shares one `transaction()`:
   * authorization, current-version derivation, the stale-version check, the
   * rule table, idempotency, the response row, and the audit event. The
   * transaction takes the store's write lock before the first read, so a
   * concurrent publication cannot slip a stale response through and two
   * concurrent submissions cannot both create an acceptance.
   */
  submit(input: SubmitProposalResponseInput): SubmittedProposalResponse {
    // Input shape is validated before any persistence is possible: a
    // non-string message, an empty or oversized message, a malformed version
    // number, or a missing action key never reaches the transaction.
    const action = this.parseAction(input.action);
    const versionNumber = this.parseVersionNumber(input.versionNumber);
    const actionKey = this.parseActionKey(input.actionKey);
    const message =
      action === "changes_requested"
        ? this.parseMessage(input.message)
        : this.parseAbsentMessage(input.message);

    return this.options.store.transaction((store) => {
      // 1. Authorization runs inside the service against the live access rows.
      //    A caller-supplied project id is never proof of access — the PR #43
      //    IDOR regression, restated for this service.
      const { context, project } = requireProjectAccess(
        store,
        input.personId,
        input.projectId,
      );
      if (action === "accepted") {
        this.requireOwnerOrAdmin(context);
      }

      // 2. Idempotency. A replay of an already-recorded submission resolves to
      //    that recorded result and writes no second row and no second audit
      //    event — checked before the response rules so a double-submitted
      //    acceptance reads as the already-recorded success rather than as a
      //    fresh attempt against a version that is now accepted.
      const replayed = store.findProposalResponseByKey(actionKey);
      if (replayed) {
        const matches =
          replayed.personId === input.personId &&
          replayed.projectId === project.id &&
          replayed.action === action &&
          replayed.versionNumber === versionNumber;
        if (!matches) {
          throw new ValidationError(
            "That submission could not be recognised. Reload the page and try again.",
          );
        }
        return {
          action: replayed.action,
          versionNumber: replayed.versionNumber,
          createdAt: replayed.createdAt,
        };
      }

      // 3. Re-derive the current published version inside the writing
      //    transaction, under the one shared publication predicate. A draft can
      //    never be selected, and a version marked published without an instant
      //    is treated as not published.
      const version = store.findCurrentPublishedProposalVersion(project.id);
      if (!version || version.publishedAt === null) {
        throw new NotFoundError("This project does not have a proposal to respond to.");
      }

      // 4. Stale-version rule: the submitted number is the version the customer
      //    was shown, and nothing else. Reject and write nothing — no silent
      //    rebinding to a newer version, no acceptance of a superseded one.
      if (version.versionNumber !== versionNumber) {
        throw new ProposalUpdatedError();
      }

      // 5. The rule table, derived from this version's history alone.
      this.evaluateRules(store, project.id, version.id, action);

      // 6. Write the immutable response row.
      const now = this.options.clock.now();
      const recorded = store.createProposalResponse({
        id: this.options.newId(),
        personId: input.personId,
        organizationId: project.organizationId,
        projectId: project.id,
        proposalId: version.proposalId,
        proposalVersionId: version.id,
        versionNumber: version.versionNumber,
        action,
        message,
        actionKey,
        createdAt: now,
      });

      // 7. The audit event, same transaction: neither layer can exist without
      //    the other. Metadata is identifiers only — never the message, never
      //    proposal content.
      store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: project.organizationId,
        personId: input.personId,
        projectId: project.id,
        type:
          action === "accepted"
            ? "proposal_response.accepted"
            : "proposal_response.changes_requested",
        occurredAt: now,
        metadata: {
          proposalId: version.proposalId,
          proposalVersionId: version.id,
          versionNumber: version.versionNumber,
          action,
        },
      });

      return {
        action: recorded.action,
        versionNumber: recorded.versionNumber,
        createdAt: recorded.createdAt,
      };
    });
  }

  /**
   * Reads the standing of the current published version for a project the
   * caller may access, or null when there is no published version — the same
   * empty result whether there is no proposal at all or only drafts.
   *
   * A non-mutating read: it writes nothing and creates no audit event, exactly
   * like the proposal read beside it. Authorization runs here against the live
   * access rows, so this method is safe to call with any project id.
   */
  readStandingByProjectId(
    personId: string,
    projectId: ProjectId,
  ): CustomerProposalResponseStanding | null {
    const { context, project } = requireProjectAccess(
      this.options.store,
      personId,
      projectId,
    );
    const version = this.options.store.findCurrentPublishedProposalVersion(project.id);
    if (!version || version.publishedAt === null) {
      return null;
    }
    const responses = this.options.store
      .listProposalResponses(project.id)
      .filter((response) => response.proposalVersionId === version.id);
    const state = deriveResponseState(responses);
    return toCustomerProposalResponseStanding({
      versionNumber: version.versionNumber,
      state,
      canAccept: context.isAdministrator && state === "open",
    });
  }

  /**
   * The rule table for one version, evaluated from its history.
   *
   * Request Changes: allowed while the version is open or already has changes
   * requested; rejected once accepted. Accept: allowed only while the version
   * is open — a version with a change request can no longer be accepted, and
   * an accepted version is terminal for every action.
   */
  private evaluateRules(
    store: PlatformStore,
    projectId: ProjectId,
    proposalVersionId: string,
    action: ProposalResponseAction,
  ): void {
    const responses = store
      .listProposalResponses(projectId)
      .filter((response) => response.proposalVersionId === proposalVersionId);
    const isAccepted = responses.some((response) => response.action === "accepted");

    if (action === "accepted") {
      if (isAccepted) {
        throw new ProposalVersionAcceptedError();
      }
      if (responses.length > 0) {
        throw new ProposalNotAcceptableError();
      }
      return;
    }
    if (isAccepted) {
      throw new ProposalVersionAcceptedError();
    }
  }

  /** Acceptance is the organization's commercial decision: Owner/Admin only. */
  private requireOwnerOrAdmin(context: OrganizationContext): void {
    if (!context.isAdministrator) {
      throw new ForbiddenError("Only an organization owner or admin can accept a proposal.");
    }
  }

  private parseAction(raw: unknown): ProposalResponseAction {
    if (!isProposalResponseAction(raw)) {
      throw new ValidationError("That proposal response action is not recognised.");
    }
    return raw;
  }

  /**
   * The submitted version number is the version the customer was shown — a
   * plain positive integer, never an identifier and never proof of access.
   */
  private parseVersionNumber(raw: unknown): number {
    const text =
      typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw : null;
    if (text === null || !/^\d+$/.test(text)) {
      throw new ValidationError("That proposal version is not recognised.");
    }
    const parsed = Number(text);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new ValidationError("That proposal version is not recognised.");
    }
    return parsed;
  }

  /** Required for every submission, so a retry resolves to one recorded row. */
  private parseActionKey(raw: unknown): string {
    if (typeof raw !== "string") {
      throw new ValidationError("That submission could not be verified. Reload the page and try again.");
    }
    const key = raw.trim();
    if (key.length === 0 || key.length > MAX_ACTION_KEY_LENGTH) {
      throw new ValidationError("That submission could not be verified. Reload the page and try again.");
    }
    return key;
  }

  /**
   * The request-for-changes message: a string, non-empty once trimmed, and at
   * most 5,000 characters after trimming. Rejected before persistence, so a
   * partial or oversized record is never written. JavaScript's `trim` also
   * covers Unicode whitespace the SQL expression does not reach; the table's
   * CHECK constraint is the second line of defence for any write that reaches
   * the store by another path.
   */
  private parseMessage(raw: unknown): string {
    if (typeof raw !== "string") {
      throw new ValidationError("Add a short description of the changes you need.");
    }
    const message = raw.trim();
    if (message.length === 0) {
      throw new ValidationError("Add a short description of the changes you need.");
    }
    if (message.length > MAX_RESPONSE_MESSAGE_LENGTH) {
      throw new ValidationError(
        `Keep your change request under ${MAX_RESPONSE_MESSAGE_LENGTH} characters.`,
      );
    }
    return message;
  }

  /** An acceptance carries no message at all — the table's CHECK enforces it. */
  private parseAbsentMessage(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== "string") {
      throw new ValidationError("That submission could not be read. Reload the page and try again.");
    }
    if (raw.trim().length === 0) return null;
    throw new ValidationError("An acceptance carries no message.");
  }
}

/**
 * A version's standing, derived from its response history alone: open when
 * nothing has been recorded, changes requested when at least one change request
 * exists and no acceptance does, accepted once an acceptance exists (at most
 * one, by database constraint).
 */
export function deriveResponseState(
  responses: readonly ProposalResponseInternal[],
): CustomerProposalResponseState {
  if (responses.some((response) => response.action === "accepted")) {
    return "accepted";
  }
  if (responses.some((response) => response.action === "changes_requested")) {
    return "changes_requested";
  }
  return "open";
}
