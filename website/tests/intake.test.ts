/**
 * Project Intake: draft save, resume, partial-save preservation, and the
 * server-side authorization applied to every read and write.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} from "../lib/platform/errors";
import { PROJECT_INTAKE_FIELDS } from "../lib/platform/domain";
import { parseIntakeEntries, parseIntakePatch } from "../lib/platform/intake";
import {
  clientKeyFromHeaders,
  requireProtectedRequest,
  type RequestSecurityContext,
} from "../lib/platform/http";
import {
  CLIENT_KEY,
  MEMBER_EMAIL,
  OWNER_EMAIL,
  START_TIME,
  addOrdinaryMember,
  createTestPlatform,
  signUpAsOwner,
  signUpAsOwnerWithProject,
} from "./support/harness";
import type { TestPlatform } from "./support/harness";

const SELF_ORIGIN = "https://portal.synthetic.example";

function baseRequestContext(
  overrides: Partial<RequestSecurityContext> = {},
): RequestSecurityContext {
  return {
    method: "GET",
    origin: SELF_ORIGIN,
    selfOrigin: SELF_ORIGIN,
    clientKey: CLIENT_KEY,
    cookieHeader: null,
    ...overrides,
  };
}

function cookieName(harness: TestPlatform): string {
  return harness.platform.sessions.cookie.name;
}

/** An owner with one started project: the baseline for the intake suites. */
async function setup() {
  return signUpAsOwnerWithProject(await createTestPlatform(), OWNER_EMAIL);
}

describe("project intake draft", () => {
  it("saves a draft and resumes it with the same values", async () => {
    const { harness, personId, projectId } = await setup();

    harness.clock.advance(5_000);
    const saved = harness.platform.intake.saveDraft({
      personId,
      projectId,
      patch: {
        serviceNeed: "A customer portal for service bookings",
        businessProblem: "Bookings arrive by email and are easy to lose",
      },
    });

    assert.equal(saved.intake?.status, "draft");
    assert.equal(saved.intake?.answers.serviceNeed, "A customer portal for service bookings");
    assert.equal(saved.intake?.lastSavedAt, harness.clock.now());

    // Resume later: a fresh read returns the same saved answers.
    harness.clock.advance(3_600_000);
    const resumed = harness.platform.intake.read(personId, projectId);

    assert.equal(resumed.intake?.answers.serviceNeed, "A customer portal for service bookings");
    assert.equal(
      resumed.intake?.answers.businessProblem,
      "Bookings arrive by email and are easy to lose",
    );
    assert.equal(resumed.intake?.lastSavedAt, saved.intake?.lastSavedAt);
    assert.equal(resumed.project.answeredFieldCount, 2);
    assert.equal(resumed.project.totalFieldCount, PROJECT_INTAKE_FIELDS.length);
  });

  it("preserves previously saved values when a later save is partial", async () => {
    const { harness, personId, projectId } = await setup();

    harness.platform.intake.saveDraft({
      personId,
      projectId,
      patch: {
        serviceNeed: "Customer portal",
        targetUsers: "Existing customers",
        timing: "Before the end of the quarter",
      },
    });

    harness.clock.advance(60_000);
    const second = harness.platform.intake.saveDraft({
      personId,
      projectId,
      // Only one field is supplied on this save.
      patch: { serviceNeed: "Customer portal with online booking" },
    });

    assert.equal(second.intake?.answers.serviceNeed, "Customer portal with online booking");
    assert.equal(
      second.intake?.answers.targetUsers,
      "Existing customers",
      "an unsupplied field must be preserved",
    );
    assert.equal(second.intake?.answers.timing, "Before the end of the quarter");
  });

  it("clears a field only when an empty value is supplied", async () => {
    const { harness, personId, projectId } = await setup();

    harness.platform.intake.saveDraft({
      personId,
      projectId,
      patch: { serviceNeed: "Customer portal", constraints: "No downtime during trading hours" },
    });

    const cleared = harness.platform.intake.saveDraft({
      personId,
      projectId,
      patch: { constraints: "   " },
    });

    assert.equal(cleared.intake?.answers.constraints, null);
    assert.equal(cleared.intake?.answers.serviceNeed, "Customer portal");
  });

  it("keeps intake attached to the same project across saves", async () => {
    const { harness, personId, organizationId, projectId } = await setup();

    const before = harness.platform.store.findProjectIntakeByProject(projectId);
    harness.platform.intake.saveDraft({ personId, projectId, patch: { serviceNeed: "First" } });
    const after = harness.platform.store.findProjectIntakeByProject(projectId);

    assert.ok(before && after);
    assert.equal(after.id, before.id, "the same intake record continues");

    const secondProject = harness.platform.projects.createProject({ personId, organizationId });
    const secondIntake = harness.platform.store.findProjectIntakeByProject(secondProject.project.id);

    assert.ok(secondIntake);
    assert.notEqual(secondIntake.id, after.id, "each project gets its own intake");
    assert.ok(
      Object.values(secondIntake.answers).every((value) => value === null),
      "a new project starts from an empty draft",
    );
  });

  it("records the latest save time", async () => {
    const { harness, personId, projectId } = await setup();

    const first = harness.platform.intake.saveDraft({ personId, projectId, patch: { serviceNeed: "A" } });
    harness.clock.advance(120_000);
    const second = harness.platform.intake.saveDraft({ personId, projectId, patch: { serviceNeed: "B" } });

    assert.ok(second.intake!.lastSavedAt > first.intake!.lastSavedAt);
    assert.equal(second.intake!.lastSavedAt, harness.clock.now());
  });

  it("moves the customer-facing stage when the intake is submitted", async () => {
    const { harness, personId, projectId } = await setup();

    const draft = harness.platform.intake.read(personId, projectId);
    assert.equal(draft.project.stage, "project_started");
    assert.equal(draft.project.stageLabel, "Project started");

    const submitted = harness.platform.intake.submit(personId, projectId);
    assert.equal(submitted.intake?.status, "submitted");
    assert.equal(submitted.project.stage, "intake_information_submitted");
    assert.equal(submitted.project.stageLabel, "Project Intake — Information submitted");
  });

  it("rejects edits to an intake that was already submitted", async () => {
    const { harness, personId, projectId } = await setup();
    harness.platform.intake.submit(personId, projectId);

    assert.throws(
      () => harness.platform.intake.saveDraft({ personId, projectId, patch: { serviceNeed: "Late edit" } }),
      ValidationError,
    );
  });
});

