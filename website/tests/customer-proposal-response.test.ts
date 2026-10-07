/**
 * Customer Proposal Response — Request Changes and Accept.
 *
 * Exercises the accepted Customer Proposal Response ADR
 * (docs/decisions/2026-10-06-customer-proposal-response.md) against the real
 * services, real SQL, and the real authorization helpers: the two explicit
 * actions, version binding and the stale-version rule, the rule table,
 * Owner/Admin-only acceptance, idempotency, the two-layer evidence contract,
 * and the state-preservation boundaries.
 *
 * Only the passage of time and the email transport are controlled. All
 * identities and proposal content here are synthetic.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPlatformError } from "../lib/platform/errors";
import type { AuditEvent, ProposalResponseInternal } from "../lib/platform/domain";
import { generateActionKey } from "../lib/platform/secrets";
import { SqlitePlatformStore } from "../lib/platform/sqlite-store";
import { customerStageFor } from "../lib/platform/views";
import {
  MEMBER_EMAIL,
  OTHER_EMAIL,
  addOrdinaryMember,
  createTestPlatform,
  signIn,
  type TestPlatform,
} from "./support/harness";
import { collectKeys } from "./support/projection";
import {
  FOUNDER_HASH,
  createProposalHarness,
  grantAccess,
  ownerWithProject,
  publishFirstVersion,
  publishNextVersion,
  publishedOwner,
  readProposal,
  revokeAccess,
  startProposal,
} from "./support/proposals";

/** A marker that must never appear in audit metadata or any projection. */
const MESSAGE_NEEDLE = "secret-customer-wording-XYZZY";

/** The suite's harness: a real platform with the Founder bootstrap configured. */
const responseHarness = createProposalHarness;

/** Whoever submits a response: the person and the project they respond to. */
type Actor = { personId: string; projectId: string };

interface RespondInput {
  action: "changes_requested" | "accepted";
  versionNumber?: unknown;
  message?: unknown;
  actionKey?: unknown;
}

/**
 * Submits a response the way the route does: raw form values straight into the
 * service, which must validate and authorize everything itself.
 */
function respond(harness: TestPlatform, personId: string, projectId: string, input: RespondInput) {
  const message =
    "message" in input
      ? input.message
      : input.action === "changes_requested"
        ? `Please revise the timeline. ${MESSAGE_NEEDLE}`
        : null;
  return harness.platform.customerProposalResponses.submit({
    personId,
    projectId,
    action: input.action,
    // Present-but-invalid values (including null and undefined) are passed
    // through, so the service — not the helper — is what rejects them.
    versionNumber: "versionNumber" in input ? input.versionNumber : 1,
    message,
    actionKey: "actionKey" in input ? input.actionKey : generateActionKey(),
  });
}

/** Asserts the call fails with the expected stable platform error code. */
function expectFailure(action: () => unknown, code: string): void {
  assert.throws(
    action,
    (error: unknown) => isPlatformError(error) && error.code === code,
    `expected platform error "${code}"`,
  );
}

function responsesFor(harness: TestPlatform, projectId: string): ProposalResponseInternal[] {
  return harness.platform.store.listProposalResponses(projectId);
}

function responseEvents(harness: TestPlatform, projectId: string): AuditEvent[] {
  return harness.platform.store
    .listAuditEventsForProject(projectId, 50)
    .filter((event) => event.type.startsWith("proposal_response."));
}

function readStanding(harness: TestPlatform, personId: string, projectId: string) {
  return harness.platform.customerProposalResponses.readStandingByProjectId(
    personId,
    projectId,
  );
}

/** Submits one response as `actor`, against the project they respond to. */
function respondAs(harness: TestPlatform, actor: Actor, input: RespondInput) {
  return respond(harness, actor.personId, actor.projectId, input);
}

/** Asserts `actor`'s submission of `input` is refused with `code`. */
function expectRefused(
  harness: TestPlatform,
  actor: Actor,
  input: RespondInput,
  code: string,
): void {
  expectFailure(() => respondAs(harness, actor, input), code);
}

/**
 * Records an acceptance, then asserts a fresh keyed submission of `action` is
 * refused with `code` — the rule-table refusals that follow an acceptance.
 */
