/**
 * Proposal foundation.
 *
 * Exercises the approved Proposal Foundation ADR against the real services, real
 * SQL, and the real authorization helpers. Only the passage of time and the email
 * transport are controlled.
 *
 * The properties asserted here are the ones the ADR makes load-bearing: one
 * proposal per project; immutable append-only versions; deterministic gapless
 * numbering; Founder-only authorization; drafts never reaching a customer
 * projection; publication as an explicit server-authorized act; audit metadata
 * that identifies the action without copying the commercial content; the existing
 * customer stage, customer projections, and customer access rules left untouched;
 * and malformed status values rejected on the server.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isProposalVersionStatus } from "../lib/platform/domain";
import { isPlatformError } from "../lib/platform/errors";
import {
  readOptionalValidUntil,
  readProposalContent,
  readVersionNumber,
} from "../lib/platform/proposal-form";
import { emailHash } from "../lib/platform/secrets";
import {
  MEMBER_EMAIL,
  OTHER_EMAIL,
  OWNER_EMAIL,
  addOrdinaryMember,
  createTestPlatform,
  signIn,
  signUpAsOwner,
  signUpAsOwnerWithProject,
  type TestPlatform,
} from "./support/harness";

const FOUNDER_HASH = emailHash(OWNER_EMAIL);

async function proposalHarness(): Promise<TestPlatform> {
  return createTestPlatform({ config: { founderEmailHashes: [FOUNDER_HASH] } });
}

async function ownerWithSubmittedProject(
  harness: TestPlatform,
  email = OWNER_EMAIL,
  organizationName = "First Synthetic Org",
) {
  const owner = await signUpAsOwnerWithProject(harness, email, organizationName);
  harness.platform.intake.submit(owner.personId, owner.projectId);
  const project = harness.platform.store.findProject(owner.projectId);
  assert.ok(project);
  return { ...owner, reference: project.reference };
}

const PROPOSAL_CONTENT = {
  summary: "Synthetic summary",
  scopeIncluded: "Included in scope",
  scopeExcluded: "Excluded from scope",
  deliverables: "Deliverables list",
  timeline: "Timeline here",
  assumptions: "Assumptions here",
  commercialTerms: "Commercial terms here",
} as const satisfies Record<string, string>;

/** A project-owning Founder, as returned by `ownerWithSubmittedProject`. */
type Founder = { personId: string; projectId: string };

/** Opens the proposal with its first (draft) version. */
function startProposal(harness: TestPlatform, owner: Founder): void {
  harness.platform.proposals.createProposal({
    personId: owner.personId,
    projectId: owner.projectId,
    content: PROPOSAL_CONTENT,
  });
}

/** Appends the next draft version. */
function addVersion(harness: TestPlatform, owner: Founder): void {
  harness.platform.proposals.createVersion({
    personId: owner.personId,
    projectId: owner.projectId,
    content: PROPOSAL_CONTENT,
  });
}

/** Publishes one version. */
function publish(harness: TestPlatform, owner: Founder, versionNumber: number): void {
  harness.platform.proposals.publishVersion({
    personId: owner.personId,
    projectId: owner.projectId,
    versionNumber,
  });
}

/** Reads the Founder proposal view for the project. */
function proposalView(harness: TestPlatform, owner: Founder) {
  return harness.platform.proposals.read(owner.personId, owner.projectId);
}