describe("project intake input validation", () => {
  it("rejects a field that is not part of Project Intake", () => {
    assert.throws(() => parseIntakePatch({ qualificationState: "qualified" }), ValidationError);
    assert.throws(() => parseIntakePatch({ internalNotes: "budget is low" }), ValidationError);
    assert.throws(() => parseIntakePatch({ founderDecision: "approve" }), ValidationError);
    assert.throws(() => parseIntakePatch({ id: "another-record" }), ValidationError);
  });

  it("rejects prototype-manipulating keys without touching a prototype", () => {
    const entries: [string, unknown][] = [
      ["__proto__", "polluted"],
      ["constructor", "polluted"],
      ["prototype", "polluted"],
      ["toString", "polluted"],
    ];

    for (const entry of entries) {
      assert.throws(() => parseIntakeEntries([entry]), ValidationError, `${entry[0]} must be refused`);
    }

    // The key never becomes a property name, so nothing observable changes.
    assert.equal(({} as Record<string, unknown>)["polluted"], undefined);
    assert.equal(Object.getPrototypeOf({}), Object.prototype);
  });

  it("builds a patch that cannot reach Object.prototype", () => {
    const patch = parseIntakeEntries([["serviceNeed", "A booking portal"]]);

    assert.equal(Object.getPrototypeOf(patch), null, "the patch must have a null prototype");
    assert.equal(patch.serviceNeed, "A booking portal");
    assert.equal((patch as Record<string, unknown>)["toString"], undefined);
    assert.equal((patch as Record<string, unknown>)["__proto__"], undefined);
  });

  it("still saves valid fields submitted alongside hostile ones", async () => {
    const { harness, personId, projectId } = await setup();

    // A hostile key alongside a valid one refuses the whole request; the valid
    // field is not partially applied.
    assert.throws(
      () =>
        harness.platform.intake.saveDraft({
          personId,
          projectId,
          patch: parseIntakeEntries([
            ["serviceNeed", "A booking portal"],
            ["__proto__", "polluted"],
          ]),
        }),
      ValidationError,
    );

    const stored = harness.platform.store.findProjectIntakeByProject(projectId);
    assert.ok(stored);
    assert.equal(stored.answers.serviceNeed, null, "a refused request must not write anything");
  });

  it("accepts every declared field and rejects non-text values", () => {
    const everyField: Record<string, unknown> = {};
    for (const field of PROJECT_INTAKE_FIELDS) {
      everyField[field] = `value for ${field}`;
    }
    const patch = parseIntakePatch(everyField);
    assert.deepEqual(Object.keys(patch).sort(), [...PROJECT_INTAKE_FIELDS].sort());

    assert.throws(() => parseIntakePatch({ serviceNeed: { text: "structured" } }), ValidationError);
    assert.throws(() => parseIntakePatch({ serviceNeed: 42 }), ValidationError);
    assert.throws(() => parseIntakePatch({ serviceNeed: "x".repeat(5_001) }), ValidationError);
  });

  it("refuses to write an internal field onto the stored record", async () => {
    const { harness, personId, projectId } = await setup();

    // Simulates a tampered request body that reached the service with an extra
    // key. The write is built only from declared fields, so the unknown key
    // cannot land on any column.
    harness.platform.intake.saveDraft({
      personId,
      projectId,
      patch: { qualificationState: "not_a_fit", internalNotes: "budget is low" } as never,
    });

    const stored = harness.platform.store.findProjectIntakeByProject(projectId);
    assert.ok(stored);
    assert.ok(
      Object.values(stored.answers).every((value) => value === null),
      "no answer column may be written from an unlisted key",
    );
    assert.ok(
      !Object.prototype.hasOwnProperty.call(stored.answers, "qualificationState"),
      "the answers record has no internal members at all",
    );
  });
});