function expectRefusedAfterAcceptance(
  harness: TestPlatform,
  owner: Actor,
  action: RespondInput["action"],
  code: string,
): void {
  respondAs(harness, owner, { action: "accepted" });
  expectRefused(harness, owner, { action, actionKey: generateActionKey() }, code);
}

/** Submits one keyed response twice, running `between` after the first. */
function submitTwice(
  harness: TestPlatform,
  actor: Actor,
  input: RespondInput & { actionKey: string },
  between?: () => void,
) {
  const first = respondAs(harness, actor, input);
  between?.();
  const replay = respondAs(harness, actor, input);
  return { first, replay };
}

/** Asserts the stored response rows and response audit events for a project. */
function assertRecorded(harness: TestPlatform, actor: Actor, rows: number, events: number): void {
  assert.equal(responsesFor(harness, actor.projectId).length, rows);
  assert.equal(responseEvents(harness, actor.projectId).length, events);
}

/** The exact customer-safe standing projection, and nothing else. */
const STANDING_KEYS = ["canAccept", "state", "versionNumber"].sort();

/** Keys that must never appear in anything a customer can read. */
const FORBIDDEN_KEYS = [
  "id",
  "personId",
  "organizationId",
  "projectId",
  "proposalId",
  "proposalVersionId",
  "actionKey",
  "message",
  "metadata",
];

describe("proposal response authorization", () => {
  it("rejects an unauthenticated caller", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    expectFailure(
      () =>
        respond(harness, "person-who-does-not-exist", owner.projectId, {
          action: "changes_requested",
        }),
      "unauthenticated",
    );
    assert.equal(responsesFor(harness, owner.projectId).length, 0);
    harness.platform.close();
  });

  it("rejects an authenticated customer without project access", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const stranger = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);

    expectFailure(
      () =>
        respond(harness, stranger.personId, owner.projectId, {
          action: "changes_requested",
        }),
      "forbidden",
    );
    assert.equal(responsesFor(harness, owner.projectId).length, 0);
    harness.platform.close();
  });

  it("lets an ordinary member with a live assignment request changes", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    grantAccess(harness, owner, member.personId);

    const recorded = respond(harness, member.personId, owner.projectId, {
      action: "changes_requested",
    });
    assert.equal(recorded.action, "changes_requested");
    assert.equal(responsesFor(harness, owner.projectId).length, 1);
    harness.platform.close();
  });

  it("refuses an ordinary member acceptance even with full project access", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    grantAccess(harness, owner, member.personId);

    expectFailure(
      () => respond(harness, member.personId, owner.projectId, { action: "accepted" }),
      "forbidden",
    );
    assert.equal(responsesFor(harness, owner.projectId).length, 0);
    assert.equal(responseEvents(harness, owner.projectId).length, 0);
    harness.platform.close();
  });

  it("lets an organization owner request changes and accept", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    respondAs(harness, owner, { action: "changes_requested" });

    // Acceptance on a version with a change request is rejected by the rule
    // table — so a second project in another organization for the acceptance
    // half, authored by the Founder-capable person as every proposal is.
    const second = await ownerWithProject(harness, OTHER_EMAIL, "Second Synthetic Org");
    publishFirstVersion(harness, {
      personId: owner.personId,
      projectId: second.projectId,
    });
    const accepted = respond(harness, second.personId, second.projectId, {
      action: "accepted",
    });
    assert.equal(accepted.action, "accepted");
    harness.platform.close();
  });

  it("refuses a response on a project in another organization", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const otherOwner = await ownerWithProject(
      harness,
      OTHER_EMAIL,
      "Second Synthetic Org",
    );

    expectFailure(
      () => respond(harness, otherOwner.personId, owner.projectId, {
        action: "changes_requested",
      }),
      "not_found",
    );
    assert.equal(responsesFor(harness, owner.projectId).length, 0);
    harness.platform.close();
  });

  it("rejects an internal project id the caller was never granted, inside the service", async () => {
    // The PR #43 IDOR regression, restated: the route is not in the loop here —
    // the service itself must refuse a caller-supplied project id.
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);

    expectFailure(
      () => respond(harness, member.personId, owner.projectId, {
        action: "changes_requested",
      }),
      "forbidden",
    );
    assert.equal(responsesFor(harness, owner.projectId).length, 0);
    harness.platform.close();
  });

  it("does not let the founder capability grant customer response access", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    // A person holding the internal capability, with no customer membership.
    const outsider = await signIn(harness, OTHER_EMAIL);
    harness.platform.store.grantInternalCapability({
      personId: outsider.person.id,
      capability: "founder",
      grantedAt: harness.clock.now(),
      revokedAt: null,
    });

    expectFailure(
      () => respond(harness, outsider.person.id, owner.projectId, {
        action: "changes_requested",
      }),
      "forbidden",
    );
    expectFailure(
      () => respond(harness, outsider.person.id, owner.projectId, {
        action: "accepted",
      }),
      "forbidden",
    );
    assert.equal(responsesFor(harness, owner.projectId).length, 0);
    harness.platform.close();
  });

  it("does not let the founder capability make an ordinary member acceptable", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    grantAccess(harness, owner, member.personId);
    harness.platform.store.grantInternalCapability({
      personId: member.personId,
      capability: "founder",
      grantedAt: harness.clock.now(),
      revokedAt: null,
    });

    expectFailure(
      () => respond(harness, member.personId, owner.projectId, { action: "accepted" }),
      "forbidden",
    );
    harness.platform.close();
  });

  it("re-evaluates access on every call: a revocation blocks the next submission", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    grantAccess(harness, owner, member.personId);

    respond(harness, member.personId, owner.projectId, { action: "changes_requested" });
    revokeAccess(harness, owner, member.personId);

    expectFailure(
      () => respond(harness, member.personId, owner.projectId, {
        action: "changes_requested",
      }),
      "forbidden",
    );
    assert.equal(responsesFor(harness, owner.projectId).length, 1);
    harness.platform.close();
  });
});