describe("proposal authorization", () => {
  it("rejects an unknown person with no session", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    assert.throws(
      () => harness.platform.proposals.read("person-who-does-not-exist", owner.projectId),
      (error: unknown) => isPlatformError(error) && error.code === "unauthenticated",
    );
    harness.platform.close();
  });

  it("rejects a valid customer session", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);
    const customer = await signIn(harness, MEMBER_EMAIL);

    assert.throws(
      () => harness.platform.proposals.read(customer.person.id, owner.projectId),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
    harness.platform.close();
  });

  it("rejects an organization owner/admin without the capability", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);
    const admin = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");

    assert.throws(
      () => harness.platform.proposals.read(admin.personId, owner.projectId),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
    // The Founder still reads the same project.
    assert.ok(harness.platform.proposals.read(owner.personId, owner.projectId));
    harness.platform.close();
  });

  it("allows a Founder to create a proposal for an existing project", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    const view = harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });
    assert.ok(view.proposalId);
    assert.equal(view.projectReference, owner.reference);
    assert.equal(view.versions.length, 1);
    assert.equal(view.versions[0]?.status, "draft");
    assert.equal(view.versions[0]?.versionNumber, 1);
    assert.equal(view.latestVersionNumber, 1);
    assert.equal(view.latestVersionStatus, "draft");
    assert.ok(view.latestDraft);
    assert.equal(view.latestDraft.versionNumber, 1);
    assert.equal(view.publishedVersionNumber, null);
    harness.platform.close();
  });

  it("rejects a proposal for a nonexistent project", async () => {
    const harness = await proposalHarness();
    const founder = await signIn(harness, OWNER_EMAIL);

    assert.throws(
      () =>
        harness.platform.proposals.createProposal({
          personId: founder.person.id,
          projectId: "PRJ-NOPE00",
          content: PROPOSAL_CONTENT,
        }),
      (error: unknown) => isPlatformError(error) && error.code === "not_found",
    );
    harness.platform.close();
  });
});

describe("proposal versioning", () => {
    it("creates the initial version correctly", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    const view = harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });

    const version = view.versions[0];
    assert.ok(version);
    assert.equal(version.summary, PROPOSAL_CONTENT.summary);
    assert.equal(version.scopeIncluded, PROPOSAL_CONTENT.scopeIncluded);
    assert.equal(version.scopeExcluded, PROPOSAL_CONTENT.scopeExcluded);
    assert.equal(version.deliverables, PROPOSAL_CONTENT.deliverables);
    assert.equal(version.timeline, PROPOSAL_CONTENT.timeline);
    assert.equal(version.assumptions, PROPOSAL_CONTENT.assumptions);
    assert.equal(version.commercialTerms, PROPOSAL_CONTENT.commercialTerms);
    assert.equal(version.validUntil, null);
    assert.equal(version.status, "draft");
    assert.equal(version.publishedAt, null);
    harness.platform.close();
  });

  it("keeps historical version content unchanged after a later version is created", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    const first = harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });
    const firstVersion = first.versions[0]!;

    harness.platform.proposals.createVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      content: {
        ...PROPOSAL_CONTENT,
        summary: "Changed summary",
      },
    });

    const stored = harness.platform.store.findProposalVersionById(firstVersion.id);
    assert.ok(stored);
    assert.equal(stored.summary, PROPOSAL_CONTENT.summary);
    assert.equal(stored.scopeIncluded, PROPOSAL_CONTENT.scopeIncluded);
    assert.equal(stored.summary, "Synthetic summary");
    harness.platform.close();
  });
  it("publishes the first version and makes it available", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    const creation = harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });

    // The creation view and the direct store lookup must agree on identity.
    const proposal = harness.platform.store.findProposalByProject(owner.projectId);
    assert.ok(proposal, "proposal row should exist after createProposal");
    assert.equal(proposal.id, creation.proposalId);

    // Version 1 was written as a draft; nothing has published it.
    const versions = harness.platform.store.listProposalVersions(proposal.id);
    assert.ok(
      versions.length >= 1,
      `expected at least one version; got ${versions.length}; proposal=${proposal.id}`,
    );
    const firstCreated = versions[0]!;
    assert.ok(firstCreated, "versions[0] should be defined");
    assert.equal(firstCreated.publishedAt, null);
    assert.equal(firstCreated.status, "draft");

    // The by-id lookup also returns the same row.
    const byId = harness.platform.store.findProposalVersionById(firstCreated.id);
    assert.ok(byId, "findProposalVersionById should return the version we just enumerated");
    assert.equal(byId.id, firstCreated.id);

    harness.platform.proposals.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
    });

    // After publication the stored version reads back as published, and the view
    // reports the same publish instant that the store recorded.
    const after = harness.platform.store.findProposalVersionById(firstCreated.id);
    assert.ok(after);
    assert.equal(after.status, "published");
    assert.ok(after.publishedAt !== null);

    const view = harness.platform.proposals.read(owner.personId, owner.projectId);
    assert.equal(view.publishedVersionNumber, 1);
    assert.equal(view.publishedVersionId, firstCreated.id);
    assert.equal(view.publishedVersionPublishedAt, after.publishedAt);
    assert.equal(view.versions[0]?.status, "published");
    harness.platform.close();
  });

  it("numbers versions deterministically", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });
    harness.platform.proposals.createVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });
    harness.platform.proposals.createVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      content: {
        ...PROPOSAL_CONTENT,
        deliverables: "A third deliverable set",
      },
    });

    const view = harness.platform.proposals.read(owner.personId, owner.projectId);
    assert.equal(view.versions.length, 3);
    assert.equal(view.versions[0]?.versionNumber, 1);
    assert.equal(view.versions[1]?.versionNumber, 2);
    assert.equal(view.versions[2]?.versionNumber, 3);
    assert.equal(view.latestVersionNumber, 3);
    assert.equal(view.latestVersionStatus, "draft");
    assert.ok(view.latestDraft);
    assert.equal(view.latestDraft.versionNumber, 3);
    harness.platform.close();
  });

  it("keeps drafts internal", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });

    const view = harness.platform.proposals.read(owner.personId, owner.projectId);
    assert.equal(view.versions.length, 1);
    assert.equal(view.versions[0]?.status, "draft");
    assert.equal(view.publishedVersionNumber, null);
    harness.platform.close();
  });

  it("publishes a version explicitly and server-authorized", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });

    harness.platform.proposals.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
    });

    const view = harness.platform.proposals.read(owner.personId, owner.projectId);
    assert.equal(view.publishedVersionNumber, 1);
    assert.equal(view.versions[0]?.status, "published");
    // The published-at timestamp is written by the store, not inferred by the view.
    assert.ok(view.versions[0]!.publishedAt !== null);
    harness.platform.close();
  });

  it("rejects an invalid publish request for a nonexistent version", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });

    assert.throws(
      () =>
        harness.platform.proposals.publishVersion({
          personId: owner.personId,
          projectId: owner.projectId,
          versionNumber: 99,
        }),
      (error: unknown) => isPlatformError(error) && error.code === "not_found",
    );
    harness.platform.close();
  });
});

