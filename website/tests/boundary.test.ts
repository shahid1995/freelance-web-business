/**
 * Customer/internal boundary.
 *
 * The requirement is not that internal fields are hidden in the UI — it is that
 * they are absent from the data a customer response is built from. These tests
 * build a project record with internal state populated and assert that none of it
 * survives the projection, then check the same property against the real
 * service output.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ProjectInternal } from "../lib/platform/domain";
import {
  CUSTOMER_STAGE_LABELS,
  toCustomerProjectDetail,
  toCustomerProjectSummary,
} from "../lib/platform/views";
import { OWNER_EMAIL, createTestPlatform, signUpAsOwner } from "./support/harness";

const INTERNAL_VALUES = {
  qualificationState: "not_a_fit" as const,
  internalNotes: "INTERNAL-NOTE-SENTINEL budget is below our floor",
  // The Founder decision is now a closed vocabulary, so an arbitrary sentinel is
  // no longer representable and the fixture has to hold a real value. The
  // leakage proof for the decision field is the key assertions below plus
  // founder-workspace.test.ts, which drives the real service.
  founderDecision: "not_a_fit" as const,
  internalNextAction: "INTERNAL-NEXT-ACTION-SENTINEL call back on Friday",
};

/** Keys that must never appear in anything returned to a customer. */
const INTERNAL_KEYS = [
  "qualificationState",
  "qualification_state",
  "internalNotes",
  "internal_notes",
  "founderDecision",
  "founder_decision",
  "internalNextAction",
  "internal_next_action",
  "reviewStartedAt",
  "review_started_at",
  "metadata",
  "auditEvents",
  "audit_events",
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

function internalProject(overrides: Partial<ProjectInternal> = {}): ProjectInternal {
  return {
    id: "project-internal-id",
    organizationId: "organization-internal-id",
    reference: "PRJ-ABCDE",
    title: "Synthetic project",
    createdByPersonId: "person-internal-id",
    createdAt: 1,
    updatedAt: 2,
    reviewStartedAt: 3,
    ...INTERNAL_VALUES,
    ...overrides,
  };
}

describe("customer projection of internal project state", () => {
  it("omits internal keys from the customer project summary", () => {
    const summary = toCustomerProjectSummary(internalProject(), null);
    const keys = collectKeys(summary);

    for (const forbidden of INTERNAL_KEYS) {
      assert.ok(!keys.has(forbidden), `customer summary must not contain "${forbidden}"`);
    }
  });

  it("omits internal values from the customer project detail", () => {
    const detail = toCustomerProjectDetail(internalProject(), null);
    const serialized = JSON.stringify(detail);

    for (const forbidden of INTERNAL_KEYS) {
      assert.ok(!serialized.includes(forbidden), `customer payload must not mention "${forbidden}"`);
    }
    for (const [, sentinel] of Object.entries(INTERNAL_VALUES)) {
      assert.ok(
        !serialized.includes(sentinel),
        "an internal value must never reach a customer payload",
      );
    }
  });

  it("does not expose internal state through the customer stage label", () => {
    const labels = Object.values(CUSTOMER_STAGE_LABELS);
    const internalOutcomes = ["qualified", "clarification required", "not a fit", "no decision"];

    for (const label of labels) {
      const lowered = label.toLowerCase();
      for (const outcome of internalOutcomes) {
        assert.ok(
          !lowered.includes(outcome),
          `customer stage label "${label}" must not use the internal outcome "${outcome}"`,
        );
      }
    }
  });

  it("derives the customer stage from intake progress, not from internal state", () => {
    const asNotAFit = toCustomerProjectSummary(
      internalProject({ qualificationState: "not_a_fit" }),
      null,
    );
    const asQualified = toCustomerProjectSummary(
      internalProject({ qualificationState: "qualified" }),
      null,
    );

    assert.equal(asNotAFit.stage, asQualified.stage);
    assert.equal(asNotAFit.stageLabel, asQualified.stageLabel);
  });

  it("exposes no internal members on the intake projection", () => {
    const detail = toCustomerProjectDetail(
      internalProject(),
      {
        id: "intake-internal-id",
        projectId: "project-internal-id",
        status: "draft",
        schemaVersion: 1,
        answers: {
          serviceNeed: "Synthetic",
          businessProblem: null,
          desiredOutcome: null,
          targetUsers: null,
          pagesScreensWorkflows: null,
          existingSiteOrSystem: null,
          requiredFunctionality: null,
          integrations: null,
          existingAssets: null,
          timing: null,
          constraints: null,
          dependencies: null,
          otherInformation: null,
        },
        createdAt: 1,
        updatedAt: 2,
        lastSavedAt: 2,
        submittedAt: null,
      },
    );
    const serialized = JSON.stringify(detail);

    for (const forbidden of INTERNAL_KEYS) {
      assert.ok(!serialized.includes(forbidden));
    }
    assert.equal(detail.intake?.answers.serviceNeed, "Synthetic");
  });
});

describe("customer-facing service output", () => {
  it("returns dashboard and project data with no internal keys", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);
    harness.platform.projects.createProject({ personId, organizationId, title: "Synthetic work" });
    harness.platform.intake.saveDraft({
      personId,
      projectId: harness.platform.store.listProjectsByOrganization(organizationId)[0]!.id,
      patch: { serviceNeed: "Synthetic intake" },
    });

    const summaries = harness.platform.projects.listAccessibleProjects(personId);
    const detail = harness.platform.intake.read(
      personId,
      harness.platform.store.listProjectsByOrganization(organizationId)[0]!.id,
    );

    for (const payload of [summaries, detail]) {
      const keys = collectKeys(payload);
      for (const forbidden of INTERNAL_KEYS) {
        assert.ok(!keys.has(forbidden), `service output must not contain "${forbidden}"`);
      }
    }
  });

  it("keeps the internal record separate from what the services type as public", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);
    const project = harness.platform.projects.createProject({ personId, organizationId });

    // The internal record does carry the fields, which is what makes the
    // omission above meaningful rather than vacuous.
    const internal = harness.platform.store.findProject(project.project.id);
    assert.equal(internal?.qualificationState, "unreviewed");
    assert.equal(internal?.internalNotes, null);

    // The public shape is what the service declares and returns.
    const summary = harness.platform.projects.getCustomerProject(
      personId,
      project.project.id,
    ).project;
    assert.deepEqual(
      Object.keys(summary).sort(),
      [
        "answeredFieldCount",
        "createdAt",
        "intakeStatus",
        "lastSavedAt",
        "reference",
        "stage",
        "stageLabel",
        "title",
        "totalFieldCount",
      ].sort(),
    );
  });
});