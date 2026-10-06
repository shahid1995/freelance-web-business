/**
 * Customer Proposal Review.
 *
 * Exercises the accepted Customer Proposal Review ADR against the real services,
 * real SQL, and the real authorization helpers: a customer can read the current
 * published proposal for a project they may access, drafts never reach them, the
 * projection is a strict customer-safe subset, and reading changes nothing.
 *
 * Only the passage of time and the email transport are controlled. All
 * identities and proposal content here are synthetic.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { isPlatformError } from "../lib/platform/errors";
import type { CustomerProposalView } from "../lib/platform/views";
import { emailHash } from "../lib/platform/secrets";
import {
  MEMBER_EMAIL,
  OTHER_EMAIL,
  OWNER_EMAIL,
  addOrdinaryMember,
  createTestPlatform,
  signUpAsOwnerWithProject,
  type TestPlatform,
} from "./support/harness";

const FOUNDER_HASH = emailHash(OWNER_EMAIL);

async function reviewHarness(): Promise<TestPlatform> {
  return createTestPlatform({ config: { founderEmailHashes: [FOUNDER_HASH] } });
}

async function ownerWithProject(
  harness: TestPlatform,
  email = OWNER_EMAIL,
  organizationName = "First Synthetic Org",
) {
  const owner = await signUpAsOwnerWithProject(harness, email, organizationName);
  const project = harness.platform.store.findProject(owner.projectId);
  assert.ok(project);
  return { ...owner, reference: project.reference };
}

/** A proposal author: a Founder-capable person acting on one project. */
type Author = { personId: string; projectId: string };

/** Distinct content per label, so tests prove which version was selected. */
function content(label: string) {
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

function startProposal(harness: TestPlatform, author: Author, label: string): void {
  harness.platform.proposals.createProposal({
    personId: author.personId,
    projectId: author.projectId,
    content: content(label),
  });
}

function addVersion(harness: TestPlatform, author: Author, label: string): void {
  harness.platform.proposals.createVersion({
    personId: author.personId,
    projectId: author.projectId,
    content: content(label),
  });
}

function publish(harness: TestPlatform, author: Author, versionNumber: number): void {
  harness.platform.proposals.publishVersion({
    personId: author.personId,
    projectId: author.projectId,
    versionNumber,
  });
}

function readProposal(
  harness: TestPlatform,
  personId: string,
  reference: string,
): CustomerProposalView | null {
  return harness.platform.customerProposals.readByProjectReference(personId, reference);
}

function hasPublished(harness: TestPlatform, personId: string, projectId: string): boolean {
  return harness.platform.projects.getCustomerProject(personId, projectId).project
    .hasPublishedProposal;
}

/** The exact customer-safe projection the ADR approves, and nothing else. */
const PROPOSAL_VIEW_KEYS = [
  "assumptions",
  "commercialTerms",
  "deliverables",
  "projectReference",
  "publishedAt",
  "scopeExcluded",
  "scopeIncluded",
  "summary",
  "timeline",
  "validUntil",
  "versionNumber",
].sort();

/** Keys that must never appear in anything a customer can read. */
const FORBIDDEN_KEYS = [
  "id",
  "proposalId",
  "versionId",
  "publishedVersionId",
  "createdByPersonId",
  "createdAt",
  "status",
  "versions",
  "latestDraft",
  "qualificationState",
  "internalNotes",
  "founderDecision",
  "internalNextAction",
  "metadata",
  "auditEvents",
];

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}

function expectCode(error: unknown, code: string): boolean {
  return isPlatformError(error) && error.code === code;
}

