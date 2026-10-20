/**
 * Founder-only payment configuration authoring.
 *
 * The provider-neutral slice from the approved payments decision (sections B.1,
 * B.2, C.1–C.2, J.1, J.2): the Founder records a project's amount and currency,
 * selects one of the three approved schedule structures, and issues the explicit
 * set of payment obligations for one immutable configuration version bound to the
 * exact current commercial baseline.
 *
 * Boundaries this module deliberately keeps:
 *
 * - **Founder capability only.** Every operation starts with
 *   `requireFounderWithBootstrap`; organization ownership or administration is
 *   never consulted and never implies this authority (section G.3).
 * - **No amounts in audit metadata.** Audit rows carry identifiers and version
 *   numbers only (section B.6); amounts, currencies, and scope references stay
 *   in the protected payment records.
 * - **No provider, no activation, no due dates, no obligation states.** Schedule
 *   timing, state transitions, and the trigger for becoming payable are
 *   unresolved Founder decisions (sections C.3, C.4, F.2) and are not modelled
 *   here — an obligation row has no status and no due-date field at all.
 * - **No invented breakdown.** The obligations arrive explicitly, in order,
 *   with their exact amounts. Nothing derives a deposit percentage, an
 *   installment count, or a hidden schedule from the chosen structure, and no
 *   sum is reconciled against the project total: both would be new commercial
 *   policy (J.1–J.2 deliberately leave the breakdown to explicit Founder input).
 * - **One currency per configuration.** Every obligation uses the
 *   configuration's own project currency. A mixed-currency obligation set is
 *   rejected, never converted: no exchange rate, no rounding, and no
 *   re-scaling of an exact decimal string (Founder decision recorded
 *   2026-10-20).
 *
 * No customer route, view, or projection imports this module.
 */

import { requireFounderWithBootstrap } from "./authorization";
import type { Clock } from "./clock";
import {
  isPaymentScheduleStructure,
  type AgreementId,
  type AgreementVersionId,
  type AuditEventType,
  type PaymentConfigVersionId,
  type PaymentConfigVersionInternal,
  type PaymentObligationId,
  type PaymentObligationInternal,
  type PaymentScheduleStructure,
  type PersonId,
  type ProjectId,
  type ProjectInternal,
  type ProposalId,
  type ProposalVersionId,
} from "./domain";
import { NotFoundError, ValidationError } from "./errors";
import type { PlatformStore } from "./ports";

/**
 * Technical input bounds. These are request-sanity limits in the spirit of the
 * intake message limit — not commercial policy: none of them encodes how a
 * schedule may be shaped, only how large a single field may be.
 */
const MAX_OBLIGATIONS = 100;
const MAX_AMOUNT_LENGTH = 32;
/** Wide enough for every ISO 4217 exponent (at most 4) plus margin — never a claim that any currency uses a fixed number of decimals. */
const MAX_AMOUNT_DECIMALS = 6;
const MAX_SCOPE_REFERENCE_LENGTH = 128;

/**
 * Exact decimal text: an unsigned integer part with an optional fractional
 * part, no exponent, no sign, no separators. `1500` and `1500.50` and
 * `120.750` are all valid; `1500.`, `.5`, `1,500`, `-10`, `1e3`, and `007`
 * are not. The value is kept as the exact string the Founder entered (trimmed
 * only) — it is never parsed into a number, so no floating-point arithmetic
 * touches it and no decimal-place assumption is applied.
 */
const AMOUNT_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/;
/** Three letters, matched case-insensitively and stored uppercase. A code is accepted by shape, never by membership in an invented currency list (J.1 leaves currency to the Founder). */
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;
const CURRENCY_LENGTH = 3;

/** The only fields an obligation may carry. Anything else is rejected, not ignored. */
const OBLIGATION_FIELDS = new Set([
  "expectedAmount",
  "currency",
  "scopeOrMilestoneRef",
]);

export interface PaymentConfigurationServiceOptions {
  store: PlatformStore;
  clock: Clock;
  newId: () => string;
  founderEmailHashes: readonly string[];
}