describe("proposal response version binding", () => {
  it("records the exact proposal version the customer was shown", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const version = harness.platform.store.findCurrentPublishedProposalVersion(
      owner.projectId,
    );
    const proposal = harness.platform.store.findProposalByProject(owner.projectId);
    assert.ok(version);
    assert.ok(proposal);

    const recorded = respondAs(harness, owner, {
      action: "changes_requested",
      actionKey: generateActionKey(),
    });
    assert.equal(recorded.versionNumber, 1);

    const [row] = responsesFor(harness, owner.projectId);
    assert.ok(row);
    assert.equal(row.proposalVersionId, version.id);
    assert.equal(row.versionNumber, 1);
    assert.equal(row.proposalId, proposal.id);
    harness.platform.close();
  });

  it("rejects a superseded version number for both actions and writes nothing", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    publishNextVersion(harness, owner, 2);

    expectRefused(
      harness,
      owner,
      { action: "changes_requested", versionNumber: 1 },
      "proposal_updated",
    );
    expectRefused(
      harness,
      owner,
      { action: "accepted", versionNumber: 1 },
      "proposal_updated",
    );
    assertRecorded(harness, owner, 0, 0);
    harness.platform.close();
  });

  it("binds a response committed before publication, and rejects one after", async () => {
    // Order 1: the response commits first, then the Founder publishes v2.
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    respondAs(harness, owner, { action: "changes_requested" });
    publishNextVersion(harness, owner, 2);

    const [row] = responsesFor(harness, owner.projectId);
    assert.ok(row);
    assert.equal(row.versionNumber, 1);
    assert.equal(row.action, "changes_requested");
    harness.platform.close();
  });

  it("rejects a response against version 1 after version 2 is published", async () => {
    // Order 2: the Founder publishes first, then the response commits.
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    publishNextVersion(harness, owner, 2);

    expectRefused(harness, owner, { action: "accepted", versionNumber: 1 }, "proposal_updated");
    // After a reload the customer responds against the current version.
    const recorded = respondAs(harness, owner, {
      action: "accepted",
      versionNumber: 2,
    });
    assert.equal(recorded.versionNumber, 2);
    harness.platform.close();
  });

  it("does not inherit an older version's responses into a newer version", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    respondAs(harness, owner, { action: "changes_requested" });
    publishNextVersion(harness, owner, 2);

    const version2 = harness.platform.store
      .listProposalVersions(
        harness.platform.store.findProposalByProject(owner.projectId)!.id,
      )
      .find((candidate) => candidate.versionNumber === 2);
    assert.ok(version2);

    const inherited = responsesFor(harness, owner.projectId).filter(
      (row) => row.proposalVersionId === version2.id,
    );
    assert.equal(inherited.length, 0);

    // Version 2 opens fresh: acceptance is allowed even though v1 was
    // responded to.
    const accepted = respondAs(harness, owner, {
      action: "accepted",
      versionNumber: 2,
    });
    assert.equal(accepted.versionNumber, 2);
    harness.platform.close();
  });

  it("never records against a draft: no published version reads as not found", async () => {
    const harness = await responseHarness();
    const owner = await ownerWithProject(harness);
    startProposal(harness, owner, "draft-only");

    expectRefused(harness, owner, { action: "changes_requested" }, "not_found");
    assert.equal(responsesFor(harness, owner.projectId).length, 0);
    harness.platform.close();
  });

  it("rejects malformed version numbers before persistence", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    for (const versionNumber of ["abc", "0", "-1", "1.5", "", null, undefined]) {
      expectRefused(harness, owner, { action: "changes_requested", versionNumber }, "invalid_input");
    }
    assert.equal(responsesFor(harness, owner.projectId).length, 0);
    harness.platform.close();
  });
});

