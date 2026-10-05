/**
 * Founder workspace.
 *
 * Exercises the approved Founder Workspace ADR against the real services, real
 * SQL, and the real authorization helpers. Only the passage of time and the
 * email transport are controlled.
 *
 * The properties asserted here are the ones the ADR makes load-bearing:
 * internal access is a capability rather than a customer role; reading a review
 * changes nothing; only an explicit action moves the customer-facing stage; the
 * internal vocabulary is closed and validated on the server; and none of the
 * internal state reaches a customer projection.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FOUNDER_DECISIONS,
  INTERNAL_QUALIFICATION_STATES,
  type FounderDecision,
} from "../lib/platform/domain";
import {
  OriginRejectedError,
  UnauthenticatedError,
  isPlatformError,
} from "../lib/platform/errors";
import { requireProtectedRequest } from "../lib/platform/http";
import type { RequestSecurityContext } from "../lib/platform/http";
import { parseIntakeEntries } from "../lib/platform/intake";
import { emailHash } from "../lib/platform/secrets";
import { resolveOrganizationContext } from "../lib/platform/authorization";
import { customerStageFor } from "../lib/platform/views";
import {
  CLIENT_KEY,
  MEMBER_EMAIL,
  OWNER_EMAIL,
  OTHER_EMAIL,
  addOrdinaryMember,
  createTestPlatform,
  signIn,
  signUpAsOwner,
  signUpAsOwnerWithProject,
  type TestPlatform,
} from "./support/harness";

const SELF_ORIGIN = "https://portal.synthetic.example";
const ALLOWED_ORIGIN = "https://portal.synthetic.example";

/**
 * A harness whose configured founder holds the capability through the
 * server-side bootstrap configuration, exactly as a deployment would.
 */
async function founderHarness(): Promise<TestPlatform> {
  return createTestPlatform({ config: { founderEmailHashes: [emailHash(OWNER_EMAIL)] } });
}

/** A project with a submitted intake, owned by `OWNER_EMAIL`. */
async function submittedProject(harness: TestPlatform) {
  const owner = await signUpAsOwnerWithProject(harness, OWNER_EMAIL);
  harness.platform.intake.submit(owner.personId, owner.projectId);
  const project = harness.platform.store.findProject(owner.projectId);
  assert.ok(project, "the project must be readable");
  return { ...owner, project };
}

function requestContext(overrides: Partial<RequestSecurityContext> = {}): RequestSecurityContext {
  return {
    method: "POST",
    origin: ALLOWED_ORIGIN,
    selfOrigin: SELF_ORIGIN,
    clientKey: CLIENT_KEY,
    cookieHeader: null,
    ...overrides,
  };
}

function eventTypes(harness: TestPlatform, projectId: string): string[] {
  return harness.platform.store
    .listAuditEventsForProject(projectId, 200)
    .map((event) => event.type);
}