//
// `latestDraft` is the ADR's "current draft" distinction (§3): the highest-
// numbered draft version, independent of whether newer versions have been
// published. A newer published version must not hide an older draft, so this is
// the case the previous latest-or-previous implementation got wrong.
//
describe("proposal latest draft projection", () => {
  it("reports an older draft when newer versions are published", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    startProposal(harness, owner); // v1 draft
    addVersion(harness, owner); // v2 draft
    publish(harness, owner, 2);
    addVersion(harness, owner); // v3 draft
    publish(harness, owner, 3);

    const view = proposalView(harness, owner);
    assert.deepEqual(
      view.versions.map((version) => `${version.versionNumber}:${version.status}`),
      ["1:draft", "2:published", "3:published"],
    );
    // v1 is still a draft; the two later published versions must not hide it.
    assert.equal(view.latestDraft?.versionNumber, 1);
    assert.equal(view.latestDraft?.status, "draft");
    // Published-version selection is unaffected: newest published wins.
    assert.equal(view.publishedVersionNumber, 3);
    harness.platform.close();
  });

  it("reports the only draft as the latest draft", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    startProposal(harness, owner); // v1 draft

    const view = proposalView(harness, owner);
    assert.equal(view.latestDraft?.versionNumber, 1);
    assert.equal(view.publishedVersionNumber, null);
    harness.platform.close();
  });

  it("reports a newer draft over an older published version", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    startProposal(harness, owner); // v1 draft
    publish(harness, owner, 1);
    addVersion(harness, owner); // v2 draft

    const view = proposalView(harness, owner);
    assert.equal(view.latestDraft?.versionNumber, 2);
    assert.equal(view.latestDraft?.status, "draft");
    assert.equal(view.publishedVersionNumber, 1);
    harness.platform.close();
  });

  it("reports no draft when every version is published", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    startProposal(harness, owner); // v1 draft
    publish(harness, owner, 1);
    addVersion(harness, owner); // v2 draft
    publish(harness, owner, 2);

    const view = proposalView(harness, owner);
    assert.equal(view.latestDraft, null);
    assert.equal(view.publishedVersionNumber, 2);
    harness.platform.close();
  });
});