describe("proposal response request changes", () => {
  it("rejects missing, non-string, whitespace-only, and oversized messages", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    for (const message of [
      undefined,
      null,
      42,
      { text: "not a string" },
      "",
      "   \t\n  ",
      "x".repeat(5001),
    ]) {
      expectRefused(harness, owner, { action: "changes_requested", message }, "invalid_input");
    }
    assertRecorded(harness, owner, 0, 0);
    harness.platform.close();
  });

  it("rejects a missing action key before persistence", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    for (const actionKey of [undefined, null, "", "   ", 42]) {
      expectRefused(harness, owner, { action: "changes_requested", actionKey }, "invalid_input");
    }
    assert.equal(responsesFor(harness, owner.projectId).length, 0);
    harness.platform.close();
  });

  it("records exactly one immutable row and one identifier-only audit event", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    const key = generateActionKey();
    respondAs(harness, owner, {
      action: "changes_requested",
      actionKey: key,
    });

    const rows = responsesFor(harness, owner.projectId);
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.ok(row);
    assert.equal(row.action, "changes_requested");
    assert.equal(row.message, `Please revise the timeline. ${MESSAGE_NEEDLE}`);
    assert.equal(row.actionKey, key);
    assert.equal(row.personId, owner.personId);
    assert.equal(row.organizationId, owner.organizationId);

    const events = responseEvents(harness, owner.projectId);
    assert.equal(events.length, 1);
    const event = events[0];
    assert.ok(event);
    assert.equal(event.type, "proposal_response.changes_requested");
    assert.equal(event.personId, owner.personId);
    assert.equal(event.projectId, owner.projectId);
    const metadata = event.metadata;
    assert.ok(metadata);
    assert.deepEqual(Object.keys(metadata).sort(), [
      "action",
      "proposalId",
      "proposalVersionId",
      "versionNumber",
    ]);
    // The message never travels through audit history.
    assert.ok(!JSON.stringify(metadata).includes(MESSAGE_NEEDLE));
    assert.ok(!JSON.stringify(events).includes(MESSAGE_NEEDLE));
    harness.platform.close();
  });

  it("records each repeated request in order and leaves earlier records unchanged", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    const firstKey = generateActionKey();
    respondAs(harness, owner, {
      action: "changes_requested",
      message: "First request",
      actionKey: firstKey,
    });
    const snapshot = JSON.stringify(responsesFor(harness, owner.projectId));
    harness.clock.advance(60_000);

    respondAs(harness, owner, {
      action: "changes_requested",
      message: "Second request",
      actionKey: generateActionKey(),
    });

    const rows = responsesFor(harness, owner.projectId);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.message, "First request");
    assert.equal(rows[1]?.message, "Second request");
    assert.ok((rows[0]?.createdAt ?? 0) < (rows[1]?.createdAt ?? 0));
    // The first record was not overwritten or rewritten.
    const [first] = rows;
    assert.equal(JSON.stringify([first]), snapshot);
    assert.equal(responseEvents(harness, owner.projectId).length, 2);
    harness.platform.close();
  });

  it("is idempotent for a replayed submission: one row, one audit event", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const key = generateActionKey();

    const { first, replay } = submitTwice(
      harness,
      owner,
      { action: "changes_requested", actionKey: key },
      () => harness.clock.advance(5_000),
    );

    assert.deepEqual(replay, first);
    assertRecorded(harness, owner, 1, 1);
    harness.platform.close();
  });

  it("changes no proposal content, creates no version, and moves no stage", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    const before = harness.platform.projects.getCustomerProject(
      owner.personId,
      owner.projectId,
    );
    const stageBefore = customerStageFor(
      before.intake,
      harness.platform.store.findProject(owner.projectId)?.reviewStartedAt ?? null,
    );
    const proposalBefore = JSON.stringify(
      harness.platform.proposals.read(owner.personId, owner.projectId),
    );
    const publishedBefore = before.project.hasPublishedProposal;

    respondAs(harness, owner, { action: "changes_requested" });

    const after = harness.platform.projects.getCustomerProject(
      owner.personId,
      owner.projectId,
    );
    const stageAfter = customerStageFor(
      after.intake,
      harness.platform.store.findProject(owner.projectId)?.reviewStartedAt ?? null,
    );
    assert.equal(stageAfter, stageBefore);
    assert.equal(after.project.stage, before.project.stage);
    assert.equal(after.project.stageLabel, before.project.stageLabel);
    assert.equal(after.project.hasPublishedProposal, publishedBefore);
    assert.equal(
      JSON.stringify(harness.platform.proposals.read(owner.personId, owner.projectId)),
      proposalBefore,
    );
    // No new version and no acceptance evidence of any kind.
    const versions = harness.platform.proposals.read(
      owner.personId,
      owner.projectId,
    ).versions;
    assert.equal(versions.length, 1);
    const proposal = harness.platform.store.findProposalByProject(owner.projectId);
    assert.ok(proposal);
    assert.equal(
      harness.platform.store.findAcceptedProposalVersion(
        harness.platform.store.findCurrentPublishedProposalVersion(owner.projectId)!.id,
      ),
      null,
    );
    harness.platform.close();
  });

  it("derives the standing as changes requested, with acceptance closed", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    const openBefore = readStanding(harness, owner.personId, owner.projectId);
    assert.deepEqual(openBefore, {
      versionNumber: 1,
      state: "open",
      canAccept: true,
    });

    respondAs(harness, owner, { action: "changes_requested" });

    const standing = readStanding(harness, owner.personId, owner.projectId);
    assert.deepEqual(standing, {
      versionNumber: 1,
      state: "changes_requested",
      canAccept: false,
    });
    harness.platform.close();
  });

  it("enforces no invented maximum: repeated requests are all recorded", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    for (let index = 0; index < 3; index += 1) {
      respondAs(harness, owner, {
        action: "changes_requested",
        message: `Request number ${index + 1}`,
      });
      harness.clock.advance(1_000);
    }
    assert.equal(responsesFor(harness, owner.projectId).length, 3);
    harness.platform.close();
  });
});

