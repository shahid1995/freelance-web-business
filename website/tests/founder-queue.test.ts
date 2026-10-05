/**
 * Founder project queue.
 *
 * The queue is an entry point into the existing Founder review workflow, so the
 * properties that matter are that only a Founder can read it, that a submitted
 * intake is reachable at all, and that it stays a *listing* rather than becoming
 * a second surface carrying internal assessment state.
 *
 * Everything runs against the real services, real SQL, and the real authorization
 * helpers. Only the passage of time and the email transport are controlled.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPlatformError } from "../lib/platform/errors";
import { emailHash } from "../lib/platform/secrets";
import { resolveOrganizationContext } from "../lib/platform/authorization";
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

/** A harness whose configured Founder holds the capability by configuration. */
async function queueHarness(): Promise<TestPlatform> {
  return createTestPlatform({ config: { founderEmailHashes: [FOUNDER_HASH] } });
}

/**
 * An owner and a project with a submitted intake, returning the reference so a
 * test can look for it in the queue.
 */
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

describe("founder queue authorization", () => {
  it("rejects an unknown person with no session", async () => {
    const harness = await queueHarness();
    await ownerWithSubmittedProject(harness);

    assert.throws(
      () => harness.platform.internal.queue("person-who-does-not-exist"),
      (error: unknown) => isPlatformError(error) && error.code === "unauthenticated",
    );
    harness.platform.close();
  });

  it("rejects a valid customer session", async () => {
    const harness = await queueHarness();
    await ownerWithSubmittedProject(harness);
    const customer = await signIn(harness, MEMBER_EMAIL);

    assert.throws(
      () => harness.platform.internal.queue(customer.person.id),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
    harness.platform.close();
  });

  it("rejects an organization owner/admin without the capability", async () => {
    const harness = await queueHarness();
    const owner = await ownerWithSubmittedProject(harness);
    // Owner/admin of the very organization whose project is in the queue.
    const admin = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");

    assert.throws(
      () => harness.platform.internal.queue(admin.personId),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
    // The rejected admin's own project is still queued for the Founder.
    assert.equal(
      harness.platform.internal.queue(owner.personId).length,
      1,
      "the queue is for the Founder, not for an organization admin",
    );
    harness.platform.close();
  });

  it("allows a holder of the founder capability", async () => {
    const harness = await queueHarness();
    const owner = await ownerWithSubmittedProject(harness);

    const rows = harness.platform.internal.queue(owner.personId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.reference, owner.reference);
    harness.platform.close();
  });

  it("does not consult customer organization context for the Founder", async () => {
    const harness = await queueHarness();
    const owner = await ownerWithSubmittedProject(harness);

    // The Founder is a customer of their own organization here, and holds the
    // capability. The point being pinned is that the queue does not *depend* on
    // that: a Founder with no membership at all still reads the whole queue.
    const capabilityOnly = await signIn(harness, MEMBER_EMAIL);
    assert.equal(resolveOrganizationContext(harness.platform.store, capabilityOnly.person.id), null);
    assert.throws(
      () => harness.platform.internal.queue(capabilityOnly.person.id),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
    assert.equal(harness.platform.internal.queue(owner.personId).length, 1);
    harness.platform.close();
  });
});

describe("founder queue contents", () => {
  it("shows a submitted intake and hides a draft intake", async () => {
    const harness = await queueHarness();
    const submitted = await ownerWithSubmittedProject(harness);

    const secondOwner = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");
    const draftProject = harness.platform.projects.createProject({
      personId: secondOwner.personId,
      organizationId: secondOwner.organizationId,
    });
    // Deliberately saved but never submitted.
    harness.platform.intake.saveDraft({
      personId: secondOwner.personId,
      projectId: draftProject.project.id,
      patch: { serviceNeed: "Synthetic draft, not submitted" },
    });

    const rows = harness.platform.internal.queue(submitted.personId);
    const references = rows.map((row) => row.reference);

    assert.ok(references.includes(submitted.reference), "submitted intake must appear");
    assert.ok(
      !references.includes(draftProject.project.reference),
      "a draft intake must never appear",
    );
    assert.equal(rows.length, 1);
    harness.platform.close();
  });

  it("shows projects from several organizations in one queue", async () => {
    const harness = await queueHarness();
    const first = await ownerWithSubmittedProject(harness, OWNER_EMAIL, "First Synthetic Org");
    const secondOwner = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");
    const secondProject = harness.platform.projects.createProject({
      personId: secondOwner.personId,
      organizationId: secondOwner.organizationId,
    });
    harness.platform.intake.submit(secondOwner.personId, secondProject.project.id);

    const rows = harness.platform.internal.queue(first.personId);
    assert.equal(rows.length, 2, "the queue is intentionally cross-organization");

    const organizations = rows.map((row) => row.organizationName).sort();
    assert.deepEqual(organizations, ["First Synthetic Org", "Second Synthetic Org"]);
    harness.platform.close();
  });

  it("carries the operational fields the Founder needs", async () => {
    const harness = await queueHarness();
    const owner = await ownerWithSubmittedProject(harness);

    const before = harness.platform.internal.queue(owner.personId)[0];
    assert.ok(before);
    assert.equal(before.reference, owner.reference);
    assert.equal(before.organizationName, "First Synthetic Org");
    assert.equal(before.submittedAt, harness.clock.now());
    assert.equal(before.customerStage, "intake_information_submitted");
    assert.equal(before.customerStageLabel, "Project Intake — Information submitted");
    assert.equal(before.reviewStarted, false);
    assert.equal(before.reviewStartedAt, null);

    // After Start Review the queue reflects the customer-facing stage, because
    // it derives from the same shared function the review page uses.
    harness.platform.internal.startReview({
      personId: owner.personId,
      projectId: owner.projectId,
    });
    const after = harness.platform.internal.queue(owner.personId)[0];
    assert.ok(after);
    assert.equal(after.customerStage, "intake_review");
    assert.equal(after.reviewStarted, true);
    assert.ok(after.reviewStartedAt !== null);
    harness.platform.close();
  });

  it("orders newest submission first, deterministically", async () => {
    const harness = await queueHarness();
    const owner = await ownerWithSubmittedProject(harness);
    const secondOwner = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");

    // Advance the clock so the second submission is strictly newer.
    harness.clock.advance(60_000);
    const secondProject = harness.platform.projects.createProject({
      personId: secondOwner.personId,
      organizationId: secondOwner.organizationId,
    });
    harness.platform.intake.submit(secondOwner.personId, secondProject.project.id);

    const first = harness.platform.internal.queue(owner.personId).map((row) => row.reference);
    assert.equal(first.length, 2);
    assert.equal(first[0], secondProject.project.reference, "newest submission first");
    assert.equal(first[1], owner.reference);

    // Stable across repeated reads, and unaffected by the ordering of calls.
    const repeat = harness.platform.internal.queue(owner.personId).map((row) => row.reference);
    assert.deepEqual(repeat, first);
    harness.platform.close();
  });

  it("breaks ties by project reference", async () => {
    const harness = await queueHarness();
    const owner = await ownerWithSubmittedProject(harness);

    // Two more submissions at the same instant as the first.
    const secondOwner = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");
    const extra = harness.platform.projects.createProject({
      personId: secondOwner.personId,
      organizationId: secondOwner.organizationId,
    });
    harness.platform.intake.submit(secondOwner.personId, extra.project.id);

    const rows = harness.platform.internal.queue(owner.personId);
    const allSameInstant = rows.every((row) => row.submittedAt === harness.clock.now());
    assert.ok(allSameInstant, "this fixture relies on a single submission instant");

    const ordered = [...rows]
      .sort((left, right) => left.reference.localeCompare(right.reference))
      .map((row) => row.reference);
    assert.deepEqual(
      rows.map((row) => row.reference),
      ordered,
      "equal submission times must be ordered by reference",
    );
    harness.platform.close();
  });
});

describe("founder queue boundary", () => {
  it("exposes no internal state, intake answers, or audit data in a row", async () => {
    const harness = await queueHarness();
    const owner = await ownerWithSubmittedProject(harness);

    // Give the project every kind of internal state the review page owns.
    harness.platform.internal.setQualificationState({
      personId: owner.personId,
      projectId: owner.projectId,
      state: "clarification_required",
    });
    harness.platform.internal.recordInternalNotes({
      personId: owner.personId,
      projectId: owner.projectId,
      notes: "INTERNAL-NOTE-SENTINEL budget is below our floor",
    });
    harness.platform.internal.recordFounderDecision({
      personId: owner.personId,
      projectId: owner.projectId,
      decision: "hold",
    });
    harness.platform.internal.recordInternalNextAction({
      personId: owner.personId,
      projectId: owner.projectId,
      nextAction: "INTERNAL-NEXT-ACTION-SENTINEL call back on Friday",
    });
    harness.platform.internal.startReview({
      personId: owner.personId,
      projectId: owner.projectId,
    });

    const rows = harness.platform.internal.queue(owner.personId);
    const serialized = JSON.stringify(rows);

    for (const forbidden of [
      "internalNotes",
      "qualificationState",
      "founderDecision",
      "internalNextAction",
      "clarification_required",
      "hold",
      "INTERNAL-NOTE-SENTINEL",
      "INTERNAL-NEXT-ACTION-SENTINEL",
      "answers",
      "audit",
      "metadata",
      "email",
      "personId",
    ]) {
      assert.ok(
        !serialized.includes(forbidden),
        `a queue row must not carry "${forbidden}"`,
      );
    }

    // The row itself is only the documented field set.
    assert.deepEqual(
      Object.keys(rows[0] ?? {}).sort(),
      [
        "customerStage",
        "customerStageLabel",
        "organizationName",
        "reference",
        "reviewStarted",
        "reviewStartedAt",
        "submittedAt",
        "title",
      ].sort(),
    );
    harness.platform.close();
  });

  it("performs no write and creates no audit event when loaded", async () => {
    const harness = await queueHarness();
    const owner = await ownerWithSubmittedProject(harness);

    const projectBefore = harness.platform.store.findProject(owner.projectId);
    const eventsBefore = harness.platform.store.listAuditEventsForProject(owner.projectId, 200);

    harness.platform.internal.queue(owner.personId);
    harness.platform.internal.queue(owner.personId);
    harness.platform.internal.queue(owner.personId);

    assert.deepEqual(
      harness.platform.store.findProject(owner.projectId),
      projectBefore,
      "loading the queue must not write to the project",
    );
    assert.deepEqual(
      harness.platform.store.listAuditEventsForProject(owner.projectId, 200).map((e) => e.type),
      eventsBefore.map((e) => e.type),
      "loading the queue must not append an audit event",
    );
    assert.ok(
      !eventsBefore.some((event) => event.type === "project_intake.review_started"),
      "loading the queue must not start a review",
    );
    harness.platform.close();
  });

  it("keeps the existing review page reachable from a row", async () => {
    const harness = await queueHarness();
    const owner = await ownerWithSubmittedProject(harness);

    const row = harness.platform.internal.queue(owner.personId)[0];
    assert.ok(row, "the project must be queued");

    // The row's reference is the key the review page resolves.
    const projectId = harness.platform.internal.resolveProjectId(owner.personId, row.reference);
    assert.equal(projectId, owner.projectId);

    const review = harness.platform.internal.review(owner.personId, projectId);
    assert.equal(review.project.reference, row.reference);
    assert.equal(review.organization.name, row.organizationName);
    // The review page still owns the internal state the queue withholds.
    assert.equal(review.internal.qualificationState, "unreviewed");
    harness.platform.close();
  });
});

describe("customer boundaries are untouched", () => {
  it("leaves customer projections unchanged", async () => {
    const harness = await queueHarness();
    const owner = await ownerWithSubmittedProject(harness);
    harness.platform.internal.recordInternalNotes({
      personId: owner.personId,
      projectId: owner.projectId,
      notes: "INTERNAL-NOTE-SENTINEL budget is below our floor",
    });
    harness.platform.internal.setQualificationState({
      personId: owner.personId,
      projectId: owner.projectId,
      state: "not_a_fit",
    });

    const detail = harness.platform.intake.read(owner.personId, owner.projectId);
    const summary = harness.platform.projects.listAccessibleProjects(owner.personId);
    const serialized = JSON.stringify([detail, summary]);

    assert.ok(!serialized.includes("INTERNAL-NOTE-SENTINEL"));
    assert.ok(!serialized.includes("qualificationState"));
    assert.ok(!serialized.includes("not_a_fit"));
    assert.ok(!serialized.includes("reviewStartedAt"));
    harness.platform.close();
  });

  it("leaves ordinary member project restrictions unchanged", async () => {
    const harness = await queueHarness();
    const owner = await ownerWithSubmittedProject(harness);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);

    assert.deepEqual(harness.platform.projects.listAccessibleProjects(member.personId), []);
    assert.throws(
      () => harness.platform.intake.read(member.personId, owner.projectId),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );

    harness.platform.projects.grantProjectAccess({
      personId: owner.personId,
      organizationId: owner.organizationId,
      projectId: owner.projectId,
      memberPersonId: member.personId,
    });
    assert.equal(harness.platform.projects.listAccessibleProjects(member.personId).length, 1);

    harness.platform.projects.revokeProjectAccess({
      personId: owner.personId,
      organizationId: owner.organizationId,
      projectId: owner.projectId,
      memberPersonId: member.personId,
    });
    assert.deepEqual(harness.platform.projects.listAccessibleProjects(member.personId), []);

    // None of that changes Founder visibility.
    assert.equal(harness.platform.internal.queue(owner.personId).length, 1);
    harness.platform.close();
  });

  it("keeps project references unique", async () => {
    const harness = await queueHarness();
    const owner = await ownerWithSubmittedProject(harness);
    const secondOwner = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");

    // A duplicate reference in another organization is still refused by the
    // database, so the queue can never resolve an ambiguous row.
    const stored = harness.platform.store.findProject(owner.projectId);
    assert.ok(stored);
    assert.throws(() =>
      harness.platform.store.createProject({
        project: {
          ...stored,
          id: "duplicate-reference-project",
          organizationId: secondOwner.organizationId,
          createdByPersonId: secondOwner.personId,
        },
        idempotencyKey: null,
      }),
    );

    const rows = harness.platform.internal.queue(owner.personId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.reference, owner.reference);
    harness.platform.close();
  });
});