describe("proposal customer boundary", () => {
  it("leaves the customer projection and stage unchanged", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    const before = harness.platform.projects.getCustomerProject(
      owner.personId,
      owner.projectId,
    );

    harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });
    harness.platform.proposals.createVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      content: { ...PROPOSAL_CONTENT, summary: "A revised summary" },
    });
    harness.platform.proposals.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
    });

    const after = harness.platform.projects.getCustomerProject(
      owner.personId,
      owner.projectId,
    );
    // The customer projection is byte-for-byte what it was before any proposal
    // work: stage, fields, and ordering all unchanged.
    assert.deepEqual(after, before);

    // Nothing a customer can read carries proposal state or proposal text.
    const serialized = JSON.stringify(after);
    assert.equal(serialized.includes("proposal"), false);
    assert.equal(serialized.includes("Synthetic summary"), false);
    assert.equal(serialized.includes("A revised summary"), false);
    assert.equal(serialized.includes("Commercial terms here"), false);
    harness.platform.close();
  });

  it("does not expose one project's proposal through another project", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);
    harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });

    // A second project in the same organization has no proposal of its own.
    const second = harness.platform.projects.createProject({
      personId: owner.personId,
      organizationId: owner.organizationId,
    });
    const secondView = harness.platform.proposals.read(
      owner.personId,
      second.project.id,
    );
    assert.equal(secondView.proposalId, null);
    assert.equal(secondView.versions.length, 0);

    // The first project's proposal is still reachable only through its own id.
    const firstView = harness.platform.proposals.read(owner.personId, owner.projectId);
    assert.equal(firstView.projectReference, owner.reference);
    assert.equal(firstView.versions.length, 1);
    assert.notEqual(firstView.projectReference, second.project.reference);
    harness.platform.close();
  });

  it("leaves customer project access rules unchanged", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);
    const member = await addOrdinaryMember(
      harness,
      owner.organizationId,
      MEMBER_EMAIL,
    );

    // An ordinary member holds no access to the project by default.
    assert.deepEqual(
      harness.platform.projects.listAccessibleProjects(member.personId),
      [],
    );

    harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });
    harness.platform.proposals.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
    });

    // Proposal work grants nothing and revokes nothing for a customer.
    assert.deepEqual(
      harness.platform.projects.listAccessibleProjects(member.personId),
      [],
    );
    assert.equal(
      harness.platform.projects.listAccessibleProjects(owner.personId).length,
      1,
    );
    harness.platform.close();
  });
});

describe("proposal audit", () => {
  it("records material actions without copying proposal content", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);
    harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });
    harness.platform.proposals.createVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      content: { ...PROPOSAL_CONTENT, summary: "A revised summary" },
    });
    harness.platform.proposals.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
    });

    const events = harness.platform.store.listAuditEventsForProject(
      owner.projectId,
      50,
    );
    const types = events.map((event) => event.type);
    assert.ok(types.includes("proposal.created"));
    assert.ok(types.includes("proposal_version.created"));
    assert.ok(types.includes("proposal_version.published"));

    // Metadata identifies the action but is never a second copy of the document.
    const proposalEvents = events.filter((event) =>
      event.type.startsWith("proposal"),
    );
    assert.ok(proposalEvents.length >= 4);
    for (const event of proposalEvents) {
      const metadata = JSON.stringify(event.metadata ?? null);
      assert.equal(metadata.includes("Synthetic summary"), false);
      assert.equal(metadata.includes("A revised summary"), false);
      assert.equal(metadata.includes("Commercial terms here"), false);
    }
    harness.platform.close();
  });

  it("keeps historical versions readable after later versions and publication", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    const created = harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });
    const firstId = created.versions[0]!.id;

    harness.platform.proposals.createVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      content: { ...PROPOSAL_CONTENT, summary: "A revised summary" },
    });
    harness.platform.proposals.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
    });

    // Version 1 is still readable, with its original text and its publish instant.
    const stored = harness.platform.store.findProposalVersionById(firstId);
    assert.ok(stored);
    assert.equal(stored.versionNumber, 1);
    assert.equal(stored.summary, PROPOSAL_CONTENT.summary);
    assert.equal(stored.status, "published");
    assert.ok(stored.publishedAt !== null);
    harness.platform.close();
  });
});

