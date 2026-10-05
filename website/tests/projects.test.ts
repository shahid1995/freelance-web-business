/**
 * Project creation and the Owner/Admin vs ordinary-member access matrix.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ForbiddenError, NotFoundError } from "../lib/platform/errors";
import {
  MEMBER_EMAIL,
  OTHER_EMAIL,
  OWNER_EMAIL,
  addOrdinaryMember,
  createTestPlatform,
  signUpAsOwner,
} from "./support/harness";

describe("project creation", () => {
  it("creates exactly one project for one Start Your Project action", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);
    const actionKey = harness.platform.projects.newActionKey();

    const first = harness.platform.projects.createProject({
      personId,
      organizationId,
      actionKey,
    });
    const second = harness.platform.projects.createProject({
      personId,
      organizationId,
      actionKey,
    });

    assert.equal(first.created, true);
    assert.equal(second.created, false, "a repeated action must not create a second project");
    assert.equal(second.project.id, first.project.id);
    assert.equal(harness.platform.store.listProjectsByOrganization(organizationId).length, 1);
  });

  it("creates a distinct project for a different action", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);

    harness.platform.projects.createProject({
      personId,
      organizationId,
      actionKey: harness.platform.projects.newActionKey(),
    });
    harness.platform.projects.createProject({
      personId,
      organizationId,
      actionKey: harness.platform.projects.newActionKey(),
    });

    assert.equal(harness.platform.store.listProjectsByOrganization(organizationId).length, 2);
  });

  it("records the project against the correct organization", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);

    const result = harness.platform.projects.createProject({ personId, organizationId });

    assert.equal(result.project.organizationId, organizationId);
    assert.equal(result.project.createdByPersonId, personId);
    assert.match(result.project.reference, /^PRJ-[0-9A-HJKMNP-TV-Z]{5}$/);
  });

  it("creates the initial Project Intake draft automatically", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);

    const result = harness.platform.projects.createProject({ personId, organizationId });
    const stored = harness.platform.store.findProjectIntakeByProject(result.project.id);

    assert.ok(stored, "a draft must exist as soon as the project exists");
    assert.equal(stored.status, "draft");
    assert.equal(stored.projectId, result.project.id);
    assert.ok(Object.values(stored.answers).every((value) => value === null));
  });

  it("does not let an ordinary member create a project", async () => {
    const harness = await createTestPlatform();
    const { organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);
    const member = await addOrdinaryMember(harness, organizationId, MEMBER_EMAIL);

    assert.throws(
      () =>
        harness.platform.projects.createProject({
          personId: member.personId,
          organizationId,
          actionKey: harness.platform.projects.newActionKey(),
        }),
      ForbiddenError,
    );
    assert.equal(harness.platform.store.listProjectsByOrganization(organizationId).length, 0);
  });

  it("does not let one organization create a project in another", async () => {
    const harness = await createTestPlatform();
    const first = await signUpAsOwner(harness, OWNER_EMAIL, "First Synthetic Co");
    const second = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Co");

    assert.throws(
      () =>
        harness.platform.projects.createProject({
          personId: first.personId,
          organizationId: second.organizationId,
        }),
      ForbiddenError,
    );
  });
});

describe("project access matrix", () => {
  it("lets an owner see every project in the organization", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);

    const a = harness.platform.projects.createProject({ personId, organizationId });
    harness.clock.advance(1_000);
    const b = harness.platform.projects.createProject({ personId, organizationId });

    const visible = harness.platform.projects.listAccessibleProjects(personId);
    assert.equal(visible.length, 2);
    assert.deepEqual(
      visible.map((project) => project.reference).sort(),
      [a.project.reference, b.project.reference].sort(),
    );
    // The owner can open each project even without an explicit grant.
    assert.ok(harness.platform.projects.getCustomerProject(personId, a.project.id));
    assert.ok(harness.platform.projects.getCustomerProject(personId, b.project.id));
  });

  it("denies an ordinary member a project they were not assigned", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);
    const member = await addOrdinaryMember(harness, organizationId, MEMBER_EMAIL);
    const project = harness.platform.projects.createProject({ personId, organizationId });

    assert.throws(
      () => harness.platform.projects.getCustomerProject(member.personId, project.project.id),
      ForbiddenError,
    );
    assert.deepEqual(harness.platform.projects.listAccessibleProjects(member.personId), []);
  });

  it("lets an ordinary member open an explicitly assigned project", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);
    const member = await addOrdinaryMember(harness, organizationId, MEMBER_EMAIL);
    const project = harness.platform.projects.createProject({ personId, organizationId });

    harness.platform.projects.grantProjectAccess({
      personId,
      organizationId,
      projectId: project.project.id,
      memberPersonId: member.personId,
    });

    const visible = harness.platform.projects.getCustomerProject(
      member.personId,
      project.project.id,
    );
    assert.equal(visible.project.reference, project.project.reference);
    assert.deepEqual(
      harness.platform.projects.listAccessibleProjects(member.personId).map((p) => p.reference),
      [project.project.reference],
    );
  });

  it("revokes access when an assignment is removed", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);
    const member = await addOrdinaryMember(harness, organizationId, MEMBER_EMAIL);
    const project = harness.platform.projects.createProject({ personId, organizationId });

    harness.platform.projects.grantProjectAccess({
      personId,
      organizationId,
      projectId: project.project.id,
      memberPersonId: member.personId,
    });
    harness.platform.projects.revokeProjectAccess({
      personId,
      organizationId,
      projectId: project.project.id,
      memberPersonId: member.personId,
    });

    assert.throws(
      () => harness.platform.projects.getCustomerProject(member.personId, project.project.id),
      ForbiddenError,
    );
    assert.deepEqual(harness.platform.projects.listAccessibleProjects(member.personId), []);

    // The owner is unaffected by a member grant being revoked.
    assert.ok(harness.platform.projects.getCustomerProject(personId, project.project.id));
  });

  it("restores access when an assignment is granted again after revocation", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);
    const member = await addOrdinaryMember(harness, organizationId, MEMBER_EMAIL);
    const project = harness.platform.projects.createProject({ personId, organizationId });

    for (let round = 0; round < 2; round += 1) {
      harness.platform.projects.grantProjectAccess({
        personId,
        organizationId,
        projectId: project.project.id,
        memberPersonId: member.personId,
      });
      assert.ok(harness.platform.projects.getCustomerProject(member.personId, project.project.id));

      harness.platform.projects.revokeProjectAccess({
        personId,
        organizationId,
        projectId: project.project.id,
        memberPersonId: member.personId,
      });
      assert.throws(
        () => harness.platform.projects.getCustomerProject(member.personId, project.project.id),
        ForbiddenError,
      );
    }
  });

  it("does not let a member grant themselves access", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);
    const member = await addOrdinaryMember(harness, organizationId, MEMBER_EMAIL);
    const project = harness.platform.projects.createProject({ personId, organizationId });

    assert.throws(
      () =>
        harness.platform.projects.grantProjectAccess({
          personId: member.personId,
          organizationId,
          projectId: project.project.id,
          memberPersonId: member.personId,
        }),
      ForbiddenError,
    );
  });

  it("resolves a project by its customer-facing reference", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);
    const project = harness.platform.projects.createProject({ personId, organizationId });

    const resolved = harness.platform.projects.resolveProjectIdByReference(
      personId,
      project.project.reference,
    );
    assert.equal(resolved, project.project.id);

    const detail = harness.platform.projects.getCustomerProjectByReference(
      personId,
      project.project.reference,
    );
    assert.equal(detail.project.reference, project.project.reference);
  });

  it("refuses to resolve a reference the caller cannot access", async () => {
    const harness = await createTestPlatform();
    const { personId, organizationId } = await signUpAsOwner(harness, OWNER_EMAIL);
    const member = await addOrdinaryMember(harness, organizationId, MEMBER_EMAIL);
    const project = harness.platform.projects.createProject({ personId, organizationId });

    assert.throws(
      () =>
        harness.platform.projects.resolveProjectIdByReference(
          member.personId,
          project.project.reference,
        ),
      ForbiddenError,
    );

    harness.platform.projects.grantProjectAccess({
      personId,
      organizationId,
      projectId: project.project.id,
      memberPersonId: member.personId,
    });
    assert.equal(
      harness.platform.projects.resolveProjectIdByReference(
        member.personId,
        project.project.reference,
      ),
      project.project.id,
    );
  });

  it("does not resolve a reference from another organization", async () => {
    const harness = await createTestPlatform();
    const first = await signUpAsOwner(harness, OWNER_EMAIL, "First Synthetic Co");
    const second = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Co");
    const project = harness.platform.projects.createProject({
      personId: first.personId,
      organizationId: first.organizationId,
    });

    assert.throws(
      () =>
        harness.platform.projects.resolveProjectIdByReference(
          second.personId,
          project.project.reference,
        ),
      NotFoundError,
    );
  });

  it("does not confirm that a project in another organization exists", async () => {
    const harness = await createTestPlatform();
    const owner = await signUpAsOwner(harness, OWNER_EMAIL, "First Synthetic Co");
    const outsider = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Co");
    const project = harness.platform.projects.createProject({
      personId: owner.personId,
      organizationId: owner.organizationId,
    });

    // NotFound rather than Forbidden, and a genuine miss raises the same error.
    assert.throws(
      () => harness.platform.projects.getCustomerProject(outsider.personId, project.project.id),
      NotFoundError,
    );
    assert.throws(
      () => harness.platform.projects.getCustomerProject(outsider.personId, "no-such-project"),
      NotFoundError,
    );
  });
});