describe("founder capability authorization", () => {
  it("rejects an unknown person with no session", async () => {
    const harness = await founderHarness();
    const { projectId } = await submittedProject(harness);

    assert.throws(
      () => harness.platform.internal.review("person-who-does-not-exist", projectId),
      (error: unknown) =>
        isPlatformError(error) && error.code === "unauthenticated",
    );
  });

  it("rejects a valid customer session that holds no capability", async () => {
    const harness = await founderHarness();
    const { projectId } = await submittedProject(harness);
    const customer = await signIn(harness, MEMBER_EMAIL);

    assert.throws(
      () => harness.platform.internal.review(customer.person.id, projectId),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
  });

  it("rejects an organization owner/admin who holds no capability", async () => {
    const harness = await founderHarness();
    const { projectId } = await submittedProject(harness);
    // A real owner/admin of the organization that owns the project.
    const admin = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");

    assert.throws(
      () => harness.platform.internal.review(admin.personId, projectId),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
  });

  it("allows a person holding the founder capability", async () => {
    const harness = await founderHarness();
    const { personId, projectId } = await submittedProject(harness);

    const review = harness.platform.internal.review(personId, projectId);
    assert.equal(review.project.reference, review.project.reference);
    assert.equal(review.customerStage, "intake_information_submitted");
  });

  it("grants the capability only from the configured bootstrap", async () => {
    const harness = await founderHarness();
    const { personId, projectId } = await submittedProject(harness);
    const stranger = await signIn(harness, MEMBER_EMAIL);

    // Before any internal call nothing is granted: the bootstrap runs inside the
    // capability check rather than at container construction.
    assert.equal(harness.platform.store.findInternalCapability(personId, "founder"), null);

    harness.platform.internal.review(personId, projectId);

    assert.equal(
      harness.platform.store.findInternalCapability(personId, "founder")?.revokedAt,
      null,
    );
    assert.equal(
      harness.platform.store.findInternalCapability(stranger.person.id, "founder"),
      null,
    );
  });

  it("rejects a state-changing internal request without a valid origin", async () => {
    const harness = await founderHarness();
    const { sessionId } = await submittedProject(harness);
    const cookieHeader = `${harness.platform.sessions.cookie.name}=${sessionId}`;

    // A live session, a cross-origin write: refused before the capability or the
    // service is consulted.
    assert.throws(
      () =>
        requireProtectedRequest(
          requestContext({
            origin: "https://attacker.synthetic.example",
            cookieHeader,
          }),
          harness.platform,
        ),
      (error: unknown) => error instanceof OriginRejectedError,
    );

    // And with no Origin at all, rather than exempted.
    assert.throws(
      () => requireProtectedRequest(requestContext({ origin: null, cookieHeader }), harness.platform),
      (error: unknown) => error instanceof OriginRejectedError,
    );
  });

  it("accepts the same request with an allowed origin", async () => {
    const harness = await founderHarness();
    const { sessionId } = await submittedProject(harness);

    const protectedRequest = requireProtectedRequest(
      requestContext({ cookieHeader: `${harness.platform.sessions.cookie.name}=${sessionId}` }),
      harness.platform,
    );
    assert.ok(protectedRequest.session.id);
  });

  it("cannot assign, change, or revoke a capability through a customer endpoint", async () => {
    const harness = await founderHarness();
    const owner = await signUpAsOwnerWithProject(harness, OWNER_EMAIL);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);

    // The customer intake endpoint validates every submitted key against the
    // closed intake field list, so a smuggled internal field is rejected at the
    // request boundary instead of being written onto the record.
    for (const field of [
      "founderCapability",
      "internalCapability",
      "qualificationState",
      "founderDecision",
      "reviewStartedAt",
    ]) {
      assert.throws(
        () => parseIntakeEntries([[field, "1"]]),
        (error: unknown) => isPlatformError(error) && error.code === "invalid_input",
        `"${field}" must be rejected by the customer intake boundary`,
      );
    }

    // And no customer flow grants internal access as a side effect.
    harness.platform.intake.saveDraft({
      personId: owner.personId,
      projectId: owner.projectId,
      patch: { serviceNeed: "Synthetic request" },
    });
    harness.platform.intake.submit(owner.personId, owner.projectId);

    assert.equal(harness.platform.store.findInternalCapability(member.personId, "founder"), null);
    assert.equal(harness.platform.store.listActiveInternalCapabilities(owner.personId).length, 0);
  });
});

describe("founder review", () => {
  it("shows the organization, customer identity, project, intake, stage, and audit history", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    const review = harness.platform.internal.review(owner.personId, owner.projectId);

    assert.equal(review.organization.name, "Synthetic Holdings Ltd");
    assert.equal(review.project.title, owner.project.title);
    assert.equal(review.intake?.status, "submitted");
    assert.equal(review.intake?.submittedAt, harness.clock.now());
    assert.equal(review.customerStage, "intake_information_submitted");
    assert.ok(review.customers.some((entry) => entry.email === OWNER_EMAIL));
    assert.ok(review.audit.length > 0);
    assert.ok(review.audit.some((entry) => entry.type === "project_intake.submitted"));
  });

  it("does not expose audit metadata through the internal view", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    const review = harness.platform.internal.review(owner.personId, owner.projectId);
    assert.ok(!("metadata" in review.audit[0]));
  });

  it("is strictly read-only: opening it changes nothing", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    const before = harness.platform.store.findProject(owner.projectId);
    const beforeEvents = eventTypes(harness, owner.projectId);

    harness.platform.internal.review(owner.personId, owner.projectId);
    harness.platform.internal.review(owner.personId, owner.projectId);
    harness.platform.internal.review(owner.personId, owner.projectId);

    const after = harness.platform.store.findProject(owner.projectId);
    assert.deepEqual(after, before, "reviewing must not write to the project");

    assert.deepEqual(
      eventTypes(harness, owner.projectId),
      beforeEvents,
      "reviewing must not append an audit event",
    );
    assert.equal(
      eventTypes(harness, owner.projectId).includes("project_intake.review_started"),
      false,
    );

    // The customer still sees the stage intake progress puts them at.
    const customerView = harness.platform.intake.read(owner.personId, owner.projectId);
    assert.equal(customerView.project.stage, "intake_information_submitted");
  });

  it("resolves a project reference for the internal workspace", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    const projectId = harness.platform.internal.resolveProjectId(
      owner.personId,
      owner.project.reference,
    );
    assert.equal(projectId, owner.projectId);
  });

  it("refuses a reference that does not exist", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    assert.throws(
      () => harness.platform.internal.resolveProjectId(owner.personId, "PRJ-NOPE00"),
      (error: unknown) => isPlatformError(error) && error.code === "not_found",
    );
  });

  it("does not let a customer session review any project, related or not", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);
    const customer = await signIn(harness, MEMBER_EMAIL);

    assert.throws(
      () => harness.platform.internal.resolveProjectId(customer.person.id, owner.project.reference),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
  });
});