//
// Transaction boundaries. The publication decision and the one-proposal-per-
// project check now live inside the store transaction, so these tests assert the
// observable consequences: a repeat publish adds no audit event and keeps the
// original instant, and a duplicate creation returns the intended validation
// error rather than a raw uniqueness failure. A true concurrent-interleaving test
// is impractical against a single in-memory connection; what matters is that the
// decision and its audit write happen in the same transaction, which is what the
// idempotent repeat exercises.
//
describe("proposal transaction boundaries", () => {
  function publishedEventCount(harness: TestPlatform, projectId: string): number {
    return harness.platform.store
      .listAuditEventsForProject(projectId, 50)
      .filter((event) => event.type === "proposal_version.published").length;
  }

  it("rejects a second proposal for the same project with the intended validation error", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });

    assert.throws(
      () =>
        harness.platform.proposals.createProposal({
          personId: owner.personId,
          projectId: owner.projectId,
          content: PROPOSAL_CONTENT,
        }),
      (error: unknown) =>
        isPlatformError(error) &&
        error.code === "invalid_input" &&
        /already has a proposal/.test(error.message),
    );

    // The database unique constraint was never the path that fired: the
    // transaction read the committed proposal and the service returned its own
    // validation error. Exactly one proposal and one version remain.
    const proposal = harness.platform.store.findProposalByProject(owner.projectId);
    assert.ok(proposal);
    assert.equal(harness.platform.store.listProposalVersions(proposal.id).length, 1);
    harness.platform.close();
  });

  it("records exactly one publication audit event", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });
    assert.equal(publishedEventCount(harness, owner.projectId), 0);

    harness.platform.proposals.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
    });
    assert.equal(publishedEventCount(harness, owner.projectId), 1);
    harness.platform.close();
  });

  it("is idempotent and writes no audit event when the version is already published", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });
    harness.platform.proposals.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
    });
    assert.equal(publishedEventCount(harness, owner.projectId), 1);

    // The decision now happens inside the transaction: a second publish reads the
    // version as already published, publishes nothing, and records no second event.
    harness.platform.proposals.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
    });
    assert.equal(publishedEventCount(harness, owner.projectId), 1);

    // The read view still reports a single published version.
    const view = harness.platform.proposals.read(owner.personId, owner.projectId);
    assert.equal(view.publishedVersionNumber, 1);
    harness.platform.close();
  });

  it("preserves the publish instant and historical content across a repeat publish", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);

    const created = harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });
    const versionId = created.versions[0]!.id;

    harness.platform.proposals.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
    });
    const firstPublish = harness.platform.store.findProposalVersionById(versionId);
    assert.ok(firstPublish);
    assert.ok(firstPublish.publishedAt !== null);

    // Move the clock so a rewrite of the instant would be observable.
    harness.clock.advance(60 * 60 * 1000);
    harness.platform.proposals.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
    });

    const after = harness.platform.store.findProposalVersionById(versionId);
    assert.ok(after);
    assert.equal(after.publishedAt, firstPublish.publishedAt);
    assert.equal(after.status, "published");
    assert.equal(after.summary, PROPOSAL_CONTENT.summary);
    assert.equal(after.scopeIncluded, PROPOSAL_CONTENT.scopeIncluded);
    assert.equal(after.commercialTerms, PROPOSAL_CONTENT.commercialTerms);
    harness.platform.close();
  });
});

describe("proposal data integrity", () => {
  it("treats only draft and published as valid version status values", () => {
    assert.equal(isProposalVersionStatus("draft"), true);
    assert.equal(isProposalVersionStatus("published"), true);
    assert.equal(isProposalVersionStatus("archived"), false);
    assert.equal(isProposalVersionStatus(""), false);
    assert.equal(isProposalVersionStatus(null), false);
    assert.equal(isProposalVersionStatus(1), false);
  });

  it("rejects an unsupported version status at the store", async () => {
    const harness = await proposalHarness();
    const owner = await ownerWithSubmittedProject(harness);
    const view = harness.platform.proposals.createProposal({
      personId: owner.personId,
      projectId: owner.projectId,
      content: PROPOSAL_CONTENT,
    });

    // The closed set is enforced by the database, not only by the service, so an
    // unsupported value cannot be persisted even if it reached the adapter.
    assert.throws(() =>
      harness.platform.store.createProposalVersion({
        id: `${view.proposalId}-bad`,
        proposalId: view.proposalId!,
        versionNumber: 2,
        status: "archived" as never,
        ...PROPOSAL_CONTENT,
        validUntil: null,
        createdByPersonId: owner.personId,
        createdAt: harness.clock.now(),
        publishedAt: null,
      }),
    );
    harness.platform.close();
  });
});