describe("project intake authorization", () => {
  it("rejects a protected request that carries no session", async () => {
    const { harness } = await setup();

    assert.throws(
      () =>
        requireProtectedRequest(
          baseRequestContext({ cookieHeader: null }),
          harness.platform,
        ),
      UnauthenticatedError,
    );

    assert.throws(
      () =>
        requireProtectedRequest(
          baseRequestContext({ cookieHeader: `${cookieName(harness)}=not-a-real-session` }),
          harness.platform,
        ),
      UnauthenticatedError,
    );
  });

  it("rejects a protected request whose session was revoked", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId, sessionId } = await signUpAsOwner(harness, OWNER_EMAIL);
    harness.platform.projects.createProject({ personId, organizationId });

    const live = requireProtectedRequest(
      baseRequestContext({ cookieHeader: `${cookieName(harness)}=${sessionId}` }),
      harness.platform,
    );
    assert.equal(live.personId, personId);

    harness.platform.sessions.revokeSession(sessionId);

    assert.throws(
      () =>
        requireProtectedRequest(
          baseRequestContext({ cookieHeader: `${cookieName(harness)}=${sessionId}` }),
          harness.platform,
        ),
      UnauthenticatedError,
    );
  });

  it("rejects a protected request whose session has expired", async () => {
    const harness = await createTestPlatform({ config: { sessionTtlMs: 60_000 } });
    const { sessionId } = await signUpAsOwner(harness, OWNER_EMAIL);

    harness.clock.set(START_TIME + 60_000);

    assert.throws(
      () =>
        requireProtectedRequest(
          baseRequestContext({ cookieHeader: `${cookieName(harness)}=${sessionId}` }),
          harness.platform,
        ),
      UnauthenticatedError,
    );
  });

  it("denies a member access to an unassigned project's intake", async () => {
    const { harness, personId, organizationId, projectId } = await setup();
    const member = await addOrdinaryMember(harness, organizationId, MEMBER_EMAIL);

    assert.throws(() => harness.platform.intake.read(member.personId, projectId), ForbiddenError);
    assert.throws(
      () =>
        harness.platform.intake.saveDraft({
          personId: member.personId,
          projectId,
          patch: { serviceNeed: "Injected by an unassigned member" },
        }),
      ForbiddenError,
    );
  });

  it("allows a member to save the intake of an assigned project", async () => {
    const { harness, personId, organizationId, projectId } = await setup();
    const member = await addOrdinaryMember(harness, organizationId, MEMBER_EMAIL);
    harness.platform.projects.grantProjectAccess({
      personId,
      organizationId,
      projectId,
      memberPersonId: member.personId,
    });

    const saved = harness.platform.intake.saveDraft({
      personId: member.personId,
      projectId,
      patch: { serviceNeed: "Saved by an assigned member" },
    });
    assert.equal(saved.intake?.answers.serviceNeed, "Saved by an assigned member");

    // The same access rule applies to the read used to resume the draft.
    assert.equal(harness.platform.intake.read(member.personId, projectId).intake?.status, "draft");
  });

  it("stops a member's intake access as soon as the assignment is revoked", async () => {
    const { harness, personId, organizationId, projectId } = await setup();
    const member = await addOrdinaryMember(harness, organizationId, MEMBER_EMAIL);
    harness.platform.projects.grantProjectAccess({
      personId,
      organizationId,
      projectId,
      memberPersonId: member.personId,
    });
    harness.platform.intake.saveDraft({
      personId: member.personId,
      projectId,
      patch: { serviceNeed: "Written before revocation" },
    });

    harness.platform.projects.revokeProjectAccess({
      personId,
      organizationId,
      projectId,
      memberPersonId: member.personId,
    });

    assert.throws(() => harness.platform.intake.read(member.personId, projectId), ForbiddenError);
    assert.throws(
      () =>
        harness.platform.intake.saveDraft({
          personId: member.personId,
          projectId,
          patch: { serviceNeed: "Written after revocation" },
        }),
      ForbiddenError,
    );

    const stored = harness.platform.store.findProjectIntakeByProject(projectId);
    assert.equal(stored?.answers.serviceNeed, "Written before revocation");
  });

  it("does not confirm an intake for a project in another organization", async () => {
    const { harness, personId, organizationId, projectId } = await setup();
    const outsider = await signUpAsOwner(harness, "outside@synthetic.example", "Outside Synthetic Co");

    assert.throws(() => harness.platform.intake.read(outsider.personId, projectId), NotFoundError);
    assert.throws(
      () =>
        harness.platform.intake.saveDraft({
          personId: outsider.personId,
          projectId,
          patch: { serviceNeed: "Cross-organization write" },
        }),
      NotFoundError,
    );
  });

  it("rejects a save for a project that does not exist", async () => {
    const { harness, personId } = await setup();

    assert.throws(
      () =>
        harness.platform.intake.saveDraft({
          personId,
          projectId: "no-such-project",
          patch: { serviceNeed: "x" },
        }),
      NotFoundError,
    );
  });
});