describe("proposal response acceptance", () => {
  it("records the complete evidence contract", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const proposal = harness.platform.store.findProposalByProject(owner.projectId);
    const version = harness.platform.store.findCurrentPublishedProposalVersion(
      owner.projectId,
    );
    assert.ok(proposal);
    assert.ok(version);

    const key = generateActionKey();
    const now = harness.clock.now();
    const recorded = respondAs(harness, owner, {
      action: "accepted",
      actionKey: key,
    });
    assert.deepEqual(recorded, { action: "accepted", versionNumber: 1, createdAt: now });

    const rows = responsesFor(harness, owner.projectId);
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.ok(row);
    assert.ok(row.id.length > 0);
    assert.equal(row.personId, owner.personId);
    assert.equal(row.organizationId, owner.organizationId);
    assert.equal(row.projectId, owner.projectId);
    assert.equal(row.proposalId, proposal.id);
    assert.equal(row.proposalVersionId, version.id);
    assert.equal(row.versionNumber, 1);
    assert.equal(row.action, "accepted");
    assert.equal(row.message, null);
    assert.equal(row.actionKey, key);
    assert.equal(row.createdAt, now);

    const events = responseEvents(harness, owner.projectId);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, "proposal_response.accepted");
    const metadata = events[0]?.metadata;
    assert.ok(metadata);
    assert.deepEqual(Object.keys(metadata).sort(), [
      "action",
      "proposalId",
      "proposalVersionId",
      "versionNumber",
    ]);
    harness.platform.close();
  });

  it("treats a replayed acceptance as the recorded result: one row, one audit event", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const key = generateActionKey();

    const { first, replay } = submitTwice(harness, owner, {
      action: "accepted",
      actionKey: key,
    });

    assert.deepEqual(replay, first);
    assertRecorded(harness, owner, 1, 1);
    harness.platform.close();
  });

  it("returns a deterministic already-accepted result for a second acceptance", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    expectRefusedAfterAcceptance(harness, owner, "accepted", "proposal_version_accepted");
    assertRecorded(harness, owner, 1, 1);
    harness.platform.close();
  });

  it("rejects acceptance after request changes on the same version", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    respondAs(harness, owner, { action: "changes_requested" });
    expectRefused(harness, owner, { action: "accepted" }, "proposal_not_acceptable");
    assert.equal(responsesFor(harness, owner.projectId).length, 1);
    assert.equal(
      responseEvents(harness, owner.projectId).filter(
        (event) => event.type === "proposal_response.accepted",
      ).length,
      0,
    );
    harness.platform.close();
  });

  it("rejects any further response once a version is accepted", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    expectRefusedAfterAcceptance(harness, owner, "changes_requested", "proposal_version_accepted");
    assert.equal(responsesFor(harness, owner.projectId).length, 1);
    harness.platform.close();
  });

  it("lets a newer published version be accepted independently", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    respondAs(harness, owner, { action: "accepted" });

    // The Founder publishes a further version regardless; it starts open.
    publishNextVersion(harness, owner, 2);
    const standing = readStanding(harness, owner.personId, owner.projectId);
    assert.deepEqual(standing, {
      versionNumber: 2,
      state: "open",
      canAccept: true,
    });

    const accepted = respondAs(harness, owner, {
      action: "accepted",
      versionNumber: 2,
    });
    assert.equal(accepted.versionNumber, 2);
    assert.equal(responsesFor(harness, owner.projectId).length, 2);
    harness.platform.close();
  });

  it("changes no project stage and creates no agreement, payment, or activation state", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    const before = harness.platform.projects.getCustomerProject(
      owner.personId,
      owner.projectId,
    );
    respondAs(harness, owner, { action: "accepted" });
    const after = harness.platform.projects.getCustomerProject(
      owner.personId,
      owner.projectId,
    );

    assert.equal(after.project.stage, before.project.stage);
    assert.equal(after.project.stageLabel, before.project.stageLabel);
    assert.equal(
      after.project.hasPublishedProposal,
      before.project.hasPublishedProposal,
    );
    // The stored project row carries no new state either.
    const project = harness.platform.store.findProject(owner.projectId);
    assert.ok(project);
    assert.equal(project.reviewStartedAt, null);
    assert.equal(project.founderDecision, null);
    assert.equal(project.qualificationState, "unreviewed");
    harness.platform.close();
  });

  it("closes the derived standing after acceptance", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    respondAs(harness, owner, { action: "accepted" });

    const standing = readStanding(harness, owner.personId, owner.projectId);
    assert.deepEqual(standing, {
      versionNumber: 1,
      state: "accepted",
      canAccept: false,
    });
    // An ordinary member sees the same version standing, never an accept control.
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    grantAccess(harness, owner, member.personId);
    const memberStanding = readStanding(harness, member.personId, owner.projectId);
    assert.deepEqual(memberStanding, {
      versionNumber: 1,
      state: "accepted",
      canAccept: false,
    });
    harness.platform.close();
  });
});