//
// The route boundary. This is the layer a browser form actually reaches, and the
// two defects that motivated these tests lived here rather than in the service:
// a version-number regex with the wrong escaping, and a `validUntil` value parsed
// as a number when `datetime-local` submits a date string. The service tests
// stayed green through both, which is exactly why the boundary needs its own.
//
describe("proposal form parsing", () => {
  const CONTENT = {
    summary: "Synthetic summary",
    scopeIncluded: "Included in scope",
    scopeExcluded: "Excluded from scope",
    deliverables: "Deliverables list",
    timeline: "Timeline here",
    assumptions: "Assumptions here",
    commercialTerms: "Commercial terms here",
  };

  function form(values: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) {
      data.append(key, value);
    }
    return data;
  }

  it("accepts a decimal version number such as \"1\"", () => {
    assert.equal(readVersionNumber(form({ versionNumber: "1" })), 1);
    assert.equal(readVersionNumber(form({ versionNumber: "12" })), 12);
    assert.equal(readVersionNumber(form({ versionNumber: " 3 " })), 3);
  });

  it("rejects a version number that is not a decimal integer", () => {
    for (const invalid of ["", "abc", "-1", "1.5", "1e2", "0x2", "1 2"]) {
      assert.throws(
        () => readVersionNumber(form({ versionNumber: invalid })),
        (error: unknown) => isPlatformError(error) && error.code === "invalid_input",
        `expected \"${invalid}\" to be rejected`,
      );
    }
    // A missing field is refused too, rather than coerced to a number.
    assert.throws(() => readVersionNumber(form({})));
  });

  it("converts a datetime-local value to the expected timestamp", () => {
    // What the input actually submits: no timezone, therefore local time.
    assert.equal(
      readOptionalValidUntil(form({ validUntil: "2026-10-06T14:30" })),
      new Date(2026, 9, 6, 14, 30, 0, 0).getTime(),
    );
  });

  it("treats an empty or missing validity date as no expiry", () => {
    assert.equal(readOptionalValidUntil(form({ validUntil: "" })), null);
    assert.equal(readOptionalValidUntil(form({ validUntil: "   " })), null);
    assert.equal(readOptionalValidUntil(form({})), null);
  });

  it("rejects an unparseable validity date", () => {
    assert.throws(
      () => readOptionalValidUntil(form({ validUntil: "not-a-date" })),
      (error: unknown) => isPlatformError(error) && error.code === "invalid_input",
    );
  });

  it("reads the full content block for a version, trimmed", () => {
    const content = readProposalContent(
      form({ ...CONTENT, summary: "  Synthetic summary  ", validUntil: "2026-10-06T14:30" }),
    );
    assert.equal(content.summary, CONTENT.summary);
    assert.equal(content.scopeIncluded, CONTENT.scopeIncluded);
    assert.equal(content.scopeExcluded, CONTENT.scopeExcluded);
    assert.equal(content.deliverables, CONTENT.deliverables);
    assert.equal(content.timeline, CONTENT.timeline);
    assert.equal(content.assumptions, CONTENT.assumptions);
    assert.equal(content.commercialTerms, CONTENT.commercialTerms);
    assert.equal(content.validUntil, new Date(2026, 9, 6, 14, 30, 0, 0).getTime());
  });

  it("rejects a missing or whitespace-only required content field", () => {
    assert.throws(
      () => readProposalContent(form({ ...CONTENT, summary: "   " })),
      (error: unknown) => isPlatformError(error) && error.code === "invalid_input",
    );
    const { timeline: _omitted, ...withoutTimeline } = CONTENT;
    assert.throws(
      () => readProposalContent(form(withoutTimeline)),
      (error: unknown) => isPlatformError(error) && error.code === "invalid_input",
    );
  });
});

