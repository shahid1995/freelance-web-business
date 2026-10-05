/**
 * Server-side authorization.
 *
 * Every rule from the ADR policy matrix lives here, and every service call goes
 * through these functions rather than trusting anything the client sent. The
 * request handler decides which resource is being touched; these functions
 * decide whether the actor may touch it.
 */

import type {
  InternalCapabilityName,
  Membership,
  Organization,
  Person,
  ProjectId,
  ProjectInternal,
} from "./domain";
import { isOrganizationAdministrator } from "./domain";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "./errors";
import type { PlatformStore } from "./ports";

/** A person together with the organization context they were resolved in. */
export interface Actor {
  person: Person;
  membership: Membership;
  organization: Organization;
}

export interface OrganizationContext {
  actor: Actor;
  role: Membership["role"];
  isAdministrator: boolean;
}

/**
 * Resolves the organization context for a person id.
 *
 * Returns null rather than throwing so a signed-in person who has not created an
 * organization yet can be routed to organization creation instead of receiving a
 * permission error.
 */
export function resolveOrganizationContext(
  store: PlatformStore,
  personId: string,
): OrganizationContext | null {
  const person = store.findPersonById(personId);
  if (!person) {
    throw new UnauthenticatedError();
  }
  const membership = store.findMembershipByPerson(personId);
  if (!membership) {
    return null;
  }
  const organization = store.findOrganization(membership.organizationId);
  if (!organization) {
    throw new UnauthenticatedError("Your organization could not be loaded.");
  }
  return {
    actor: { person, membership, organization },
    role: membership.role,
    isAdministrator: isOrganizationAdministrator(membership.role),
  };
}

/**
 * Loads the organization context for an actor, failing closed.
 * A person with no organization has no project authority at all.
 */
export function requireOrganizationContext(
  store: PlatformStore,
  personId: string,
): OrganizationContext {
  const context = resolveOrganizationContext(store, personId);
  if (!context) {
    throw new ForbiddenError("Your account is not connected to an organization yet.");
  }
  return context;
}

/**
 * Organization administration: manage members, organization settings, and
 * create projects. Ordinary members cannot do any of these in this slice.
 */
export function requireOrganizationAdministrator(
  store: PlatformStore,
  personId: string,
  organizationId: string,
): OrganizationContext {
  const context = requireOrganizationContext(store, personId);
  if (context.actor.organization.id !== organizationId) {
    throw new ForbiddenError();
  }
  if (!context.isAdministrator) {
    throw new ForbiddenError("Only an organization owner or admin can do that.");
  }
  return context;
}

/**
 * Loads a project that belongs to the actor's organization.
 *
 * A project in another organization is reported as missing rather than
 * forbidden, so a response never confirms that it exists. This is the
 * organization-level check, used both for ordinary reads and for granting or
 * revoking member access.
 */
export function requireOrganizationProject(
  store: PlatformStore,
  context: OrganizationContext,
  projectId: ProjectId,
): ProjectInternal {
  const project = store.findProject(projectId);
  if (!project || project.organizationId !== context.actor.organization.id) {
    throw new NotFoundError("That project does not exist.");
  }
  return project;
}

/**
 * Internal capability.
 *
 * Deliberately **not** part of the customer policy matrix above. It is checked
 * first, on its own, so internal access can never be reached by widening a
 * customer rule, and so being an organization owner or admin can never imply it.
 *
 * The check reads the current grant row on every call rather than reusing an
 * earlier decision, so a revoked capability stops working on the next request.
 * Returns the person so the caller does not have to load them again.
 */
export function requireInternalCapability(
  store: PlatformStore,
  personId: string,
  capability: InternalCapabilityName,
): Person {
  const person = store.findPersonById(personId);
  if (!person) {
    throw new UnauthenticatedError();
  }
  const grant = store.findInternalCapability(personId, capability);
  if (!grant || grant.revokedAt !== null) {
    throw new ForbiddenError("This area is restricted.");
  }
  return person;
}

/** The Founder-only capability required by the approved Founder Workspace ADR. */
export function requireFounderCapability(store: PlatformStore, personId: string): Person {
  return requireInternalCapability(store, personId, "founder");
}

/**
 * Project access.
 *
 * Owner/Admin have organization-wide project access. An ordinary member has
 * access only to projects with a live explicit grant. A revoked grant stops
 * working immediately, because this check reads `revoked_at` on every call rather
 * than reusing an earlier decision.
 */
export function requireProjectAccess(
  store: PlatformStore,
  personId: string,
  projectId: ProjectId,
): { context: OrganizationContext; project: ProjectInternal } {
  const context = requireOrganizationContext(store, personId);
  const project = requireOrganizationProject(store, context, projectId);
  if (context.isAdministrator) {
    return { context, project };
  }
  const access = store.findProjectAccess(projectId, personId);
  if (!access || access.revokedAt !== null) {
    throw new ForbiddenError("You do not have access to that project.");
  }
  return { context, project };
}