describe("customer proposal authorization", () => {
  it("rejects an unauthenticated caller", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "v1");

    assert.throws(
      () => readProposal(harness, "person-who-does-not-exist", owner.reference),
      (error: unknown) => expectCode(error, "unauthenticated"),
    );
    harness.platform.close();
  });

  it("rejects an authenticated customer without project access", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    startProposal(harness, owner, "v1");
    publish(harness, owner, 1);

    assert.throws(
      () => readProposal(harness, member.personId, owner.reference),
      (error: unknown) => expectCode(error, "forbidden"),
    );
    harness.platform.close();
  });

  it("lets an ordinary member with an explicit assignment read", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    startProposal(harness, owner, "v1");
    publish(harness, owner, 1);
    harness.platform.projects.grantProjectAccess({
      personId: owner.personId,
      organizationId: owner.organizationId,
      projectId: owner.projectId,
      memberPersonId: member.personId,
    });

    const view = readProposal(harness, member.personId, owner.reference);
    assert.equal(view?.versionNumber, 1);
    assert.equal(view?.summary, "Summary v1");
    harness.platform.close();
  });

  it("lets an organization owner/admin read a project in their own organization", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "v1");
    publish(harness, owner, 1);

    const view = readProposal(harness, owner.personId, owner.reference);
    assert.equal(view?.projectReference, owner.reference);
    assert.equal(view?.versionNumber, 1);
    harness.platform.close();
  });

  it("does not disclose another organization's project to an owner/admin", async () => {
    const harness = await reviewHarness();
    const firstOrg = await ownerWithProject(harness);
    const secondOrg = await ownerWithProject(harness, OTHER_EMAIL, "Second Synthetic Org");
    // The Founder authors the second organization's proposal; the Founder holds
    // membership in no customer organization.
    const asFounder = { personId: firstOrg.personId, projectId: secondOrg.projectId };
    startProposal(harness, asFounder, "other-org");
    publish(harness, asFounder, 1);

    // The first organization's owner is an admin, but of a different organization.
    assert.throws(
      () => readProposal(harness, firstOrg.personId, secondOrg.reference),
      (error: unknown) => expectCode(error, "not_found"),
    );
    harness.platform.close();
  });

  it("does not treat the founder capability as customer project access", async () => {
    const harness = await reviewHarness();
    const founderOrg = await ownerWithProject(harness);
    const otherOrg = await ownerWithProject(harness, OTHER_EMAIL, "Second Synthetic Org");

    // Trigger the controlled bootstrap so the first owner genuinely holds the
    // internal `founder` capability.
    harness.platform.proposals.read(founderOrg.personId, founderOrg.projectId);
    assert.ok(
      harness.platform.store.findInternalCapability(founderOrg.personId, "founder"),
      "the first owner should hold the founder capability",
    );

    const asFounder = { personId: founderOrg.personId, projectId: otherOrg.projectId };
    startProposal(harness, asFounder, "other-org");
    publish(harness, asFounder, 1);

    // The capability grants nothing on the customer read path.
    assert.throws(
      () => readProposal(harness, founderOrg.personId, otherOrg.reference),
      (error: unknown) => expectCode(error, "not_found"),
    );
    harness.platform.close();
  });

  it("stops proposal access immediately when a project assignment is revoked", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    startProposal(harness, owner, "v1");
    publish(harness, owner, 1);
    harness.platform.projects.grantProjectAccess({
      personId: owner.personId,
      organizationId: owner.organizationId,
      projectId: owner.projectId,
      memberPersonId: member.personId,
    });
    assert.equal(readProposal(harness, member.personId, owner.reference)?.versionNumber, 1);

    harness.platform.projects.revokeProjectAccess({
      personId: owner.personId,
      organizationId: owner.organizationId,
      projectId: owner.projectId,
      memberPersonId: member.personId,
    });

    assert.throws(
      () => readProposal(harness, member.personId, owner.reference),
      (error: unknown) => expectCode(error, "forbidden"),
    );
    harness.platform.close();
  });
});

