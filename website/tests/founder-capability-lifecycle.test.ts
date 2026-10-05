/**
 * Founder capability lifecycle.
 *
 * The approved Founder Workspace ADR (section 2.1, approved wording) fixes this
 * list as **initial assignment**, not a live allow-list: the configured address
 * hashes are the controlled bootstrap "by which the initial `founder` capability
 * is assigned", and once assigned the stored grant is authoritative.
 *
 * These tests pin that lifecycle so it cannot drift by accident, and cover the
 * two properties a bootstrap-based capability most easily gets wrong: removing
 * the configuration must not quietly become a revocation mechanism, and a
 * customer role must never stand in for the capability.
 *
 * The behavior asserted here is also recorded in `internal.ts` and
 * `website/README.md`, including the known limitation that a revocation made
 * while the hash is still configured would be undone by the next internal call.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPlatform } from "../lib/platform/container";
import type { PlatformConfig } from "../lib/platform/config";
import { isPlatformError } from "../lib/platform/errors";
import { emailHash } from "../lib/platform/secrets";
import {
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

const FOUNDER_HASH = emailHash(OWNER_EMAIL);

/**
 * A second container over the same store with a different capability
 * configuration — the way a configuration change looks to a running process,
 * without needing to reopen the database.
 */
async function withFounderHashes(
  harness: TestPlatform,
  founderEmailHashes: string[],
) {
  return createPlatform({
    config: { ...harness.platform.config, founderEmailHashes },
    clock: harness.clock,
    email: harness.email,
    store: harness.platform.store,
    signInPath: "/api/auth/verify",
  });
}

/** A submitted project owned by OWNER_EMAIL, so review is possible. */
async function harnessWithSubmittedProject(config: Partial<PlatformConfig>) {
  const harness = await createTestPlatform({ config });
  const owner = await signUpAsOwnerWithProject(harness, OWNER_EMAIL);
  harness.platform.intake.submit(owner.personId, owner.projectId);
  return {
    harness,
    personId: owner.personId,
    organizationId: owner.organizationId,
    projectId: owner.projectId,
    sessionId: owner.sessionId,
  };
}

