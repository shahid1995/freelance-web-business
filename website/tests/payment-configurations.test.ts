/**
 * Payment configuration and obligations.
 *
 * Exercises the provider-neutral payment configuration slice from the approved
 * payments decision (docs/decisions/2026-10-12-payments-project-activation.md,
 * sections B.1, B.2, C.1–C.2, G, I.1, J.1, J.2) against the real services, the
 * real SQLite adapter, and the real signing flow. All identities, amounts, and
 * obligations here are synthetic. No provider is involved, no payment is
 * attempted, and nothing customer-facing is read or written.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { customerStageFor } from "../lib/platform/views";
import { isPlatformError } from "../lib/platform/errors";
import type { AuditEvent, PaymentObligationInternal } from "../lib/platform/domain";
import { generateActionKey } from "../lib/platform/secrets";
import { SqlitePlatformStore } from "../lib/platform/sqlite-store";
import {
  MEMBER_EMAIL,
  OTHER_EMAIL,
  createTestPlatform,
  signIn,
  type TestPlatform,
} from "./support/harness";
import {
  FOUNDER_HASH,
  createProposalHarness,
  ownerWithProject,
  publishFirstVersion,
  publishNextVersion,
  publishedOwner,
  type Owner,
} from "./support/proposals";

const agreementContent = "Additional terms for this synthetic agreement.";

// --- fixtures ---------------------------------------------------------------

function acceptCurrentProposal(harness: TestPlatform, owner: Owner): void {
  const proposal = harness.platform.store.findCurrentPublishedProposalVersion(owner.projectId);
  assert.ok(proposal);
  harness.platform.customerProposalResponses.submit({
    personId: owner.personId,
    projectId: owner.projectId,
    action: "accepted",
    versionNumber: proposal.versionNumber,
    message: null,
    actionKey: generateActionKey(),
  });
}

function createAgreementVersion(
  harness: TestPlatform,
  actorPersonId: string,
  projectId: string,
  versionNumber: number,
): void {
  if (versionNumber === 1) {
    harness.platform.agreements.createAgreement({
      personId: actorPersonId,
      projectId,
      additionalTerms: agreementContent,
    });
  } else {
    harness.platform.agreements.createVersion({
      personId: actorPersonId,
      projectId,
      additionalTerms: agreementContent,
    });
  }
  harness.platform.agreements.publishVersion({
    personId: actorPersonId,
    projectId,
    versionNumber,
  });
}

/**
 * An owner whose project has completed the full commercial baseline: a published
 * proposal, accepted by the customer, and an agreement version 1 signed by that
 * same customer. This is the only baseline a payment configuration may bind to.
 */
async function ownerWithSignedBaseline(harness: TestPlatform): Promise<Owner> {
  const owner = await publishedOwner(harness);
  acceptCurrentProposal(harness, owner);
  createAgreementVersion(harness, owner.personId, owner.projectId, 1);
  harness.platform.customerAgreements.sign({
    personId: owner.personId,
    projectId: owner.projectId,
    versionNumber: 1,
    actionKey: generateActionKey(),
  });
  return owner;
}

/** Advances the baseline through a second proposal version, acceptance, and signature. */
function advanceBaseline(harness: TestPlatform, owner: Owner): void {
  publishNextVersion(harness, owner, 2);
  acceptCurrentProposal(harness, owner);
  createAgreementVersion(harness, owner.personId, owner.projectId, 2);
  harness.platform.customerAgreements.sign({
    personId: owner.personId,
    projectId: owner.projectId,
    versionNumber: 2,
    actionKey: generateActionKey(),
  });
}

function baselineRefs(harness: TestPlatform, owner: Owner) {
  const proposal = harness.platform.store.findCurrentAcceptedProposalVersion(owner.projectId);
  const agreement = harness.platform.store.findCurrentSignedAgreementVersion(owner.projectId);
  assert.ok(proposal);
  assert.ok(agreement);
  return { proposalVersionId: proposal.id, agreementVersionId: agreement.id };
}

/**
 * A full-upfront configuration input. Without baseline references it carries
 * placeholder expected ids — safe for negative tests, whose rejections happen
 * during baseline validation before the references are ever compared.
 */
function configInput(owner: Owner, refs?: { proposalVersionId: string; agreementVersionId: string }) {
  return {
    personId: owner.personId,
    projectId: owner.projectId,
    scheduleStructure: "full_upfront",
    totalAmount: "1500.00",
    currency: "usd",
    obligations: [{ expectedAmount: "1500.00", currency: "usd" }],
    expectedProposalVersionId: refs?.proposalVersionId ?? "expected-proposal-version",
    expectedAgreementVersionId: refs?.agreementVersionId ?? "expected-agreement-version",
  };
}

/** Submits a configuration against the project's real current baseline. */
function createConfig(
  harness: TestPlatform,
  owner: Owner,
  overrides: Record<string, unknown> = {},
) {
  return harness.platform.paymentConfigurations.createVersion({
    ...configInput(owner, baselineRefs(harness, owner)),
    ...overrides,
  });
}

/** Submits an already-built input, for negative tests with an incomplete baseline. */
function createVersionRaw(
  harness: TestPlatform,
  input: ReturnType<typeof configInput> & Record<string, unknown>,
) {
  return harness.platform.paymentConfigurations.createVersion(input);
}

function expectRejected(action: () => unknown, code: string): void {
  assert.throws(action, (error: unknown) => isPlatformError(error) && error.code === code);
}

function expectRejectedWithMessage(action: () => unknown, pattern: RegExp): void {
  assert.throws(
    action,
    (error: unknown) =>
      isPlatformError(error) && error.code === "invalid_input" && pattern.test(error.message),
  );
}

function paymentAuditEvents(harness: TestPlatform, projectId: string): AuditEvent[] {
  return harness.platform.store
    .listAuditEventsForProject(projectId, 200)
    .filter((event) => event.type.startsWith("payment_"));
}

/**
 * Lifecycle columns this slice deliberately does not have: obligation states
 * are candidates, and due timing is unresolved (payments decision, C.3–C.4).
 */