describe("proposal response storage invariants", () => {
  it("enforces the message CHECK constraints at the database level", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const proposal = harness.platform.store.findProposalByProject(owner.projectId);
    const version = harness.platform.store.findCurrentPublishedProposalVersion(
      owner.projectId,
    );
    assert.ok(proposal);
    assert.ok(version);

    const base: ProposalResponseInternal = {
      id: "response-check-1",
      personId: owner.personId,
      organizationId: owner.organizationId,
      projectId: owner.projectId,
      proposalId: proposal.id,
      proposalVersionId: version.id,
      versionNumber: 1,
      action: "changes_requested",
      message: "A real request",
      actionKey: generateActionKey(),
      createdAt: harness.clock.now(),
    };

    // A changes-requested row must carry a message.
    assert.throws(() =>
      harness.platform.store.createProposalResponse({ ...base, id: "c1", message: null }),
    );
    // Whitespace-only, including tabs and newlines that plain trim would spare.
    assert.throws(() =>
      harness.platform.store.createProposalResponse({
        ...base,
        id: "c2",
        message: "\t\n \r\v\f",
        actionKey: generateActionKey(),
      }),
    );
    // Over the 5,000 character limit.
    assert.throws(() =>
      harness.platform.store.createProposalResponse({
        ...base,
        id: "c3",
        message: "x".repeat(5001),
        actionKey: generateActionKey(),
      }),
    );
    // An accepted row must carry no message.
    assert.throws(() =>
      harness.platform.store.createProposalResponse({
        ...base,
        id: "c4",
        action: "accepted",
        message: "carrying a message",
        actionKey: generateActionKey(),
      }),
    );
    // An unknown action.
    assert.throws(() =>
      harness.platform.store.createProposalResponse({
        ...base,
        id: "c5",
        action: "rejected" as ProposalResponseInternal["action"],
        message: null,
        actionKey: generateActionKey(),
      }),
    );
    assert.equal(responsesFor(harness, owner.projectId).length, 0);
    harness.platform.close();
  });

  it("enforces at most one acceptance per version as a database guarantee", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const proposal = harness.platform.store.findProposalByProject(owner.projectId);
    const version = harness.platform.store.findCurrentPublishedProposalVersion(
      owner.projectId,
    );
    assert.ok(proposal);
    assert.ok(version);

    respondAs(harness, owner, { action: "accepted" });

    // A second acceptance reaching the store by any other path is refused by
    // the partial unique index, not merely by an application check.
    assert.throws(() =>
      harness.platform.store.createProposalResponse({
        id: "response-second-acceptance",
        personId: owner.personId,
        organizationId: owner.organizationId,
        projectId: owner.projectId,
        proposalId: proposal.id,
        proposalVersionId: version.id,
        versionNumber: 1,
        action: "accepted",
        message: null,
        actionKey: generateActionKey(),
        createdAt: harness.clock.now(),
      }),
    );
    assert.equal(
      responsesFor(harness, owner.projectId).filter((row) => row.action === "accepted")
        .length,
      1,
    );
    harness.platform.close();
  });

  it("rejects a duplicate action key so a replay can never create a second row", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const key = generateActionKey();

    respondAs(harness, owner, {
      action: "changes_requested",
      actionKey: key,
    });
    assert.throws(() =>
      harness.platform.store.createProposalResponse({
        id: "response-duplicate-key",
        personId: owner.personId,
        organizationId: owner.organizationId,
        projectId: owner.projectId,
        proposalId: "proposal-x",
        proposalVersionId: "version-x",
        versionNumber: 1,
        action: "changes_requested",
        message: "Another request",
        actionKey: key,
        createdAt: harness.clock.now(),
      }),
    );
    assert.equal(responsesFor(harness, owner.projectId).length, 1);
    harness.platform.close();
  });

  it("reads one version's response history by version alone", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);
    const firstVersion = harness.platform.store.findCurrentPublishedProposalVersion(
      owner.projectId,
    );
    assert.ok(firstVersion);

    respondAs(harness, owner, { action: "changes_requested", message: "v1 first" });
    respondAs(harness, owner, { action: "changes_requested", message: "v1 second" });
    publishNextVersion(harness, owner, 2);
    const secondVersion = harness.platform.store.findCurrentPublishedProposalVersion(
      owner.projectId,
    );
    assert.ok(secondVersion);
    respondAs(harness, owner, { action: "accepted", versionNumber: 2 });

    // The project-wide history is the union of both versions' responses...
    assert.equal(responsesFor(harness, owner.projectId).length, 3);

    // ...while the per-version read returns exactly that version's rows, oldest
    // first, so reading one version never loads another version's history.
    const firstHistory = harness.platform.store.listProposalResponsesByVersion(
      firstVersion.id,
    );
    assert.deepEqual(firstHistory.map((row) => row.message), ["v1 first", "v1 second"]);
    assert.ok(firstHistory.every((row) => row.proposalVersionId === firstVersion.id));

    const secondHistory = harness.platform.store.listProposalResponsesByVersion(
      secondVersion.id,
    );
    assert.deepEqual(secondHistory.map((row) => row.action), ["accepted"]);
    assert.ok(secondHistory.every((row) => row.proposalVersionId === secondVersion.id));

    // A version with no recorded history reads as empty, not as another's rows.
    assert.deepEqual(
      harness.platform.store.listProposalResponsesByVersion("version-with-no-history"),
      [],
    );
    harness.platform.close();
  });
});