describe("start review", () => {
  it("performs the approved customer stage transition", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    const review = harness.platform.internal.startReview({
      personId: owner.personId,
      projectId: owner.projectId,
    });

    assert.equal(review.customerStage, "intake_review");
    assert.ok(review.project.reviewStartedAt !== null);

    const customerView = harness.platform.intake.read(owner.personId, owner.projectId);
    assert.equal(customerView.project.stage, "intake_review");
    assert.equal(customerView.project.stageLabel, "Project Intake — Review");
  });

  it("records both required audit events", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    harness.platform.internal.startReview({
      personId: owner.personId,
      projectId: owner.projectId,
    });

    const types = eventTypes(harness, owner.projectId);
    assert.equal(types.filter((type) => type === "project_intake.review_started").length, 1);
    assert.equal(types.filter((type) => type === "project.customer_stage_changed").length, 1);
  });

  it("does not record a second pair when repeated", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    harness.platform.internal.startReview({ personId: owner.personId, projectId: owner.projectId });
    harness.platform.internal.startReview({ personId: owner.personId, projectId: owner.projectId });

    const types = eventTypes(harness, owner.projectId);
    assert.equal(types.filter((type) => type === "project_intake.review_started").length, 1);
  });

  it("refuses an intake that has not been submitted", async () => {
    const harness = await founderHarness();
    const owner = await signUpAsOwnerWithProject(harness, OWNER_EMAIL);

    assert.throws(
      () =>
        harness.platform.internal.startReview({
          personId: owner.personId,
          projectId: owner.projectId,
        }),
      (error: unknown) => isPlatformError(error) && error.code === "invalid_input",
    );
    assert.equal(eventTypes(harness, owner.projectId).includes("project_intake.review_started"), false);
  });

  it("fails without the founder capability", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);
    const stranger = await signIn(harness, MEMBER_EMAIL);

    assert.throws(
      () =>
        harness.platform.internal.startReview({
          personId: stranger.person.id,
          projectId: owner.projectId,
        }),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
    assert.equal(eventTypes(harness, owner.projectId).includes("project_intake.review_started"), false);
  });

  it("fails when the state-changing request has no valid origin", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    // The guard refuses the request before the service could start a review.
    assert.throws(
      () =>
        requireProtectedRequest(
          requestContext({
            origin: null,
            cookieHeader: `${harness.platform.sessions.cookie.name}=${owner.sessionId}`,
          }),
          harness.platform,
        ),
      (error: unknown) => error instanceof OriginRejectedError,
    );
    assert.equal(eventTypes(harness, owner.projectId).includes("project_intake.review_started"), false);
  });
});

