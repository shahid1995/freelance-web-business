/**
 * Proposal test infrastructure.
 *
 * The two proposal suites — Customer Proposal Review (the read path) and
 * Customer Proposal Response (Request Changes / Accept) — are set up the same
 * way: a Founder-capable author opens a proposal on a customer's project,
 * publishes a version, and customers read or respond to it. That setup lives
 * here once, so each suite reads as behaviour rather than as repeated
 * scaffolding.
 *
 * All identities and proposal content here are synthetic.
 */

import assert from "node:assert/strict";

import { emailHash } from "../../lib/platform/secrets";
import type { CustomerProposalView } from "../../lib/platform/views";
import {
  OWNER_EMAIL,
  createTestPlatform,
  signUpAsOwnerWithProject,
  type TestPlatform,
} from "./harness";

/** The Founder identity the proposal suites use: the first organization owner. */
export const FOUNDER_HASH = emailHash(OWNER_EMAIL);

/** A harness with the Founder bootstrap configured, as authoring a proposal needs. */
export async function createProposalHarness(): Promise<TestPlatform> {
  return createTestPlatform({ config: { founderEmailHashes: [FOUNDER_HASH] } });
}

/** An owner and the identifiers of the project the suite works against. */
export interface Owner {
  personId: string;
  organizationId: string;
  projectId: string;
  reference: string;
}

/** A proposal author: a Founder-capable person acting on one project. */
export interface Author {
  personId: string;
  projectId: string;
}

/**
 * Signs up an owner, starts one project, and resolves its customer-facing
 * reference — the setup every proposal scenario begins from.
 */
export async function ownerWithProject(
  harness: TestPlatform,
  email = OWNER_EMAIL,
  organizationName = "First Synthetic Org",
): Promise<Owner> {
  const owner = await signUpAsOwnerWithProject(harness, email, organizationName);
  const project = harness.platform.store.findProject(owner.projectId);
  assert.ok(project);
  return {
    personId: owner.personId,
    organizationId: owner.organizationId,
    projectId: owner.projectId,
    reference: project.reference,
  };
}

/** The Founder-capable author for an owner's own project. */
export function authorFor(owner: Owner): Author {
  return { personId: owner.personId, projectId: owner.projectId };
}

/** Distinct content per label, so tests prove which version was selected. */
export function content(label: string) {
  return {
    summary: `Summary ${label}`,
    scopeIncluded: `Included ${label}`,
    scopeExcluded: `Excluded ${label}`,
    deliverables: `Deliverables ${label}`,
    timeline: `Timeline ${label}`,
    assumptions: `Assumptions ${label}`,
    commercialTerms: `Terms ${label}`,
  };
}

export function startProposal(harness: TestPlatform, author: Author, label: string): void {
  harness.platform.proposals.createProposal({
    personId: author.personId,
    projectId: author.projectId,
    content: content(label),
  });
}

export function addVersion(harness: TestPlatform, author: Author, label: string): void {
  harness.platform.proposals.createVersion({
    personId: author.personId,
    projectId: author.projectId,
    content: content(label),
  });
}

export function publish(harness: TestPlatform, author: Author, versionNumber: number): void {
  harness.platform.proposals.publishVersion({
    personId: author.personId,
    projectId: author.projectId,
    versionNumber,
  });
}

/** Opens the proposal and publishes its first version. */
export function publishFirstVersion(harness: TestPlatform, author: Author): void {
  startProposal(harness, author, "v1");
  publish(harness, author, 1);
}

/** Publishes a further version of an owner's own proposal. */
export function publishNextVersion(
  harness: TestPlatform,
  owner: Owner,
  versionNumber: number,
): void {
  const author = authorFor(owner);
  addVersion(harness, author, `v${versionNumber}`);
  publish(harness, author, versionNumber);
}

export function grantAccess(harness: TestPlatform, owner: Owner, memberPersonId: string): void {
  harness.platform.projects.grantProjectAccess({
    personId: owner.personId,
    organizationId: owner.organizationId,
    projectId: owner.projectId,
    memberPersonId,
  });
}

export function revokeAccess(harness: TestPlatform, owner: Owner, memberPersonId: string): void {
  harness.platform.projects.revokeProjectAccess({
    personId: owner.personId,
    organizationId: owner.organizationId,
    projectId: owner.projectId,
    memberPersonId,
  });
}

/** An owner whose project has a published proposal. */
export async function publishedOwner(
  harness: TestPlatform,
  email = OWNER_EMAIL,
  organizationName = "First Synthetic Org",
): Promise<Owner> {
  const owner = await ownerWithProject(harness, email, organizationName);
  publishFirstVersion(harness, owner);
  return owner;
}

/**
 * Mirrors the proposal page: resolve and authorize the customer-facing
 * reference exactly once through the customer project service, then read the
 * proposal by that authorized project id. Authorization therefore still runs on
 * every read, in the same layer as every other customer read.
 */
export function readProposal(
  harness: TestPlatform,
  personId: string,
  reference: string,
): CustomerProposalView | null {
  const projectId = harness.platform.projects.resolveProjectIdByReference(
    personId,
    reference,
  );
  return harness.platform.customerProposals.readByProjectId(personId, projectId);
}
