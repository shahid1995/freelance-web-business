/**
 * Organization creation.
 *
 * Runs after verification, per the ADR boundary: create or load the Person, and
 * if the person is starting a new organization, create the Organization, the
 * owner Membership, and an auditable creation event.
 *
 * The operation is idempotent by construction. It returns the organization the
 * person already belongs to instead of creating a second one, and a database
 * unique constraint on `memberships.person_id` is the backstop that holds even
 * if two requests somehow arrive together. That is what stops a repeated sign-in
 * link, a double-clicked button, or a page refresh from creating a second
 * organization for the same customer.
 */

import type { Clock } from "./clock";
import type { Membership, Organization, Person } from "./domain";
import { ValidationError } from "./errors";
import type { PlatformStore } from "./ports";
import { resolveOrganizationContext } from "./authorization";
import type { SessionService } from "./sessions";

const MAX_ORGANIZATION_NAME_LENGTH = 120;

export interface OrganizationCreationResult {
  organization: Organization;
  membership: Membership;
  /** False when an existing organization was returned instead of a new one. */
  created: boolean;
  /** The context the caller should render, so a retry lands in the same place. */
  context: { actor: { person: Person; membership: Membership; organization: Organization } };
}

export interface OrganizationServiceOptions {
  store: PlatformStore;
  clock: Clock;
  sessions: SessionService;
  newId: () => string;
}

export function normalizeOrganizationName(rawName: string): string {
  const name = rawName.replace(/\s+/g, " ").trim();
  if (name.length === 0) {
    throw new ValidationError("Enter your organization or business name.");
  }
  if (name.length > MAX_ORGANIZATION_NAME_LENGTH) {
    throw new ValidationError(
      `Keep the name under ${MAX_ORGANIZATION_NAME_LENGTH} characters.`,
    );
  }
  return name;
}

export class OrganizationService {
  constructor(private readonly options: OrganizationServiceOptions) {}

  /**
   * Creates the person's organization and makes them its owner, or returns the
   * organization they already have.
   *
   * `personId` always comes from the server-held session, never from the request
   * body.
   */
  createForPerson(personId: string, rawName: string): OrganizationCreationResult {
    return this.options.store.transaction(() => {
      const existingContext = resolveOrganizationContext(
        this.options.store,
        personId,
      );
      if (existingContext) {
        // Already an owner/admin/member of an organization. Return it unchanged:
        // a retried request must never produce a second organization.
        return {
          organization: existingContext.actor.organization,
          membership: existingContext.actor.membership,
          created: false,
          context: { actor: existingContext.actor },
        };
      }

      const person = this.options.store.findPersonById(personId);
      if (!person) {
        throw new ValidationError("Your account could not be loaded.");
      }

      const now = this.options.clock.now();
      const organization = this.options.store.createOrganization({
        id: this.options.newId(),
        name: normalizeOrganizationName(rawName),
        now,
      });
      // The first user of a newly created organization is its owner.
      const membership = this.options.store.createMembership({
        id: this.options.newId(),
        personId,
        organizationId: organization.id,
        role: "owner",
        now,
      });

      this.options.store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: organization.id,
        personId,
        projectId: null,
        type: "organization.created",
        occurredAt: now,
        metadata: { role: "owner" },
      });
      this.options.store.appendAuditEvent({
        id: this.options.newId(),
        organizationId: organization.id,
        personId,
        projectId: null,
        type: "membership.created",
        occurredAt: now,
        metadata: { role: "owner" },
      });

      return {
        organization,
        membership,
        created: true,
        context: { actor: { person, membership, organization } },
      };
    });
  }
}