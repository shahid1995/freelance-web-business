/**
 * Organization creation: the verified first user, owner assignment, and the
 * guarantees that a retry cannot produce a second organization.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  requireOrganizationContext,
  resolveOrganizationContext,
} from "../lib/platform/authorization";
import { ForbiddenError, ValidationError } from "../lib/platform/errors";
import {
  OWNER_EMAIL,
  OTHER_EMAIL,
  createTestPlatform,
  signIn,
  signUpAsOwner,
} from "./support/harness";

describe("organization creation", () => {
  it("lets a verified person create an organization", async () => {
    const harness = await createTestPlatform();
    const verified = await signIn(harness, OWNER_EMAIL);

    const result = harness.platform.organizations.createForPerson(
      verified.person.id,
      "  Synthetic   Holdings Ltd  ",
    );

    assert.equal(result.created, true);
    assert.equal(result.organization.name, "Synthetic Holdings Ltd");
    assert.equal(result.membership.personId, verified.person.id);
  });

  it("makes the first user the owner", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);

    const membership = harness.platform.store.findMembershipByPerson(personId);
    assert.ok(membership);
    assert.equal(membership.role, "owner");
    assert.equal(membership.organizationId, organizationId);
  });

  it("resolves the creator to an administrator context", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);

    const context = resolveOrganizationContext(harness.platform.store, personId);
    assert.ok(context);
    assert.equal(context.isAdministrator, true);
    assert.equal(context.actor.organization.id, organizationId);
  });

  it("does not duplicate the organization when the same request is retried", async () => {
    const harness = await createTestPlatform();
    const verified = await signIn(harness, OWNER_EMAIL);

    const first = harness.platform.organizations.createForPerson(
      verified.person.id,
      "Synthetic Holdings Ltd",
    );
    const second = harness.platform.organizations.createForPerson(
      verified.person.id,
      "A Completely Different Name",
    );

    assert.equal(second.created, false);
    assert.equal(second.organization.id, first.organization.id);
    assert.equal(second.organization.name, first.organization.name, "an existing organization is not renamed by a retry");
    assert.equal(second.membership.id, first.membership.id);
  });

  it("does not duplicate the organization across a repeated sign-in", async () => {
    const harness = await createTestPlatform();
    const first = await signUpAsOwner(harness, OWNER_EMAIL);

    // A fresh sign-in link for the same address, as a customer would get.
    const second = await signIn(harness, OWNER_EMAIL);
    const result = harness.platform.organizations.createForPerson(
      second.person.id,
      "Synthetic Holdings Ltd",
    );

    assert.equal(result.created, false);
    assert.equal(result.organization.id, first.organizationId);
  });

  it("keeps a single membership per person", async () => {
    const harness = await createTestPlatform();
    const { personId } = await signUpAsOwner(harness, OWNER_EMAIL);

    assert.throws(
      () =>
        harness.platform.store.createMembership({
          id: "duplicate-membership",
          personId,
          organizationId: "some-other-organization",
          role: "member",
          now: harness.clock.now(),
        }),
      /UNIQUE constraint failed/,
    );
  });

  it("rejects an empty or over-long organization name", async () => {
    const harness = await createTestPlatform();
    const verified = await signIn(harness, OWNER_EMAIL);

    assert.throws(
      () => harness.platform.organizations.createForPerson(verified.person.id, "   "),
      ValidationError,
    );
    assert.throws(
      () => harness.platform.organizations.createForPerson(verified.person.id, "x".repeat(121)),
      ValidationError,
    );
    assert.equal(
      harness.platform.store.findMembershipByPerson(verified.person.id),
      null,
      "a rejected name must not leave a half-created organization",
    );
  });

  it("denies organization access to a person with no membership", async () => {
    const harness = await createTestPlatform();
    const verified = await signIn(harness, OTHER_EMAIL);

    const context = resolveOrganizationContext(
      harness.platform.store,
      verified.person.id,
    );
    assert.equal(context, null, "there is no organization context yet");

    assert.throws(
      () => requireOrganizationContext(harness.platform.store, verified.person.id),
      ForbiddenError,
    );
  });
});