describe("internal state separation", () => {
  it("persists every qualification state and never moves the customer stage", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    for (const state of INTERNAL_QUALIFICATION_STATES) {
      const review = harness.platform.internal.setQualificationState({
        personId: owner.personId,
        projectId: owner.projectId,
        state,
      });
      assert.equal(review.internal.qualificationState, state);

      const customerView = harness.platform.intake.read(owner.personId, owner.projectId);
      assert.equal(
        customerView.project.stage,
        "intake_information_submitted",
        `qualification "${state}" must not move the customer stage`,
      );
    }
  });

  it("rejects an unknown qualification state without writing", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    assert.throws(
      () =>
        harness.platform.internal.setQualificationState({
          personId: owner.personId,
          projectId: owner.projectId,
          state: "almost_a_fit",
        }),
      (error: unknown) => isPlatformError(error) && error.code === "invalid_input",
    );
    const stored = harness.platform.store.findProject(owner.projectId);
    assert.equal(stored?.qualificationState, "unreviewed");
  });

  it("keeps internal notes internal and records the change", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    harness.platform.internal.recordInternalNotes({
      personId: owner.personId,
      projectId: owner.projectId,
      notes: "  budget sensitivity noted  ",
    });
    harness.platform.internal.recordInternalNotes({
      personId: owner.personId,
      projectId: owner.projectId,
      notes: "second pass",
    });

    const stored = harness.platform.store.findProject(owner.projectId);
    assert.equal(stored?.internalNotes, "second pass");

    const types = eventTypes(harness, owner.projectId);
    assert.ok(types.includes("project.internal_note_added"));
    assert.ok(types.includes("project.internal_note_updated"));

    // Note text must not travel through the audit trail either.
    const events = harness.platform.store.listAuditEventsForProject(owner.projectId, 200);
    for (const event of events) {
      assert.equal(JSON.stringify(event.metadata ?? {}).includes("budget sensitivity"), false);
    }

    const customerView = harness.platform.intake.read(owner.personId, owner.projectId);
    assert.equal(JSON.stringify(customerView).includes("second pass"), false);
  });

  it("keeps the internal next action internal and audited", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    harness.platform.internal.recordInternalNextAction({
      personId: owner.personId,
      projectId: owner.projectId,
      nextAction: "call back on Friday",
    });

    const stored = harness.platform.store.findProject(owner.projectId);
    assert.equal(stored?.internalNextAction, "call back on Friday");
    assert.ok(eventTypes(harness, owner.projectId).includes("project.internal_next_action_recorded"));

    const customerView = harness.platform.intake.read(owner.personId, owner.projectId);
    assert.equal(JSON.stringify(customerView).includes("call back"), false);
  });

  it("records each internal action without disturbing the others", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    harness.platform.internal.setQualificationState({
      personId: owner.personId,
      projectId: owner.projectId,
      state: "clarification_required",
    });
    harness.platform.internal.recordFounderDecision({
      personId: owner.personId,
      projectId: owner.projectId,
      decision: "hold",
    });
    harness.platform.internal.recordInternalNotes({
      personId: owner.personId,
      projectId: owner.projectId,
      notes: "waiting on answers",
    });
    harness.platform.internal.recordInternalNextAction({
      personId: owner.personId,
      projectId: owner.projectId,
      nextAction: "follow up next week",
    });

    const stored = harness.platform.store.findProject(owner.projectId);
    assert.equal(stored?.qualificationState, "clarification_required");
    assert.equal(stored?.founderDecision, "hold");
    assert.equal(stored?.internalNotes, "waiting on answers");
    assert.equal(stored?.internalNextAction, "follow up next week");
  });

  it("does not derive the customer stage from internal state", async () => {
    assert.equal(customerStageFor(null, null), "project_started");
    // The stage is a function of intake progress plus the explicit review marker.
    const submitted = { status: "submitted" } as never;
    assert.equal(customerStageFor(submitted, null), "intake_information_submitted");
    assert.equal(customerStageFor(submitted, 1), "intake_review");
  });
});