export interface CreatePaymentConfigVersionInput {
  personId: string;
  projectId: ProjectId;
  scheduleStructure: unknown;
  totalAmount: unknown;
  currency: unknown;
  /** Ordered list of `{ expectedAmount, currency, scopeOrMilestoneRef? }`. Ordering is positional; no order field is read from the records. */
  obligations: unknown;
  /**
   * The accepted proposal version the caller is binding to. The server derives
   * the actual current baseline inside the write transaction and rejects a
   * mismatch, following the same stale-version-binding rule proposal publishing
   * and agreement signing already use — a stale baseline is refused rather than
   * silently rebound in either direction.
   */
  expectedProposalVersionId: unknown;
  expectedAgreementVersionId: unknown;
}

export interface PaymentObligationView {
  id: PaymentObligationId;
  /** 1-based position, from the Founder's explicit ordering. */
  orderIndex: number;
  expectedAmount: string;
  currency: string;
  scopeOrMilestoneRef: string | null;
  createdByPersonId: PersonId;
  createdAt: number;
}

export interface PaymentConfigVersionView {
  id: PaymentConfigVersionId;
  /** Per-project, 1-based, gapless. */
  versionNumber: number;
  scheduleStructure: PaymentScheduleStructure;
  /** Exact Founder-entered decimal string, unmodified beyond trimming. */
  totalAmount: string;
  currency: string;
  proposalId: ProposalId;
  proposalVersionId: ProposalVersionId;
  proposalVersionNumber: number;
  agreementId: AgreementId;
  agreementVersionId: AgreementVersionId;
  agreementVersionNumber: number;
  createdByPersonId: PersonId;
  createdAt: number;
  /**
   * Derived at read time and never stored: true once the current accepted
   * proposal version or the current applicable signed agreement version no
   * longer matches what this version references (payments decision, section
   * B.1). The stored references are not rewritten when this flips — the version
   * becomes stale, not current again.
   */
  stale: boolean;
  obligations: PaymentObligationView[];
}

export interface InternalPaymentConfigView {
  projectReference: string;
  /** Oldest first, so the latest configuration is last. */
  versions: PaymentConfigVersionView[];
}

function parseScheduleStructure(raw: unknown): PaymentScheduleStructure {
  if (!isPaymentScheduleStructure(raw)) {
    throw new ValidationError(
      "The schedule structure must be one of the three supported structures: full_upfront, deposit_plus_later, milestone_linked.",
    );
  }
  return raw;
}

/**
 * Validates and normalizes one monetary input.
 *
 * Accepts only decimal text, trims surrounding whitespace, and returns the
 * digits exactly as entered. Rejecting a JavaScript number outright is
 * deliberate: a number has already passed through binary floating point, so it
 * cannot promise the exact value the Founder meant to record. Zero is rejected
 * as well — an obligation or project total with no nonzero digit is not a
 * monetary requirement, and letting it through would let a future satisfaction
 * check pass vacuously.
 */
function normalizeAmount(raw: unknown, label: string): string {
  if (typeof raw !== "string") {
    throw new ValidationError(
      `${label} must be an amount given as text, for example 1500 or 1500.50.`,
    );
  }
  const value = raw.trim();
  if (value.length > MAX_AMOUNT_LENGTH || !AMOUNT_PATTERN.test(value)) {
    throw new ValidationError(
      `${label} must be a plain decimal amount such as 1500 or 1500.50, with no commas, signs, or exponent.`,
    );
  }
  if (!/[1-9]/.test(value)) {
    throw new ValidationError(`${label} must be greater than zero.`);
  }
  return value;
}

function normalizeCurrency(raw: unknown, label: string): string {
  if (typeof raw !== "string") {
    throw new ValidationError(`${label} must be a three-letter currency code such as USD.`);
  }
  const value = raw.trim().toUpperCase();
  if (value.length !== CURRENCY_LENGTH || !CURRENCY_PATTERN.test(value)) {
    throw new ValidationError(`${label} must be a three-letter currency code such as USD.`);
  }
  return value;
}