function assertNoLifecycleFields(record: Record<string, unknown>, label: string): void {
  for (const forbidden of ["dueDate", "dueAt", "scheduledFor", "payableAt", "status", "state"]) {
    assert.equal(forbidden in record, false, `${label} must not carry a ${forbidden} field`);
  }
}

function storedVersion(harness: TestPlatform, owner: Owner, index: number) {
  return harness.platform.store.listPaymentConfigVersions(owner.projectId)[index];
}

// --- suites -----------------------------------------------------------------

describe("payment configuration and obligations", () => {
  it("lets the Founder create and read a configuration version for a synthetic project", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);

    const view = createConfig(harness, owner);

    assert.equal(view.projectReference, owner.reference);
    assert.equal(view.versions.length, 1);
    const version = view.versions[0]!;
    assert.equal(version.versionNumber, 1);
    assert.equal(version.scheduleStructure, "full_upfront");
    assert.equal(version.totalAmount, "1500.00");
    assert.equal(version.currency, "USD");
    assert.equal(version.stale, false);
    assert.equal(version.createdByPersonId, owner.personId);
    assert.equal(version.obligations.length, 1);
    assert.equal(version.obligations[0]!.orderIndex, 1);
    assert.equal(version.obligations[0]!.expectedAmount, "1500.00");
    assert.equal(version.obligations[0]!.currency, "USD");
    assert.equal(version.obligations[0]!.scopeOrMilestoneRef, null);
    assertNoLifecycleFields(version as unknown as Record<string, unknown>, "configuration version");
    assertNoLifecycleFields(
      version.obligations[0]! as unknown as Record<string, unknown>,
      "obligation",
    );

    // A separate read returns the same durable state.
    const reread = harness.platform.paymentConfigurations.read(owner.personId, owner.projectId);
    assert.deepEqual(reread, view);
  });

  it("captures the exact accepted-proposal and signed-agreement baseline references", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);

    const view = createConfig(harness, owner);
    const version = view.versions[0]!;

    const proposal = harness.platform.store.findCurrentAcceptedProposalVersion(owner.projectId);
    const agreement = harness.platform.store.findCurrentSignedAgreementVersion(owner.projectId);
    assert.ok(proposal);
    assert.ok(agreement);
    assert.equal(version.proposalId, proposal.proposalId);
    assert.equal(version.proposalVersionId, proposal.id);
    assert.equal(version.proposalVersionNumber, proposal.versionNumber);
    assert.equal(version.agreementId, agreement.agreementId);
    assert.equal(version.agreementVersionId, agreement.id);
    assert.equal(version.agreementVersionNumber, agreement.versionNumber);

    const stored = storedVersion(harness, owner, 0)!;
    assert.equal(stored.proposalVersionId, proposal.id);
    assert.equal(stored.agreementVersionId, agreement.id);
  });

  it("rejects a non-Founder even when they own or administer an organization", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);

    // The owner of a different organization.
    const otherOwner = await ownerWithProject(harness, OTHER_EMAIL, "Second Synthetic Org");
    // An administrator inside the Founder's own organization.
    const adminSession = await signIn(harness, MEMBER_EMAIL);
    harness.platform.store.createMembership({
      id: `membership-${adminSession.person.id}`,
      personId: adminSession.person.id,
      organizationId: owner.organizationId,
      role: "admin",
      now: harness.clock.now(),
    });

    const attempts = [
      { personId: otherOwner.personId, projectId: otherOwner.projectId },
      { personId: otherOwner.personId, projectId: owner.projectId },
      { personId: adminSession.person.id, projectId: owner.projectId },
    ];
    for (const attempt of attempts) {
      expectRejected(
        () =>
          harness.platform.paymentConfigurations.createVersion({
            ...configInput(owner, baselineRefs(harness, owner)),
            ...attempt,
          }),
        "forbidden",
      );
      expectRejected(
        () => harness.platform.paymentConfigurations.read(attempt.personId, attempt.projectId),
        "forbidden",
      );
    }

    // Nothing was written by any rejected actor.
    assert.equal(harness.platform.store.listPaymentConfigVersions(owner.projectId).length, 0);
    assert.equal(harness.platform.store.listPaymentObligationsByProject(owner.projectId).length, 0);
  });

  it("rejects a missing or nonexistent project", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);
    const service = harness.platform.paymentConfigurations;

    for (const projectId of ["", "   ", "does-not-exist", undefined as unknown as string]) {
      expectRejected(() => service.read(owner.personId, projectId), "not_found");
      expectRejected(
        () =>
          service.createVersion({
            ...configInput(owner, baselineRefs(harness, owner)),
            projectId,
          }),
        "not_found",
      );
    }
  });

  it("refuses creation while no accepted proposal exists", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithProject(harness);

    // No proposal at all.
    expectRejectedWithMessage(
      () => createVersionRaw(harness, configInput(owner)),
      /accepted proposal is required/i,
    );

    // A published but unaccepted proposal is still not an accepted proposal.
    publishFirstVersion(harness, owner);
    expectRejectedWithMessage(
      () => createVersionRaw(harness, configInput(owner)),
      /accepted proposal is required/i,
    );

    acceptCurrentProposal(harness, owner);
    assert.equal(harness.platform.store.listPaymentConfigVersions(owner.projectId).length, 0);
    assert.equal(paymentAuditEvents(harness, owner.projectId).length, 0);
  });

  it("refuses creation without a signed agreement and never accepts published-but-unsigned as signed evidence", async () => {
    const harness = await createProposalHarness();
    const owner = await publishedOwner(harness);
    acceptCurrentProposal(harness, owner);

    // Accepted proposal, no agreement at all.
    expectRejectedWithMessage(
      () => createVersionRaw(harness, configInput(owner)),
      /signed agreement .*required/i,
    );

    harness.platform.agreements.createAgreement({
      personId: owner.personId,
      projectId: owner.projectId,
      additionalTerms: agreementContent,
    });
    harness.platform.agreements.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
    });

    // The published version exists, but a published agreement is not signed evidence.
    const published = harness.platform.store.findCurrentAgreementVersion(owner.projectId);
    assert.equal(published?.status, "published");
    assert.equal(harness.platform.store.findCurrentSignedAgreementVersion(owner.projectId), null);

    expectRejectedWithMessage(
      () => createVersionRaw(harness, configInput(owner)),
      /published but not signed/i,
    );
    assert.equal(harness.platform.store.listPaymentConfigVersions(owner.projectId).length, 0);

    // Signing the same version makes the baseline complete.
    harness.platform.customerAgreements.sign({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
      actionKey: generateActionKey(),
    });
    const view = createConfig(harness, owner);
    assert.equal(view.versions.length, 1);
  });

  it("treats a signed agreement as inapplicable once its accepted-proposal baseline is superseded", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);
    createConfig(harness, owner);

    // A newer proposal version is published and accepted; the signed agreement
    // version 1 remains signed, but is no longer applicable to the new baseline.
    publishNextVersion(harness, owner, 2);
    acceptCurrentProposal(harness, owner);
    assert.equal(harness.platform.store.findCurrentSignedAgreementVersion(owner.projectId), null);

    expectRejectedWithMessage(
      () => createVersionRaw(harness, configInput(owner)),
      /signed agreement .*required/i,
    );
    assert.equal(harness.platform.store.listPaymentConfigVersions(owner.projectId).length, 1);
  });

  it("does not fall back to an older signed agreement while a newer applicable version is published but unsigned", async () => {
    const harness = await createProposalHarness();
    const owner = await publishedOwner(harness);
    acceptCurrentProposal(harness, owner);

    // 1-2. A current accepted proposal exists, and agreement version 1 is
    // created and signed against it.
    createAgreementVersion(harness, owner.personId, owner.projectId, 1);
    harness.platform.customerAgreements.sign({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
      actionKey: generateActionKey(),
    });

    // A configuration created while version 1 is the current applicable
    // agreement binds to it and reads as current.
    const created = createConfig(harness, owner);
    const boundVersion = created.versions[0]!;
    assert.equal(boundVersion.stale, false);
    assert.equal(boundVersion.agreementVersionNumber, 1);
    const boundObligations = structuredClone(
      harness.platform.store.listPaymentObligationsByVersion(boundVersion.id),
    );
    const auditBefore = structuredClone(paymentAuditEvents(harness, owner.projectId));

    // 3. Agreement version 2 is created and published against the same
    // accepted proposal, but left unsigned.
    createAgreementVersion(harness, owner.personId, owner.projectId, 2);
    const applicable = harness.platform.store.findCurrentAgreementVersion(owner.projectId);
    assert.equal(applicable?.versionNumber, 2);
    assert.equal(applicable?.status, "published");

    // The current applicable version is published but unsigned, so there is no
    // signed *current* version — and the superseded signed version 1 must not
    // stand in for it.
    assert.equal(harness.platform.store.findCurrentSignedAgreementVersion(owner.projectId), null);

    // 4. A new configuration is rejected rather than accepted against the
    // older signature.
    expectRejectedWithMessage(
      () => createVersionRaw(harness, configInput(owner)),
      /published but not signed/i,
    );

    // The rejected attempt left versions, obligations, and audit rows unchanged.
    const versionsAfter = harness.platform.store.listPaymentConfigVersions(owner.projectId);
    assert.equal(versionsAfter.length, 1);
    assert.deepEqual(
      harness.platform.store.listPaymentObligationsByVersion(boundVersion.id),
      boundObligations,
    );
    assert.deepEqual(paymentAuditEvents(harness, owner.projectId), auditBefore);

    // 5. The existing configuration is now stale: version 2 superseded
    // version 1 as the current applicable agreement, and version 2 is unsigned.
    const read = harness.platform.paymentConfigurations.read(owner.personId, owner.projectId);
    assert.equal(read.versions.length, 1);
    assert.equal(read.versions[0]!.id, boundVersion.id);
    assert.equal(read.versions[0]!.stale, true);
    // Its stored references are unchanged — stale, not silently rebound.
    assert.equal(read.versions[0]!.agreementVersionId, boundVersion.agreementVersionId);
    assert.equal(read.versions[0]!.agreementVersionNumber, 1);
  });

  it("keeps a signed baseline valid while a newer draft exists, and revalidates once the newer version is signed", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);
    const created = createConfig(harness, owner);
    const boundVersion = created.versions[0]!;
    assert.equal(boundVersion.stale, false);

    // An unpublished draft is not an applicable agreement version, so it cannot
    // invalidate the previously valid signed baseline.
    harness.platform.agreements.createVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      additionalTerms: agreementContent,
    });
    const signedWithDraft = harness.platform.store.findCurrentSignedAgreementVersion(
      owner.projectId,
    );
    assert.equal(signedWithDraft?.versionNumber, 1);
    assert.equal(
      harness.platform.paymentConfigurations.read(owner.personId, owner.projectId).versions[0]!
        .stale,
      false,
    );

    // Publishing version 2 makes it the current applicable agreement, so the
    // configuration becomes stale and creation is refused while it is unsigned.
    harness.platform.agreements.publishVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 2,
    });
    assert.equal(harness.platform.store.findCurrentSignedAgreementVersion(owner.projectId), null);
    expectRejectedWithMessage(
      () => createVersionRaw(harness, configInput(owner)),
      /published but not signed/i,
    );

    // Signing version 2 restores a valid current signed baseline: creation is
    // accepted again, bound to version 2, and the version 1 configuration stays
    // stale against its own historical reference.
    harness.platform.customerAgreements.sign({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 2,
      actionKey: generateActionKey(),
    });
    assert.equal(
      harness.platform.store.findCurrentSignedAgreementVersion(owner.projectId)?.versionNumber,
      2,
    );
    const afterSigning = createConfig(harness, owner);
    assert.equal(afterSigning.versions.length, 2);
    assert.equal(afterSigning.versions[1]!.agreementVersionNumber, 2);
    assert.equal(afterSigning.versions[1]!.stale, false);
    assert.equal(afterSigning.versions[0]!.id, boundVersion.id);
    assert.equal(afterSigning.versions[0]!.stale, true);
  });

  it("rejects a stale baseline reference and never silently rebinds an existing version", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);

    const first = createConfig(harness, owner);
    const firstVersion = first.versions[0]!;
    const firstStoredBefore = storedVersion(harness, owner, 0);
    const firstObligationsBefore = harness.platform.store.listPaymentObligationsByVersion(
      firstVersion.id,
    );

    advanceBaseline(harness, owner);
    const fresh = baselineRefs(harness, owner);
    assert.notEqual(fresh.proposalVersionId, firstVersion.proposalVersionId);
    assert.notEqual(fresh.agreementVersionId, firstVersion.agreementVersionId);

    // Both references stale.
    expectRejectedWithMessage(
      () =>
        createConfig(harness, owner, {
          expectedProposalVersionId: firstVersion.proposalVersionId,
          expectedAgreementVersionId: firstVersion.agreementVersionId,
        }),
      /baseline changed/i,
    );
    // Only the agreement reference stale.
    expectRejectedWithMessage(
      () =>
        createConfig(harness, owner, {
          expectedAgreementVersionId: firstVersion.agreementVersionId,
        }),
      /baseline changed/i,
    );
    // Only the proposal reference stale.
    expectRejectedWithMessage(
      () =>
        createConfig(harness, owner, {
          expectedProposalVersionId: firstVersion.proposalVersionId,
        }),
      /baseline changed/i,
    );

    // Every stale attempt left the world untouched.
    const versionsAfterFailures = harness.platform.store.listPaymentConfigVersions(owner.projectId);
    assert.equal(versionsAfterFailures.length, 1);
    assert.deepEqual(versionsAfterFailures[0], firstStoredBefore);
    assert.deepEqual(
      harness.platform.store.listPaymentObligationsByVersion(firstVersion.id),
      firstObligationsBefore,
    );

    // The current baseline is accepted and produces a distinct later version.
    const second = createConfig(harness, owner, fresh);
    assert.equal(second.versions.length, 2);
    const secondVersion = second.versions[1]!;
    assert.equal(secondVersion.versionNumber, 2);
    assert.notEqual(secondVersion.id, firstVersion.id);
    assert.equal(secondVersion.proposalVersionId, fresh.proposalVersionId);
    assert.equal(secondVersion.agreementVersionId, fresh.agreementVersionId);

    // The earlier version still references the old baseline — stale, not rebound.
    const reread = harness.platform.paymentConfigurations.read(owner.personId, owner.projectId);
    assert.equal(reread.versions[0]!.stale, true);
    assert.equal(reread.versions[0]!.proposalVersionId, firstVersion.proposalVersionId);
    assert.equal(reread.versions[0]!.agreementVersionId, firstVersion.agreementVersionId);
    assert.equal(reread.versions[1]!.stale, false);
    assert.deepEqual(
      harness.platform.store.listPaymentObligationsByVersion(firstVersion.id),
      firstObligationsBefore,
    );
  });

  it("accepts all three approved schedule structures with explicit inputs and infers nothing", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);

    // Full amount up front: one explicit obligation.
    const upfront = createConfig(harness, owner);
    const upfrontVersion = upfront.versions[0]!;
    assert.equal(upfrontVersion.scheduleStructure, "full_upfront");
    assert.equal(upfrontVersion.obligations.length, 1);
    assert.equal(upfrontVersion.obligations[0]!.expectedAmount, "1500.00");

    // A deposit plus later payments: three explicit obligations, explicit order.
    const deposit = createConfig(harness, owner, {
      scheduleStructure: "deposit_plus_later",
      totalAmount: "2400.50",
      currency: "USD",
      obligations: [
        { expectedAmount: "600.25", currency: "USD" },
        { expectedAmount: "900.25", currency: "USD" },
        { expectedAmount: "900.00", currency: "USD" },
      ],
    });
    const depositVersion = deposit.versions[1]!;
    assert.equal(depositVersion.scheduleStructure, "deposit_plus_later");
    assert.deepEqual(
      depositVersion.obligations.map((obligation) => [
        obligation.orderIndex,
        obligation.expectedAmount,
      ]),
      [
        [1, "600.25"],
        [2, "900.25"],
        [3, "900.00"],
      ],
    );

    // Milestone-linked: each obligation carries its opaque scope/milestone
    // reference, and a three-decimal currency amount is preserved exactly —
    // nothing normalizes it to two decimal places and nothing parses it as a
    // number.
    const milestone = createConfig(harness, owner, {
      scheduleStructure: "milestone_linked",
      totalAmount: "5000",
      currency: "BHD",
      obligations: [
        { expectedAmount: "2500.000", currency: "BHD", scopeOrMilestoneRef: "scope-version-alpha" },
        { expectedAmount: "2500.000", currency: "BHD", scopeOrMilestoneRef: "scope-version-beta" },
      ],
    });
    const milestoneVersion = milestone.versions[2]!;
    assert.equal(milestoneVersion.scheduleStructure, "milestone_linked");
    assert.equal(milestoneVersion.totalAmount, "5000");
    assert.equal(milestoneVersion.currency, "BHD");
    assert.deepEqual(
      milestoneVersion.obligations.map((obligation) => [
        obligation.orderIndex,
        obligation.expectedAmount,
        obligation.scopeOrMilestoneRef,
      ]),
      [
        [1, "2500.000", "scope-version-alpha"],
        [2, "2500.000", "scope-version-beta"],
      ],
    );

    // Three versions, each with exactly the obligations the Founder supplied:
    // no inferred installments, no derived percentages, no invented dates.
    for (const version of [upfrontVersion, depositVersion, milestoneVersion]) {
      assertNoLifecycleFields(
        version as unknown as Record<string, unknown>,
        version.scheduleStructure,
      );
      for (const obligation of version.obligations) {
        assertNoLifecycleFields(
          obligation as unknown as Record<string, unknown>,
          `${version.scheduleStructure} obligation`,
        );
      }
    }
    assert.equal(upfrontVersion.obligations.length, 1);
    assert.equal(depositVersion.obligations.length, 3);
    assert.equal(milestoneVersion.obligations.length, 2);

    const raw = harness.platform.store.listPaymentObligationsByVersion(milestoneVersion.id);
    assert.deepEqual(
      raw.map((obligation) => obligation.expectedAmount),
      ["2500.000", "2500.000"],
    );
    const order = harness.platform.store.listPaymentObligationsByVersion(depositVersion.id);
    assert.deepEqual(
      order.map((obligation) => obligation.orderIndex),
      [1, 2, 3],
    );
  });

  it("rejects unsupported structures and malformed money before anything is persisted", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);
    const service = harness.platform.paymentConfigurations;
    const refs = baselineRefs(harness, owner);

    const cases: Array<[string, Record<string, unknown>]> = [
      ["unknown schedule structure", { scheduleStructure: "installments_4" }],
      ["wrong-case schedule structure", { scheduleStructure: "FULL_UPFRONT" }],
      ["empty schedule structure", { scheduleStructure: "" }],
      ["non-string schedule structure", { scheduleStructure: 3 }],
      ["number amount", { totalAmount: 1500.5 }],
      ["thousands separator", { totalAmount: "1,500.00" }],
      ["trailing dot", { totalAmount: "1500." }],
      ["leading dot", { totalAmount: ".5" }],
      ["negative amount", { totalAmount: "-10" }],
      ["exponent notation", { totalAmount: "1e3" }],
      ["non-numeric amount", { totalAmount: "abc" }],
      ["empty amount", { totalAmount: "" }],
      ["zero amount", { totalAmount: "0" }],
      ["zero decimal amount", { totalAmount: "0.00" }],
      ["seven decimal places", { totalAmount: "1500.0000000" }],
      ["leading zero", { totalAmount: "007" }],
      ["short currency", { currency: "US" }],
      ["long currency", { currency: "USDD" }],
      ["word currency", { currency: "DOLLARS" }],
      ["digit currency", { currency: "U5D" }],
      ["empty currency", { currency: "" }],
      ["obligations not a list", { obligations: "none" }],
      ["empty obligations", { obligations: [] }],
      ["null obligation entry", { obligations: [null] }],
      ["obligation missing currency", { obligations: [{ expectedAmount: "10.00" }] }],
      [
        "obligation with numeric amount",
        { obligations: [{ expectedAmount: 10.0, currency: "USD" }] },
      ],
      [
        "obligation with unlisted field",
        {
          obligations: [{ expectedAmount: "10.00", currency: "USD", dueDate: "2026-11-01" }],
        },
      ],
      [
        "obligation with zero amount",
        { obligations: [{ expectedAmount: "0.00", currency: "USD" }] },
      ],
      [
        "milestone obligation without a scope reference",
        {
          scheduleStructure: "milestone_linked",
          obligations: [{ expectedAmount: "10.00", currency: "USD" }],
        },
      ],
      [
        "non-milestone obligation carrying a scope reference",
        {
          obligations: [
            { expectedAmount: "10.00", currency: "USD", scopeOrMilestoneRef: "scope-version-1" },
          ],
        },
      ],
      ["missing expected proposal version", { expectedProposalVersionId: "  " }],
      ["missing expected agreement version", { expectedAgreementVersionId: undefined }],
    ];

    for (const [label, patch] of cases) {
      assert.throws(
        () => service.createVersion({ ...configInput(owner, refs), ...patch }),
        (error: unknown) => isPlatformError(error) && error.code === "invalid_input",
        `expected ${label} to be rejected`,
      );
    }

    // Every rejection happened before persistence: no configuration, no
    // obligations, no audit rows.
    assert.equal(harness.platform.store.listPaymentConfigVersions(owner.projectId).length, 0);
    assert.equal(harness.platform.store.listPaymentObligationsByProject(owner.projectId).length, 0);
    assert.equal(paymentAuditEvents(harness, owner.projectId).length, 0);
  });

  it("accepts a configuration whose obligations all use the configuration currency, in any letter case", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);

    // One payment configuration, one currency. The lowercase configuration
    // currency and the mixed-case obligation currencies are the same code after
    // the service's existing normalization, so the whole set is accepted and
    // stored uppercase — case never decides the outcome.
    const view = createConfig(harness, owner, {
      scheduleStructure: "deposit_plus_later",
      totalAmount: "2700.00",
      currency: "usd",
      obligations: [
        { expectedAmount: "600.25", currency: "usd" },
        { expectedAmount: "900.25", currency: "USD" },
        { expectedAmount: "1199.50", currency: "uSd" },
      ],
    });

    const version = view.versions[0]!;
    assert.equal(version.currency, "USD");
    assert.deepEqual(
      version.obligations.map((obligation) => [
        obligation.orderIndex,
        obligation.expectedAmount,
        obligation.currency,
      ]),
      [
        [1, "600.25", "USD"],
        [2, "900.25", "USD"],
        [3, "1199.50", "USD"],
      ],
    );

    // The stored rows carry that one currency, and the exact decimal text is
    // untouched — no re-scaling to two decimal places, no numeric parsing.
    const stored = harness.platform.store.listPaymentObligationsByVersion(version.id);
    assert.deepEqual(
      stored.map((obligation) => obligation.currency),
      ["USD", "USD", "USD"],
    );
    assert.deepEqual(
      stored.map((obligation) => obligation.expectedAmount),
      ["600.25", "900.25", "1199.50"],
    );
    assert.equal(harness.platform.store.listPaymentConfigVersions(owner.projectId).length, 1);
  });

  it("rejects an obligation whose currency differs from the configuration currency and writes nothing", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);

    // A valid configuration first, so every rejected attempt below has real
    // persisted state it must leave untouched.
    const created = createConfig(harness, owner, {
      scheduleStructure: "deposit_plus_later",
      totalAmount: "1500.00",
      currency: "USD",
      obligations: [
        { expectedAmount: "600.00", currency: "USD" },
        { expectedAmount: "900.00", currency: "USD" },
      ],
    });
    const createdVersion = created.versions[0]!;
    const versionsBefore = structuredClone(
      harness.platform.store.listPaymentConfigVersions(owner.projectId),
    );
    const obligationsBefore = structuredClone(
      harness.platform.store.listPaymentObligationsByVersion(createdVersion.id),
    );
    const auditBefore = structuredClone(paymentAuditEvents(harness, owner.projectId));

    const cases: Array<[string, Record<string, unknown>, RegExp]> = [
      [
        "the only obligation in another currency",
        { currency: "USD", obligations: [{ expectedAmount: "100.00", currency: "EUR" }] },
        /Obligation 1's currency \(EUR\) must match the project currency \(USD\)/,
      ],
      [
        "a later obligation in another currency",
        {
          currency: "USD",
          obligations: [
            { expectedAmount: "100.00", currency: "USD" },
            { expectedAmount: "200.00", currency: "EUR" },
          ],
        },
        /Obligation 2's currency \(EUR\) must match the project currency \(USD\)/,
      ],
      [
        "a lowercase configuration currency against another currency",
        { currency: "usd", obligations: [{ expectedAmount: "100.00", currency: "EUR" }] },
        /Obligation 1's currency \(EUR\) must match the project currency \(USD\)/,
      ],
      [
        "a lowercase obligation currency against another currency",
        { currency: "USD", obligations: [{ expectedAmount: "100.00", currency: "eur" }] },
        /Obligation 1's currency \(EUR\) must match the project currency \(USD\)/,
      ],
      [
        "the configuration in another currency than its obligation",
        { currency: "EUR", obligations: [{ expectedAmount: "100.00", currency: "USD" }] },
        /Obligation 1's currency \(USD\) must match the project currency \(EUR\)/,
      ],
      [
        "a milestone-linked obligation in another currency",
        {
          scheduleStructure: "milestone_linked",
          totalAmount: "300.00",
          currency: "USD",
          obligations: [
            {
              expectedAmount: "300.00",
              currency: "EUR",
              scopeOrMilestoneRef: "scope-version-alpha",
            },
          ],
        },
        /Obligation 1's currency \(EUR\) must match the project currency \(USD\)/,
      ],
    ];

    for (const [label, patch, pattern] of cases) {
      expectRejectedWithMessage(() => createConfig(harness, owner, patch), pattern);
    }

    // Nothing was converted, appended, or audited: the configuration versions,
    // the existing obligations, and the payment audit trail are unchanged.
    assert.deepEqual(
      harness.platform.store.listPaymentConfigVersions(owner.projectId),
      versionsBefore,
    );
    assert.deepEqual(
      harness.platform.store.listPaymentObligationsByVersion(createdVersion.id),
      obligationsBefore,
    );
    assert.deepEqual(paymentAuditEvents(harness, owner.projectId), auditBefore);
    assert.equal(harness.platform.store.listPaymentObligationsByProject(owner.projectId).length, 2);
  });

  it("keeps obligation membership and project association unambiguous", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);

    const view = createConfig(harness, owner, {
      scheduleStructure: "deposit_plus_later",
      totalAmount: "1000.00",
      obligations: [
        { expectedAmount: "250.00", currency: "USD" },
        { expectedAmount: "750.00", currency: "USD" },
      ],
    });
    const version = view.versions[0]!;

    const byVersion = harness.platform.store.listPaymentObligationsByVersion(version.id);
    assert.equal(byVersion.length, 2);
    for (const obligation of byVersion) {
      assert.equal(obligation.paymentConfigVersionId, version.id);
      assert.equal(obligation.projectId, owner.projectId);
      assert.equal(obligation.organizationId, owner.organizationId);
      assert.equal(obligation.createdByPersonId, owner.personId);
    }

    // The project-scoped read returns exactly this version's obligations.
    const byProject = harness.platform.store.listPaymentObligationsByProject(owner.projectId);
    assert.deepEqual(
      byProject.map((obligation) => obligation.id),
      byVersion.map((obligation) => obligation.id),
    );
    assert.deepEqual(
      byProject.map((obligation) => obligation.orderIndex),
      [1, 2],
    );
  });

  it("appends a new version instead of overwriting, leaving earlier versions and obligations intact", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);

    const first = createConfig(harness, owner, {
      scheduleStructure: "deposit_plus_later",
      totalAmount: "800.00",
      obligations: [
        { expectedAmount: "200.00", currency: "USD" },
        { expectedAmount: "600.00", currency: "USD" },
      ],
    });
    const firstVersion = first.versions[0]!;
    const firstRowBefore = structuredClone(storedVersion(harness, owner, 0));
    const firstObligationsBefore = structuredClone(
      harness.platform.store.listPaymentObligationsByVersion(firstVersion.id),
    );

    const second = createConfig(harness, owner, {
      totalAmount: "999.00",
      obligations: [{ expectedAmount: "999.00", currency: "USD" }],
    });

    const versions = harness.platform.store.listPaymentConfigVersions(owner.projectId);
    assert.equal(versions.length, 2);
    assert.equal(versions[0]!.versionNumber, 1);
    assert.equal(versions[1]!.versionNumber, 2);
    assert.notEqual(versions[1]!.id, versions[0]!.id);
    // The earlier version and its obligations are byte-identical to before.
    assert.deepEqual(structuredClone(versions[0]), firstRowBefore);
    assert.deepEqual(
      structuredClone(harness.platform.store.listPaymentObligationsByVersion(firstVersion.id)),
      firstObligationsBefore,
    );
    assert.deepEqual(
      second.versions.map((version) => version.versionNumber),
      [1, 2],
    );

    // The database itself refuses a duplicate version number, so the first
    // version cannot be overwritten even through the store port directly.
    assert.throws(() =>
      harness.platform.store.createPaymentConfigVersion({
        ...firstRowBefore!,
        id: "rewritten-version-id",
      }),
    );
    assert.deepEqual(structuredClone(storedVersion(harness, owner, 0)), firstRowBefore);
  });

  it("keeps one project's configuration and obligations out of another project's reads", async () => {
    const harness = await createProposalHarness();
    const first = await ownerWithSignedBaseline(harness);

    // A second project, in another organization, with its own completed baseline.
    // The Founder authors on it; the second owner is the customer who accepts
    // and signs.
    const second = await ownerWithProject(harness, OTHER_EMAIL, "Second Synthetic Org");
    publishFirstVersion(harness, { personId: first.personId, projectId: second.projectId });
    acceptCurrentProposal(harness, second);
    createAgreementVersion(harness, first.personId, second.projectId, 1);
    harness.platform.customerAgreements.sign({
      personId: second.personId,
      projectId: second.projectId,
      versionNumber: 1,
      actionKey: generateActionKey(),
    });

    const firstView = createConfig(harness, first, {
      obligations: [
        { expectedAmount: "100.00", currency: "USD" },
        { expectedAmount: "1400.00", currency: "USD" },
      ],
      totalAmount: "1500.00",
    });
    const secondView = createConfig(harness, second, {
      personId: first.personId,
      totalAmount: "4000.00",
      currency: "EUR",
      obligations: [{ expectedAmount: "4000.00", currency: "EUR" }],
    });

    const readFirst = harness.platform.paymentConfigurations.read(first.personId, first.projectId);
    const readSecond = harness.platform.paymentConfigurations.read(first.personId, second.projectId);

    assert.equal(readFirst.projectReference, first.reference);
    assert.equal(readSecond.projectReference, second.reference);
    assert.deepEqual(
      readFirst.versions.map((version) => version.id),
      [firstView.versions[0]!.id],
    );
    assert.deepEqual(
      readSecond.versions.map((version) => version.id),
      [secondView.versions[0]!.id],
    );

    // Every obligation read for one project belongs to that project only.
    const firstObligations = harness.platform.store.listPaymentObligationsByProject(first.projectId);
    const secondObligations = harness.platform.store.listPaymentObligationsByProject(
      second.projectId,
    );
    assert.equal(firstObligations.length, 2);
    assert.equal(secondObligations.length, 1);
    for (const obligation of firstObligations) {
      assert.equal(obligation.projectId, first.projectId);
    }
    for (const obligation of secondObligations) {
      assert.equal(obligation.projectId, second.projectId);
    }
    assert.deepEqual(
      readFirst.versions[0]!.obligations.map((obligation) => obligation.expectedAmount),
      ["100.00", "1400.00"],
    );
    assert.deepEqual(
      readSecond.versions[0]!.obligations.map((obligation) => obligation.expectedAmount),
      ["4000.00"],
    );
  });

  it("writes identifier-only audit events in the same transaction as the records", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);

    createConfig(harness, owner, {
      scheduleStructure: "deposit_plus_later",
      totalAmount: "600.25",
      obligations: [
        { expectedAmount: "200.15", currency: "USD" },
        { expectedAmount: "400.10", currency: "USD" },
      ],
    });

    const events = paymentAuditEvents(harness, owner.projectId);
    assert.equal(events.length, 3);
    assert.deepEqual(
      events
        .map((event) => event.type)
        .sort(),
      ["payment_config_version.created", "payment_obligation.created", "payment_obligation.created"],
    );

    const version = harness.platform.store.listPaymentConfigVersions(owner.projectId)[0]!;
    const obligations = harness.platform.store.listPaymentObligationsByVersion(version.id);
    const allowedKeys = new Set([
      "paymentConfigVersionId",
      "versionNumber",
      "proposalVersionId",
      "agreementVersionId",
      "obligationId",
    ]);
    for (const event of events) {
      assert.equal(event.projectId, owner.projectId);
      assert.equal(event.organizationId, owner.organizationId);
      assert.equal(event.personId, owner.personId);
      assert.ok(event.metadata);
      for (const key of Object.keys(event.metadata)) {
        assert.ok(allowedKeys.has(key), `unexpected audit metadata key: ${key}`);
        assert.equal(/amount|currency|due|scope/i.test(key), false, `sensitive key ${key}`);
      }
      const serialized = JSON.stringify(event.metadata);
      // Decimal amounts contain a dot, which cannot occur inside the
      // identifier-shaped values; this proves no amount travelled into audit.
      assert.equal(serialized.includes("600.25"), false);
      assert.equal(serialized.includes("200.15"), false);
      assert.equal(serialized.includes("400.10"), false);
    }

    const configEvent = events.find((event) => event.type === "payment_config_version.created")!;
    assert.deepEqual(Object.keys(configEvent.metadata!).sort(), [
      "agreementVersionId",
      "paymentConfigVersionId",
      "proposalVersionId",
      "versionNumber",
    ]);
    assert.equal(configEvent.metadata!.versionNumber, 1);
    assert.equal(configEvent.metadata!.paymentConfigVersionId, version.id);
    assert.equal(configEvent.metadata!.proposalVersionId, version.proposalVersionId);
    assert.equal(configEvent.metadata!.agreementVersionId, version.agreementVersionId);

    const obligationEvents = events.filter((event) => event.type === "payment_obligation.created");
    assert.deepEqual(
      obligationEvents.map((event) => event.metadata!.obligationId).sort(),
      obligations.map((obligation) => obligation.id).sort(),
    );
    for (const event of obligationEvents) {
      assert.deepEqual(Object.keys(event.metadata!).sort(), [
        "obligationId",
        "paymentConfigVersionId",
      ]);
      assert.equal(event.metadata!.paymentConfigVersionId, version.id);
    }
  });

  it("rolls back the configuration, obligations, and audit rows when the config audit append fails", async () => {
    class FailingConfigAuditStore extends SqlitePlatformStore {
      override appendAuditEvent(event: AuditEvent): void {
        if (event.type === "payment_config_version.created") {
          throw new Error("Simulated audit failure.");
        }
        super.appendAuditEvent(event);
      }
    }

    const harness = await createTestPlatform({
      config: { founderEmailHashes: [FOUNDER_HASH] },
      createOptions: { store: new FailingConfigAuditStore(":memory:") },
    });
    const owner = await ownerWithSignedBaseline(harness);

    assert.throws(() => createConfig(harness, owner), /Simulated audit failure/);
    assert.equal(harness.platform.store.listPaymentConfigVersions(owner.projectId).length, 0);
    assert.equal(harness.platform.store.listPaymentObligationsByProject(owner.projectId).length, 0);
    assert.equal(paymentAuditEvents(harness, owner.projectId).length, 0);
  });

  it("rolls everything back when a later obligation write fails", async () => {
    class FailingObligationStore extends SqlitePlatformStore {
      private attempts = 0;
      override createPaymentObligation(
        input: PaymentObligationInternal,
      ): PaymentObligationInternal {
        this.attempts += 1;
        if (this.attempts === 2) {
          throw new Error("Simulated obligation failure.");
        }
        return super.createPaymentObligation(input);
      }
    }

    const harness = await createTestPlatform({
      config: { founderEmailHashes: [FOUNDER_HASH] },
      createOptions: { store: new FailingObligationStore(":memory:") },
    });
    const owner = await ownerWithSignedBaseline(harness);

    assert.throws(
      () =>
        createConfig(harness, owner, {
          scheduleStructure: "deposit_plus_later",
          totalAmount: "1000.00",
          obligations: [
            { expectedAmount: "250.00", currency: "USD" },
            { expectedAmount: "750.00", currency: "USD" },
          ],
        }),
      /Simulated obligation failure/,
    );
    // The version row, the first obligation, and the first obligation's audit
    // event all rolled back with the failed second write.
    assert.equal(harness.platform.store.listPaymentConfigVersions(owner.projectId).length, 0);
    assert.equal(harness.platform.store.listPaymentObligationsByProject(owner.projectId).length, 0);
    assert.equal(paymentAuditEvents(harness, owner.projectId).length, 0);
  });

  it("rolls back the config version and its audit event when an obligation audit append fails", async () => {
    class FailingObligationAuditStore extends SqlitePlatformStore {
      override appendAuditEvent(event: AuditEvent): void {
        if (event.type === "payment_obligation.created") {
          throw new Error("Simulated obligation audit failure.");
        }
        super.appendAuditEvent(event);
      }
    }

    const harness = await createTestPlatform({
      config: { founderEmailHashes: [FOUNDER_HASH] },
      createOptions: { store: new FailingObligationAuditStore(":memory:") },
    });
    const owner = await ownerWithSignedBaseline(harness);

    assert.throws(() => createConfig(harness, owner), /Simulated obligation audit failure/);
    assert.equal(harness.platform.store.listPaymentConfigVersions(owner.projectId).length, 0);
    assert.equal(harness.platform.store.listPaymentObligationsByProject(owner.projectId).length, 0);
    assert.equal(paymentAuditEvents(harness, owner.projectId).length, 0);
  });

  it("keeps the configuration and obligations readable after reopening a persistent database", async () => {
    const directory = mkdtempSync(join(tmpdir(), "payments-config-"));
    const databasePath = join(directory, "payments.db");
    try {
      const first = await createTestPlatform({
        config: { databasePath, founderEmailHashes: [FOUNDER_HASH] },
      });
      const owner = await ownerWithSignedBaseline(first);
      const created = createConfig(first, owner, {
        scheduleStructure: "deposit_plus_later",
        totalAmount: "2400.50",
        obligations: [
          { expectedAmount: "600.25", currency: "USD" },
          { expectedAmount: "1800.25", currency: "USD" },
        ],
      });
      const createdVersion = created.versions[0]!;
      first.platform.close();

      const second = await createTestPlatform({
        config: { databasePath, founderEmailHashes: [FOUNDER_HASH] },
      });
      const reread = second.platform.paymentConfigurations.read(owner.personId, owner.projectId);
      assert.equal(reread.versions.length, 1);
      const version = reread.versions[0]!;
      assert.equal(version.id, createdVersion.id);
      assert.equal(version.versionNumber, 1);
      assert.equal(version.scheduleStructure, "deposit_plus_later");
      assert.equal(version.totalAmount, "2400.50");
      assert.equal(version.currency, "USD");
      assert.equal(version.stale, false);
      assert.deepEqual(
        version.obligations.map((obligation) => [obligation.id, obligation.expectedAmount]),
        createdVersion.obligations.map((obligation) => [obligation.id, obligation.expectedAmount]),
      );
      second.platform.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("changes no project row, customer stage, or customer agreement view", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithSignedBaseline(harness);

    const projectBefore = harness.platform.store.findProject(owner.projectId);
    assert.ok(projectBefore);
    const stageBefore = customerStageFor({ status: "submitted" }, projectBefore.reviewStartedAt);
    const customerViewBefore = harness.platform.customerAgreements.readByProjectId(
      owner.personId,
      owner.projectId,
    );

    createConfig(harness, owner);

    const projectAfter = harness.platform.store.findProject(owner.projectId);
    assert.deepEqual(projectAfter, projectBefore);
    assert.equal(
      customerStageFor({ status: "submitted" }, projectAfter!.reviewStartedAt),
      stageBefore,
    );
    const customerViewAfter = harness.platform.customerAgreements.readByProjectId(
      owner.personId,
      owner.projectId,
    );
    assert.deepEqual(customerViewAfter, customerViewBefore);
    // The customer-facing view carries no payment fields at all.
    assert.equal(/payment|obligation/i.test(JSON.stringify(customerViewAfter)), false);

    // Existing proposal and agreement behaviour is unchanged by a configuration.
    publishNextVersion(harness, owner, 2);
    acceptCurrentProposal(harness, owner);
    const accepted = harness.platform.store.findCurrentAcceptedProposalVersion(owner.projectId);
    assert.equal(accepted?.versionNumber, 2);
  });
});