describe("proposal response boundaries", () => {
  it("keeps reading non-mutating: no write and no audit event", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    const auditBefore = harness.platform.store.listAuditEventsForProject(
      owner.projectId,
      50,
    ).length;
    const rowsBefore = responsesFor(harness, owner.projectId).length;

    readProposal(harness, owner.personId, owner.reference);
    readStanding(harness, owner.personId, owner.projectId);
    readProposal(harness, owner.personId, owner.reference);
    readStanding(harness, owner.personId, owner.projectId);

    assert.equal(
      harness.platform.store.listAuditEventsForProject(owner.projectId, 50).length,
      auditBefore,
    );
    assert.equal(responsesFor(harness, owner.projectId).length, rowsBefore);
    harness.platform.close();
  });

  it("exposes only the approved standing projection keys", async () => {
    const harness = await responseHarness();
    const owner = await publishedOwner(harness);

    respondAs(harness, owner, { action: "changes_requested" });
    const standing = readStanding(harness, owner.personId, owner.projectId);
    assert.ok(standing);
    assert.deepEqual([...collectKeys(standing)].sort(), STANDING_KEYS);
    for (const key of FORBIDDEN_KEYS) {
      assert.ok(!collectKeys(standing).has(key), `standing must not carry ${key}`);
    }

    const proposal = readProposal(harness, owner.personId, owner.reference);
    assert.ok(proposal);
    for (const key of FORBIDDEN_KEYS) {
      assert.ok(!collectKeys(proposal).has(key), `proposal must not carry ${key}`);
    }
    harness.platform.close();
  });

  it("rolls the response row back when its audit append fails", async () => {
    class RollbackAuditStore extends SqlitePlatformStore {
      failAuditOnce = false;

      override appendAuditEvent(event: AuditEvent): void {
        if (this.failAuditOnce) {
          this.failAuditOnce = false;
          throw new Error("Simulated audit failure.");
        }
        super.appendAuditEvent(event);
      }
    }

    const store = new RollbackAuditStore(":memory:");
    const harness = await createTestPlatform({
      config: { founderEmailHashes: [FOUNDER_HASH] },
      createOptions: { store },
    });
    const owner = await publishedOwner(harness);

    store.failAuditOnce = true;
    assert.throws(
      () => respondAs(harness, owner, {
        action: "changes_requested",
      }),
      /Simulated audit failure/,
    );

    // Neither layer exists without the other: no response row, no audit event.
    assertRecorded(harness, owner, 0, 0);

    // The transaction recovered: the next submission records both layers.
    respondAs(harness, owner, { action: "changes_requested" });
    assertRecorded(harness, owner, 1, 1);
    harness.platform.close();
  });

  it("keeps the customer stage derivation untouched", async () => {
    // I15/I16: the slice produces no proposal_accepted stage and does not
    // modify customerStageFor's outputs.
    assert.equal(customerStageFor(null), "project_started");
    assert.equal(customerStageFor({ status: "draft" }), "project_started");
    assert.equal(customerStageFor({ status: "submitted" }), "intake_information_submitted");
    assert.equal(customerStageFor({ status: "submitted" }, 1_000), "intake_review");
  });
});