interface NormalizedObligation {
  expectedAmount: string;
  currency: string;
  scopeOrMilestoneRef: string | null;
}

/**
 * Validates the explicit obligation list.
 *
 * The list arrives in the Founder's chosen order and that order is what is
 * stored; nothing here derives positions, counts, or amounts from the schedule
 * structure. The structure only decides one thing: a milestone-linked
 * obligation must carry its opaque scope/milestone reference (that is what the
 * structure means, J.2), and for the other two structures a reference is
 * rejected rather than silently ignored because nothing would ever read it.
 *
 * It also enforces the Founder's single-currency rule (recorded 2026-10-20): one
 * payment configuration uses exactly one currency, so every obligation must
 * carry the configuration's own currency. Both sides are already normalized by
 * `normalizeCurrency`, so the comparison is a plain string equality on the
 * stored uppercase form — case never decides it, and nothing is converted,
 * rounded, or re-scaled to make two currencies comparable. A mismatch is a
 * rejection, not a conversion, and it is raised here — during input
 * normalization, before the write transaction is opened.
 */
function normalizeObligations(
  raw: unknown,
  scheduleStructure: PaymentScheduleStructure,
  configurationCurrency: string,
): NormalizedObligation[] {
  if (!Array.isArray(raw)) {
    throw new ValidationError("The obligations must be supplied as a list.");
  }
  if (raw.length < 1) {
    throw new ValidationError("A payment configuration needs at least one obligation.");
  }
  if (raw.length > MAX_OBLIGATIONS) {
    throw new ValidationError(
      `A payment configuration cannot carry more than ${MAX_OBLIGATIONS} obligations.`,
    );
  }

  const expectsScopeReference = scheduleStructure === "milestone_linked";
  return raw.map((entry, index): NormalizedObligation => {
    const position = index + 1;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new ValidationError(`Obligation ${position} must be an object.`);
    }
    const record = entry as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!OBLIGATION_FIELDS.has(key)) {
        throw new ValidationError(
          `Obligation ${position} has an unsupported field: ${key}.`,
        );
      }
    }

    const expectedAmount = normalizeAmount(record.expectedAmount, `Obligation ${position}'s amount`);
    const currency = normalizeCurrency(record.currency, `Obligation ${position}'s currency`);
    if (currency !== configurationCurrency) {
      throw new ValidationError(
        `Obligation ${position}'s currency (${currency}) must match the project currency (${configurationCurrency}). One payment configuration uses exactly one currency.`,
      );
    }

    const rawScopeReference = record.scopeOrMilestoneRef;
    let scopeOrMilestoneRef: string | null = null;
    if (expectsScopeReference) {
      if (typeof rawScopeReference !== "string" || rawScopeReference.trim() === "") {
        throw new ValidationError(
          `Obligation ${position} must reference the scope or milestone version it belongs to.`,
        );
      }
      scopeOrMilestoneRef = rawScopeReference.trim();
      if (scopeOrMilestoneRef.length > MAX_SCOPE_REFERENCE_LENGTH) {
        throw new ValidationError(
          `Obligation ${position}'s scope or milestone reference is too long.`,
        );
      }
    } else if (rawScopeReference !== undefined && rawScopeReference !== null) {
      throw new ValidationError(
        `Obligation ${position} carries a scope or milestone reference, but only milestone-linked obligations can use one.`,
      );
    }

    return { expectedAmount, currency, scopeOrMilestoneRef };
  });
}

function parseBaselineReference(raw: unknown, label: string): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new ValidationError(`The ${label} reference is missing.`);
  }
  return raw.trim();
}

export class PaymentConfigurationService {
  constructor(private readonly options: PaymentConfigurationServiceOptions) {}