describe("founder capability lifecycle", () => {
  it("grants the capability to a configured Founder on first internal use", async () => {
    const { harness, personId, projectId } = await harnessWithSubmittedProject({
      founderEmailHashes: [FOUNDER_HASH],
    });

    assert.equal(harness.platform.store.findInternalCapability(personId, "founder"), null);

    harness.platform.internal.review(personId, projectId);

    const grant = harness.platform.store.findInternalCapability(personId, "founder");
    assert.ok(grant, "the bootstrap must assign the capability");
    assert.equal(grant.revokedAt, null);
    harness.platform.close();
  });

  it("does not grant the capability to an unconfigured person", async () => {
    const harness = await createTestPlatform({ config: { founderEmailHashes: [FOUNDER_HASH] } });
    const owner = await signUpAsOwnerWithProject(harness, OWNER_EMAIL);
    const stranger = await signIn(harness, MEMBER_EMAIL);

    assert.throws(
      () => harness.platform.internal.review(stranger.person.id, owner.projectId),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
    assert.equal(
      harness.platform.store.findInternalCapability(stranger.person.id, "founder"),
      null,
    );
    harness.platform.close();
  });

  it("keeps an organization owner/admin forbidden without the capability", async () => {
    const harness = await createTestPlatform({ config: { founderEmailHashes: [FOUNDER_HASH] } });
    const owner = await signUpAsOwnerWithProject(harness, OWNER_EMAIL);
    // Owner/admin of the very organization that owns the project.
    const admin = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");

    assert.throws(
      () => harness.platform.internal.review(admin.personId, owner.projectId),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
    assert.equal(harness.platform.store.findInternalCapability(admin.personId, "founder"), null);
    harness.platform.close();
  });

  it("does not revoke a persisted capability when the configuration is removed later", async () => {
    // Initial assignment: the hash is present when the Founder first uses it.
    const { harness, personId, projectId } = await harnessWithSubmittedProject({
      founderEmailHashes: [FOUNDER_HASH],
    });
    harness.platform.internal.review(personId, projectId);

    // The configuration is then removed, as a deployment restart would see it.
    const withoutConfiguration = await withFounderHashes(harness, []);

    // Bootstrap-only persistence: the stored grant is authoritative, so removing
    // configuration is not a revocation mechanism.
    assert.doesNotThrow(() => withoutConfiguration.internal.review(personId, projectId));
    const grant = harness.platform.store.findInternalCapability(personId, "founder");
    assert.ok(grant);
    assert.equal(grant.revokedAt, null, "removing configuration must not revoke the grant");

    harness.platform.close();
  });

  it("never grants access to someone who never held a row, whatever the configuration", async () => {
    const harness = await createTestPlatform({ config: { founderEmailHashes: [] } });
    const owner = await signUpAsOwnerWithProject(harness, OWNER_EMAIL);
    const stranger = await signIn(harness, MEMBER_EMAIL);

    assert.throws(
      () => harness.platform.internal.review(stranger.person.id, owner.projectId),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
    assert.equal(
      harness.platform.store.findInternalCapability(stranger.person.id, "founder"),
      null,
      "an empty configuration must not create a grant row",
    );
    harness.platform.close();
  });

  it("assigns the capability when a hash is configured later for someone without a row", async () => {
    const harness = await createTestPlatform({ config: { founderEmailHashes: [] } });
    const owner = await signUpAsOwnerWithProject(harness, OWNER_EMAIL);
    const stranger = await signIn(harness, MEMBER_EMAIL);

    assert.throws(
      () => harness.platform.internal.review(stranger.person.id, owner.projectId),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );

    // Configuring the address later is the initial assignment for this person.
    const withConfiguration = await withFounderHashes(harness, [emailHash(MEMBER_EMAIL)]);
    assert.doesNotThrow(() => withConfiguration.internal.review(stranger.person.id, owner.projectId));
    assert.ok(
      harness.platform.store.findInternalCapability(stranger.person.id, "founder"),
      "a later-configured hash must assign the capability",
    );
    harness.platform.close();
  });

  it("records the known limitation: a revocation is re-established while the hash stays configured", async () => {
    // This is the current behavior, pinned deliberately. Nothing in this slice
    // revokes, so the path is unreachable today; durable revocation needs its own
    // decision before any administration surface is added. See internal.ts.
    const { harness, personId, projectId } = await harnessWithSubmittedProject({
      founderEmailHashes: [FOUNDER_HASH],
    });
    harness.platform.internal.review(personId, projectId);

    const revoked = harness.platform.store.revokeInternalCapability({
      personId,
      capability: "founder",
      now: harness.clock.now(),
    });
    assert.equal(revoked, true);

    harness.platform.internal.review(personId, projectId);
    const grant = harness.platform.store.findInternalCapability(personId, "founder");
    assert.equal(
      grant?.revokedAt,
      null,
      "documented limitation: the bootstrap re-grants a revoked capability",
    );
    harness.platform.close();
  });

  it("cannot grant or revoke the capability through customer endpoints", async () => {
    const harness = await createTestPlatform({ config: { founderEmailHashes: [FOUNDER_HASH] } });
    const owner = await signUpAsOwnerWithProject(harness, OWNER_EMAIL);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);

    // Full customer journey for both people.
    harness.platform.intake.saveDraft({
      personId: owner.personId,
      projectId: owner.projectId,
      patch: { serviceNeed: "Synthetic" },
    });
    harness.platform.intake.submit(owner.personId, owner.projectId);
    harness.platform.projects.listAccessibleProjects(member.personId);

    // No customer flow creates a capability row.
    assert.equal(harness.platform.store.findInternalCapability(owner.personId, "founder"), null);
    assert.equal(harness.platform.store.findInternalCapability(member.personId, "founder"), null);

    // And customer activity cannot disturb an existing Founder grant.
    harness.platform.internal.review(owner.personId, owner.projectId);
    const grantedAt = harness.platform.store.findInternalCapability(owner.personId, "founder")
      ?.grantedAt;
    // Ordinary-member activity is limited to listing, so use calls both people can
    // actually make rather than one that would fail on access rules.
    harness.platform.projects.listAccessibleProjects(member.personId);
    harness.platform.intake.read(owner.personId, owner.projectId);

    const after = harness.platform.store.findInternalCapability(owner.personId, "founder");
    assert.equal(after?.revokedAt, null, "customer activity must not revoke a grant");
    assert.equal(after?.grantedAt, grantedAt);
    harness.platform.close();
  });

  it("keeps the capability out of every customer response", async () => {
    const { harness, personId, projectId } = await harnessWithSubmittedProject({
      founderEmailHashes: [FOUNDER_HASH],
    });
    harness.platform.internal.review(personId, projectId);

    const customerView = harness.platform.intake.read(personId, projectId);
    const summary = harness.platform.projects.listAccessibleProjects(personId);
    const serialized = JSON.stringify([customerView, summary]);

    assert.equal(serialized.includes("founder"), false);
    assert.equal(serialized.includes("capability"), false);
    assert.equal(serialized.includes("founderEmailHashes"), false);
    harness.platform.close();
  });
});

describe("internal field input validation", () => {
  it("rejects a non-string internal note without writing", async () => {
    const { harness, personId, projectId } = await harnessWithSubmittedProject({
      founderEmailHashes: [FOUNDER_HASH],
    });

    for (const value of [42, true, { text: "no" }, ["no"]]) {
      assert.throws(
        () =>
          harness.platform.internal.recordInternalNotes({
            personId,
            projectId,
            notes: value,
          }),
        (error: unknown) => isPlatformError(error) && error.code === "invalid_input",
        `notes ${JSON.stringify(value)} must be rejected`,
      );
    }
    assert.equal(harness.platform.store.findProject(projectId)?.internalNotes, null);
    harness.platform.close();
  });

  it("rejects an over-long internal note without writing", async () => {
    const { harness, personId, projectId } = await harnessWithSubmittedProject({
      founderEmailHashes: [FOUNDER_HASH],
    });

    assert.throws(
      () =>
        harness.platform.internal.recordInternalNotes({
          personId,
          projectId,
          notes: "x".repeat(5001),
        }),
      (error: unknown) => isPlatformError(error) && error.code === "invalid_input",
    );
    assert.equal(harness.platform.store.findProject(projectId)?.internalNotes, null);
    harness.platform.close();
  });

  it("rejects a non-string internal next action without writing", async () => {
    const { harness, personId, projectId } = await harnessWithSubmittedProject({
      founderEmailHashes: [FOUNDER_HASH],
    });

    assert.throws(
      () =>
        harness.platform.internal.recordInternalNextAction({
          personId,
          projectId,
          nextAction: 42,
        }),
      (error: unknown) => isPlatformError(error) && error.code === "invalid_input",
    );
    assert.equal(harness.platform.store.findProject(projectId)?.internalNextAction, null);
    harness.platform.close();
  });

  it("clears an internal note when it is emptied", async () => {
    const { harness, personId, projectId } = await harnessWithSubmittedProject({
      founderEmailHashes: [FOUNDER_HASH],
    });

    harness.platform.internal.recordInternalNotes({
      personId,
      projectId,
      notes: "something",
    });
    harness.platform.internal.recordInternalNotes({ personId, projectId, notes: "   " });
    assert.equal(harness.platform.store.findProject(projectId)?.internalNotes, null);
    harness.platform.close();
  });
});