describe("customer proposal visibility", () => {
  it("returns nothing when the project has no proposal", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);

    assert.equal(readProposal(harness, owner.personId, owner.reference), null);
    assert.equal(hasPublished(harness, owner.personId, owner.projectId), false);
    harness.platform.close();
  });

  it("returns the same empty result when only drafts exist", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "draft-only");
    addVersion(harness, owner, "draft-only-2");

    assert.equal(readProposal(harness, owner.personId, owner.reference), null);
    harness.platform.close();
  });

  it("shows the published version and none of the draft-only content", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "DRAFT-ONLY-SENTINEL-1");
    addVersion(harness, owner, "PUBLISHED-SENTINEL-2");
    publish(harness, owner, 2);

    const view = readProposal(harness, owner.personId, owner.reference);
    assert.equal(view?.versionNumber, 2);
    assert.equal(view?.summary, "Summary PUBLISHED-SENTINEL-2");
    assert.equal(
      JSON.stringify(view).includes("DRAFT-ONLY-SENTINEL-1"),
      false,
      "a draft version's content must never reach the customer projection",
    );
    harness.platform.close();
  });

  it("keeps the published version visible when a newer draft is added", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "published-one");
    publish(harness, owner, 1);
    addVersion(harness, owner, "newer-draft");

    const view = readProposal(harness, owner.personId, owner.reference);
    assert.equal(view?.versionNumber, 1);
    assert.equal(view?.summary, "Summary published-one");
    harness.platform.close();
  });

  it("returns the highest-numbered published version when several are published", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "old-published");
    addVersion(harness, owner, "new-published");
    publish(harness, owner, 1);
    publish(harness, owner, 2);

    const view = readProposal(harness, owner.personId, owner.reference);
    assert.equal(view?.versionNumber, 2);
    assert.equal(view?.summary, "Summary new-published");
    assert.equal(JSON.stringify(view).includes("old-published"), false);
    harness.platform.close();
  });

  it("never retrieves a proposal through another project's reference", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "v1");
    publish(harness, owner, 1);

    const second = harness.platform.projects.createProject({
      personId: owner.personId,
      organizationId: owner.organizationId,
    });

    // The second project has no proposal of its own.
    assert.equal(
      readProposal(harness, owner.personId, second.project.reference),
      null,
    );
    // The first project's proposal is only reachable through its own reference.
    assert.equal(readProposal(harness, owner.personId, owner.reference)?.versionNumber, 1);
    harness.platform.close();
  });
});

describe("customer proposal projection boundary", () => {
  it("contains exactly the approved customer-safe fields", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "v1");
    publish(harness, owner, 1);

    const view = readProposal(harness, owner.personId, owner.reference);
    assert.ok(view);
    assert.deepEqual(Object.keys(view).sort(), PROPOSAL_VIEW_KEYS);
    assert.equal(view.projectReference, owner.reference);
    assert.equal(typeof view.publishedAt, "number");
    assert.equal(view.validUntil, null);
    harness.platform.close();
  });

  it("omits internal ids, audit metadata, and internal state", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "v1");
    publish(harness, owner, 1);

    const view = readProposal(harness, owner.personId, owner.reference);
    const keys = collectKeys(view);
    for (const forbidden of FORBIDDEN_KEYS) {
      assert.ok(!keys.has(forbidden), `projection must not contain "${forbidden}"`);
    }
    // The internal proposal and version ids exist on the stored records, which is
    // what makes the omission above meaningful rather than vacuous.
    const proposal = harness.platform.store.findProposalByProject(owner.projectId);
    assert.ok(proposal);
    assert.equal(JSON.stringify(view).includes(proposal.id), false);
    harness.platform.close();
  });
});

describe("customer proposal state preservation", () => {
  it("performs no write and creates no audit event when reading", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "v1");
    addVersion(harness, owner, "v2");
    publish(harness, owner, 1);

    const proposal = harness.platform.store.findProposalByProject(owner.projectId);
    assert.ok(proposal);
    const snapshot = () => ({
      project: harness.platform.store.findProject(owner.projectId),
      versions: harness.platform.store.listProposalVersions(proposal.id),
      audit: harness.platform.store.listAuditEventsForProject(owner.projectId, 100),
      stage: harness.platform.projects.getCustomerProject(owner.personId, owner.projectId)
        .project.stage,
      hasPublishedProposal: hasPublished(harness, owner.personId, owner.projectId),
    });

    const before = snapshot();
    const view = readProposal(harness, owner.personId, owner.reference);
    assert.ok(view);
    const after = snapshot();

    assert.deepEqual(after, before, "reading a proposal must not write anything");
    harness.platform.close();
  });
});