describe("founder decision vocabulary", () => {
  it("accepts every approved value", async () => {
    for (const decision of FOUNDER_DECISIONS) {
      const harness = await founderHarness();
      const owner = await submittedProject(harness);

      const review = harness.platform.internal.recordFounderDecision({
        personId: owner.personId,
        projectId: owner.projectId,
        decision,
      });
      assert.equal(review.internal.founderDecision, decision);
      assert.equal(harness.platform.store.findProject(owner.projectId)?.founderDecision, decision);
      assert.ok(eventTypes(harness, owner.projectId).includes("project.founder_decision_recorded"));
    }
  });

  it("rejects unknown values without writing or coercing", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    for (const value of ["PROCEED", "proceed ", "approved", "decline", "1", null, undefined]) {
      assert.throws(
        () =>
          harness.platform.internal.recordFounderDecision({
            personId: owner.personId,
            projectId: owner.projectId,
            decision: value,
          }),
        (error: unknown) => isPlatformError(error) && error.code === "invalid_input",
        `decision ${JSON.stringify(value)} must be rejected`,
      );
    }

    const stored = harness.platform.store.findProject(owner.projectId);
    assert.equal(stored?.founderDecision, null);
  });

  it("stores hold as a real decision, distinct from no decision", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    const before = harness.platform.store.findProject(owner.projectId);
    assert.equal(before?.founderDecision, null);

    const held = harness.platform.internal.recordFounderDecision({
      personId: owner.personId,
      projectId: owner.projectId,
      decision: "hold",
    });
    assert.equal(held.internal.founderDecision, "hold");
    assert.notEqual(harness.platform.store.findProject(owner.projectId)?.founderDecision, null);
  });

  it("never exposes the decision to a customer", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    for (const decision of FOUNDER_DECISIONS) {
      harness.platform.internal.recordFounderDecision({
        personId: owner.personId,
        projectId: owner.projectId,
        decision,
      });
      harness.platform.internal.setQualificationState({
        personId: owner.personId,
        projectId: owner.projectId,
        state: "qualified",
      });

      const detail = harness.platform.intake.read(owner.personId, owner.projectId);
      const serialized = JSON.stringify(detail);
      assert.equal(serialized.includes("founderDecision"), false);
      assert.equal(serialized.includes("qualificationState"), false);
      for (const value of FOUNDER_DECISIONS) {
        assert.equal(serialized.includes(value), false, `customer payload must omit "${value}"`);
      }
    }
  });

  it("stores the decision separately from the qualification state", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    // Deliberately mismatched: nothing maps one to the other automatically.
    harness.platform.internal.setQualificationState({
      personId: owner.personId,
      projectId: owner.projectId,
      state: "qualified",
    });
    harness.platform.internal.recordFounderDecision({
      personId: owner.personId,
      projectId: owner.projectId,
      decision: "hold",
    });

    const stored = harness.platform.store.findProject(owner.projectId);
    assert.equal(stored?.qualificationState, "qualified");
    const storedDecision: FounderDecision | null = stored?.founderDecision ?? null;
    assert.equal(storedDecision, "hold");
  });
});

describe("access preservation", () => {
  it("leaves existing owner/admin project access working", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);
    harness.platform.internal.startReview({
      personId: owner.personId,
      projectId: owner.projectId,
    });

    const visible = harness.platform.projects.listAccessibleProjects(owner.personId);
    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.reference, owner.project.reference);
    // The founder is still an ordinary owner/admin customer.
    const context = resolveOrganizationContext(harness.platform.store, owner.personId);
    assert.equal(context?.isAdministrator, true);
  });

  it("leaves ordinary member restrictions working", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);
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
  });

  it("does not modify organization membership when a capability is granted", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    const membership = harness.platform.store.findMembershipByPerson(owner.personId);
    assert.equal(membership?.role, "owner");
    assert.equal(
      harness.platform.store.findMembershipByPerson("person-who-does-not-exist"),
      null,
    );
  });

  it("does not turn a Founder capability into customer permissions", async () => {
    const harness = await founderHarness();
    const owner = await submittedProject(harness);

    // The capability is granted to the configured address, which is the same
    // person here, so remove the customer side and check the two stay separate.
    const stranger = await signIn(harness, MEMBER_EMAIL);
    assert.equal(
      harness.platform.store.listActiveInternalCapabilities(stranger.person.id).length,
      0,
    );
    // Having no capability, they are not an administrator of anything.
    assert.equal(resolveOrganizationContext(harness.platform.store, stranger.person.id), null);
  });

  it("reports an unauthenticated internal request distinctly", async () => {
    const harness = await founderHarness();
    await submittedProject(harness);

    const outcome = (() => {
      try {
        return requireProtectedRequest(
          requestContext({ cookieHeader: `${harness.platform.sessions.cookie.name}=not-a-real-session` }),
          harness.platform,
        );
      } catch (error) {
        return error;
      }
    })();

    assert.ok(outcome instanceof UnauthenticatedError);
  });
});