  /**
   * Reads every configuration version and its obligations for one project.
   *
   * Founder-only, read-only, and scoped to the requested project: the version
   * list comes from a project-scoped query and each obligation list from the
   * owning version id, so one project's records can never surface under
   * another's.
   */
  read(personId: string, projectId: ProjectId): InternalPaymentConfigView {
    const project = this.requireFounderProject(personId, projectId);
    const store = this.options.store;
    const currentProposalVersionId =
      store.findCurrentAcceptedProposalVersion(project.id)?.id ?? null;
    const currentAgreementVersionId =
      store.findCurrentSignedAgreementVersion(project.id)?.id ?? null;

    const versions = store.listPaymentConfigVersions(project.id).map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      scheduleStructure: version.scheduleStructure,
      totalAmount: version.totalAmount,
      currency: version.currency,
      proposalId: version.proposalId,
      proposalVersionId: version.proposalVersionId,
      proposalVersionNumber: version.proposalVersionNumber,
      agreementId: version.agreementId,
      agreementVersionId: version.agreementVersionId,
      agreementVersionNumber: version.agreementVersionNumber,
      createdByPersonId: version.createdByPersonId,
      createdAt: version.createdAt,
      stale:
        version.proposalVersionId !== currentProposalVersionId ||
        version.agreementVersionId !== currentAgreementVersionId,
      obligations: store.listPaymentObligationsByVersion(version.id).map(toObligationView),
    }));

    return { projectReference: project.reference, versions };
  }

  /**
   * Creates the next immutable configuration version for a project.
   *
   * Validation order matters and is deliberate:
   *
   * 1. **Founder capability, then project resolution** — authorization never
   *    depends on route visibility, organization membership, or a
   *    caller-supplied id (section G.2).
   * 2. **All commercial input validation** happens before the transaction
   *    opens, so malformed amounts, currencies, schedules, or obligations —
   *    and any obligation whose currency differs from the configuration's
   *    own currency — are rejected before persistence is even attempted.
   * 3. **Baseline validation runs inside the write transaction** (section B.1):
   *    an accepted proposal must exist, a signed agreement applicable to that
   *    exact proposal must exist, and the caller's expected references must
   *    equal those current versions. A published-but-unsigned agreement is not
   *    signed evidence, and a signed agreement whose proposal baseline has been
   *    superseded is not applicable — both are rejected rather than bound.
   * 4. **Configuration, obligations, and audit rows are written in that same
   *    transaction**, so they commit together or leave nothing behind (G.5).
   *
   * A change to the configuration is always a *new* version: previous versions
   * and their issued obligations are never rewritten, reassigned, or deleted.
   */
  createVersion(input: CreatePaymentConfigVersionInput): InternalPaymentConfigView {
    const project = this.requireFounderProject(input.personId, input.projectId);

    const scheduleStructure = parseScheduleStructure(input.scheduleStructure);
    const totalAmount = normalizeAmount(input.totalAmount, "The project amount");
    const currency = normalizeCurrency(input.currency, "The project currency");
    const obligations = normalizeObligations(input.obligations, scheduleStructure, currency);
    const expectedProposalVersionId = parseBaselineReference(
      input.expectedProposalVersionId,
      "accepted proposal version",
    );
    const expectedAgreementVersionId = parseBaselineReference(
      input.expectedAgreementVersionId,
      "signed agreement version",
    );
    const now = this.options.clock.now();

    this.options.store.transaction((store) => {
      const currentProposal = store.findCurrentAcceptedProposalVersion(project.id);
      if (!currentProposal) {
        throw new ValidationError(
          "An accepted proposal is required before a payment configuration can be created.",
        );
      }

      const currentAgreement = store.findCurrentSignedAgreementVersion(project.id);
      if (!currentAgreement) {
        const published = store.findCurrentAgreementVersion(project.id);
        if (published && published.status === "published") {
          throw new ValidationError(
            "The current agreement version is published but not signed. A signed agreement is required before a payment configuration can be created.",
          );
        }
        throw new ValidationError(
          "A signed agreement applicable to the accepted proposal is required before a payment configuration can be created.",
        );
      }

      if (
        expectedProposalVersionId !== currentProposal.id ||
        expectedAgreementVersionId !== currentAgreement.id
      ) {
        throw new ValidationError(
          "The proposal or agreement baseline changed after this configuration was prepared. Nothing was saved; reload the current baseline and try again.",
        );
      }

      // Inside the transaction, so two concurrent creations cannot both observe
      // the same highest version number; the UNIQUE (project_id, version_number)
      // constraint remains the final integrity guard.
      const existing = store.listPaymentConfigVersions(project.id);
      const versionNumber =
        existing.length > 0 ? existing[existing.length - 1]!.versionNumber + 1 : 1;

      const version = store.createPaymentConfigVersion({
        id: this.options.newId(),
        projectId: project.id,
        organizationId: project.organizationId,
        versionNumber,
        scheduleStructure,
        totalAmount,
        currency,
        proposalId: currentProposal.proposalId,
        proposalVersionId: currentProposal.id,
        proposalVersionNumber: currentProposal.versionNumber,
        agreementId: currentAgreement.agreementId,
        agreementVersionId: currentAgreement.id,
        agreementVersionNumber: currentAgreement.versionNumber,
        createdByPersonId: input.personId,
        createdAt: now,
      });

      this.recordEvent(store, {
        type: "payment_config_version.created",
        personId: input.personId,
        project,
        occurredAt: now,
        metadata: {
          paymentConfigVersionId: version.id,
          versionNumber: version.versionNumber,
          proposalVersionId: version.proposalVersionId,
          agreementVersionId: version.agreementVersionId,
        },
      });

      obligations.forEach((obligation, index) => {
        const created = store.createPaymentObligation({
          id: this.options.newId(),
          paymentConfigVersionId: version.id,
          projectId: project.id,
          organizationId: project.organizationId,
          orderIndex: index + 1,
          expectedAmount: obligation.expectedAmount,
          currency: obligation.currency,
          scopeOrMilestoneRef: obligation.scopeOrMilestoneRef,
          createdByPersonId: input.personId,
          createdAt: now,
        });
        this.recordEvent(store, {
          type: "payment_obligation.created",
          personId: input.personId,
          project,
          occurredAt: now,
          metadata: {
            paymentConfigVersionId: version.id,
            obligationId: created.id,
          },
        });
      });
    });

    return this.read(input.personId, project.id);
  }

  /**
   * Founder capability first, on every call, then project resolution.
   *
   * The capability check is the same shared bootstrap the other internal
   * services use, so membership in a customer organization — owner or admin —
   * can never imply payment authority.
   */
  private requireFounderProject(personId: string, projectId: ProjectId): ProjectInternal {
    requireFounderWithBootstrap(
      this.options.store,
      this.options.clock,
      this.options.founderEmailHashes,
      personId,
    );
    if (typeof projectId !== "string" || projectId.trim() === "") {
      throw new NotFoundError("That project does not exist.");
    }
    const project = this.options.store.findProject(projectId.trim());
    if (!project) {
      throw new NotFoundError("That project does not exist.");
    }
    return project;
  }

  /** Identifier-only audit append; the caller has already opened the transaction. */
  private recordEvent(
    store: PlatformStore,
    input: {
      type: AuditEventType;
      personId: string;
      project: ProjectInternal;
      occurredAt: number;
      metadata: Record<string, unknown>;
    },
  ): void {
    store.appendAuditEvent({
      id: this.options.newId(),
      organizationId: input.project.organizationId,
      personId: input.personId,
      projectId: input.project.id,
      type: input.type,
      occurredAt: input.occurredAt,
      metadata: input.metadata,
    });
  }
}

function toObligationView(obligation: PaymentObligationInternal): PaymentObligationView {
  return {
    id: obligation.id,
    orderIndex: obligation.orderIndex,
    expectedAmount: obligation.expectedAmount,
    currency: obligation.currency,
    scopeOrMilestoneRef: obligation.scopeOrMilestoneRef,
    createdByPersonId: obligation.createdByPersonId,
    createdAt: obligation.createdAt,
  };
}