describe("dashboard published-proposal signal", () => {
  it("is false for no proposal and for drafts only, and true once published", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);

    assert.equal(hasPublished(harness, owner.personId, owner.projectId), false);
    startProposal(harness, owner, "draft");
    assert.equal(hasPublished(harness, owner.personId, owner.projectId), false);
    publish(harness, owner, 1);
    assert.equal(hasPublished(harness, owner.personId, owner.projectId), true);
    harness.platform.close();
  });

  it("stays true when a newer draft follows and when more versions are published", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "v1");
    publish(harness, owner, 1);
    addVersion(harness, owner, "newer-draft");
    assert.equal(hasPublished(harness, owner.personId, owner.projectId), true);

    publish(harness, owner, 2);
    assert.equal(hasPublished(harness, owner.personId, owner.projectId), true);
    harness.platform.close();
  });

  it("exposes no proposal internals through the dashboard projection", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "draft-only");
    addVersion(harness, owner, "draft-only-2");

    const summary = harness.platform.projects.listAccessibleProjects(owner.personId)[0];
    assert.ok(summary);
    assert.equal(summary.hasPublishedProposal, false);
    // The only proposal-related key is the boolean signal; a draft cannot leak.
    assert.deepEqual(
      Object.keys(summary).filter((key) => key.toLowerCase().includes("proposal")),
      ["hasPublishedProposal"],
    );
    assert.equal(JSON.stringify(summary).includes("draft-only"), false);
    harness.platform.close();
  });
});

describe("customer proposal route and privacy", () => {
  it("maps unauthenticated and inaccessible reads to the not-found/redirect codes", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    startProposal(harness, owner, "v1");
    publish(harness, owner, 1);

    // The page guard redirects on `unauthenticated`; unauthenticated reads throw it.
    assert.throws(
      () => readProposal(harness, "unknown-person", owner.reference),
      (error: unknown) => expectCode(error, "unauthenticated"),
    );
    // The page renders notFound() for the codes `isMissing` treats as missing:
    // an ordinary member without access (forbidden) and an unknown reference.
    assert.throws(
      () => readProposal(harness, member.personId, owner.reference),
      (error: unknown) => expectCode(error, "forbidden"),
    );
    assert.throws(
      () => readProposal(harness, owner.personId, "PRJ-NOT-A-REFERENCE"),
      (error: unknown) => expectCode(error, "not_found"),
    );
    harness.platform.close();
  });

  it("reads a customer-safe proposal only, and the page stays read-only", async () => {
    const harness = await reviewHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "v1");
    publish(harness, owner, 1);

    const view = readProposal(harness, owner.personId, owner.reference);
    assert.ok(view);
    assert.deepEqual(Object.keys(view).sort(), PROPOSAL_VIEW_KEYS);

    // The page itself is a read-only server component: no form, no button, no
    // POST handler, and it uses the customer read seam rather than the Founder
    // authoring service. Mirrors the source-scan approach in security.test.ts;
    // the repository has no route-rendering harness, so this is the narrowest
    // route-level check consistent with the existing pattern.
    const pagePath = join(
      __dirname,
      "..",
      "..",
      "app",
      "dashboard",
      "projects",
      "[reference]",
      "proposal",
      "page.tsx",
    );
    const source = readFileSync(pagePath, "utf8");
    assert.ok(source.includes("export default async function"));
    assert.ok(!source.includes("<form"), "the proposal page must have no form");
    assert.ok(!source.includes("<button"), "the proposal page must have no button");
    assert.ok(!/method\s*=\s*["']post["']/i.test(source));
    assert.ok(!/\bexport\s+(async\s+)?function\s+POST\b/.test(source));
    assert.ok(!source.includes("platform.proposals"));
    assert.ok(source.includes("customerProposals"));

    const dashboardSource = readFileSync(
      join(__dirname, "..", "..", "app", "dashboard", "page.tsx"),
      "utf8",
    );
    assert.ok(
      dashboardSource.includes("project.hasPublishedProposal"),
      "the dashboard link must be gated on hasPublishedProposal",
    );
    assert.ok(dashboardSource.includes("/proposal"));
    harness.platform.close();
  });
});
