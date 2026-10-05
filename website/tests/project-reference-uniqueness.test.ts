/**
 * Project reference uniqueness.
 *
 * A project reference is customer-visible, so it has to identify exactly one
 * project across the whole platform. It was originally constrained only within
 * an organization, which left two organizations able to hold the same reference —
 * and any lookup not scoped to an organization would then have had no single
 * right answer.
 *
 * These tests hold three things at once: the database refuses the duplicate, the
 * allocator does not produce one in the first place, and the existing customer
 * organization-scoped lookup and project-access rules are unchanged.
 *
 * The legacy-database case is included deliberately. A database that already
 * contains cross-organization duplicates must fail to open with a clear message,
 * not silently renumber or deduplicate customer-visible references.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { DatabaseSync } from "node:sqlite";

import { isPlatformError } from "../lib/platform/errors";
import { SqlitePlatformStore } from "../lib/platform/sqlite-store";
import type { ProjectInternal } from "../lib/platform/domain";
import { emailHash } from "../lib/platform/secrets";
import {
  MEMBER_EMAIL,
  OTHER_EMAIL,
  OWNER_EMAIL,
  addOrdinaryMember,
  createTestPlatform,
  signUpAsOwner,
  signUpAsOwnerWithProject,
} from "./support/harness";

/** Builds a project record with a caller-chosen reference, for collision setup. */
function fixedProject(input: {
  id: string;
  organizationId: string;
  createdByPersonId: string;
  reference: string;
  now: number;
}): ProjectInternal {
  return {
    id: input.id,
    organizationId: input.organizationId,
    reference: input.reference,
    title: "Synthetic project",
    createdByPersonId: input.createdByPersonId,
    createdAt: input.now,
    updatedAt: input.now,
    reviewStartedAt: null,
    qualificationState: "unreviewed",
    internalNotes: null,
    founderDecision: null,
    internalNextAction: null,
  };
}

describe("project reference uniqueness", () => {
  it("refuses the same reference in two different organizations", async () => {
    const harness = await createTestPlatform();
    const first = await signUpAsOwner(harness, OWNER_EMAIL, "First Synthetic Org");
    const second = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");

    const created = harness.platform.store.createProject({
      project: fixedProject({
        id: "project-first",
        organizationId: first.organizationId,
        createdByPersonId: first.personId,
        reference: "PRJ-DUP001",
        now: harness.clock.now(),
      }),
      idempotencyKey: null,
    });
    assert.equal(created.reference, "PRJ-DUP001");

    // The duplicate is refused by the database, not by an application check, so
    // it cannot be bypassed by any caller that reaches the store port.
    assert.throws(() =>
      harness.platform.store.createProject({
        project: fixedProject({
          id: "project-second",
          organizationId: second.organizationId,
          createdByPersonId: second.personId,
          reference: "PRJ-DUP001",
          now: harness.clock.now(),
        }),
        idempotencyKey: null,
      }),
    );

    // The original is untouched and still readable by the customer path.
    assert.equal(
      harness.platform.store.findProject(created.id)?.reference,
      "PRJ-DUP001",
    );
    harness.platform.close();
  });

  it("refuses the same reference within one organization", async () => {
    const harness = await createTestPlatform();
    const owner = await signUpAsOwner(harness, OWNER_EMAIL);

    harness.platform.store.createProject({
      project: fixedProject({
        id: "project-a",
        organizationId: owner.organizationId,
        createdByPersonId: owner.personId,
        reference: "PRJ-SAMEORG",
        now: harness.clock.now(),
      }),
      idempotencyKey: null,
    });

    assert.throws(() =>
      harness.platform.store.createProject({
        project: fixedProject({
          id: "project-b",
          organizationId: owner.organizationId,
          createdByPersonId: owner.personId,
          reference: "PRJ-SAMEORG",
          now: harness.clock.now(),
        }),
        idempotencyKey: null,
      }),
    );
    harness.platform.close();
  });

  it("allocates references by checking the whole platform, not one organization", async () => {
    const harness = await createTestPlatform();
    const owner = await signUpAsOwner(harness, OWNER_EMAIL);
    const store = harness.platform.store;
    const original = store.findProjectByReferenceGlobal.bind(store);
    const attempted: string[] = [];

    // Force the first candidate to look like a collision held by another
    // organization, which is only detectable if the allocator consults the
    // global lookup rather than one scoped to the allocating organization.
    store.findProjectByReferenceGlobal = (reference: string) => {
      attempted.push(reference);
      if (attempted.length === 1) {
        return fixedProject({
          id: "colliding-project",
          organizationId: "some-other-organization",
          createdByPersonId: "some-other-person",
          reference,
          now: harness.clock.now(),
        });
      }
      return original(reference);
    };

    try {
      const result = harness.platform.projects.createProject({
        personId: owner.personId,
        organizationId: owner.organizationId,
      });

      assert.ok(attempted.length >= 2, "the allocator must retry after a collision");
      assert.equal(result.project.reference, attempted[attempted.length - 1]);
      assert.notEqual(
        result.project.reference,
        attempted[0],
        "the colliding candidate must not be used",
      );
      assert.equal(
        store.findProjectByReferenceGlobal(result.project.reference)?.id,
        result.project.id,
      );
    } finally {
      store.findProjectByReferenceGlobal = original;
      harness.platform.close();
    }
  });

  it("produces globally distinct references across organizations", async () => {
    const harness = await createTestPlatform();
    const first = await signUpAsOwner(harness, OWNER_EMAIL, "First Synthetic Org");
    const second = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");

    const references: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      const owner = index % 2 === 0 ? first : second;
      const result = harness.platform.projects.createProject({
        personId: owner.personId,
        organizationId: owner.organizationId,
      });
      references.push(result.project.reference);
    }

    assert.equal(new Set(references).size, references.length);

    // Every allocated reference resolves to exactly one project globally.
    for (const reference of references) {
      const found = harness.platform.store.findProjectByReferenceGlobal(reference);
      assert.ok(found, `${reference} must resolve globally`);
      assert.equal(found.reference, reference);
    }
    harness.platform.close();
  });

  it("lets the Founder lookup resolve exactly one project by reference", async () => {
    const harness = await createTestPlatform({
      config: { founderEmailHashes: [emailHash(OWNER_EMAIL)] },
    });
    const first = await signUpAsOwnerWithProject(harness, OWNER_EMAIL, "First Synthetic Org");
    const secondOwner = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");
    const second = harness.platform.projects.createProject({
      personId: secondOwner.personId,
      organizationId: secondOwner.organizationId,
    });

    const firstReference = harness.platform.store.findProject(first.projectId)!.reference;
    const foundFirst = harness.platform.store.findProjectByReferenceGlobal(firstReference);
    assert.equal(foundFirst?.id, first.projectId);

    const foundSecond = harness.platform.store.findProjectByReferenceGlobal(
      second.project.reference,
    );
    assert.equal(foundSecond?.id, second.project.id);

    // The internal service resolves the same single project the customer
    // reference names, whichever organization owns it.
    assert.equal(
      harness.platform.internal.resolveProjectId(
        first.personId,
        second.project.reference,
      ),
      second.project.id,
    );
    harness.platform.close();
  });
});

describe("legacy databases with duplicate references", () => {
  it("fails to open with a clear message instead of changing any reference", () => {
    const directory = mkdtempSync(join(tmpdir(), "customer-platform-ref-"));
    const path = join(directory, "legacy.sqlite");

    try {
      // Build a database with the current schema, then roll it back to the
      // pre-migration state and plant a cross-organization duplicate.
      const seed = new SqlitePlatformStore(path);
      seed.close();

      const legacy = new DatabaseSync(path);
      legacy.exec("DROP INDEX IF EXISTS projects_reference_unique;");
      legacy.exec(
        `INSERT INTO people (id, email, email_hash, display_name, created_at, updated_at)
         VALUES ('person-1', 'one@synthetic.example', 'hash-1', NULL, 1, 1),
                ('person-2', 'two@synthetic.example', 'hash-2', NULL, 1, 1);`,
      );
      legacy.exec(
        `INSERT INTO organizations (id, name, created_at)
         VALUES ('org-1', 'First Synthetic Org', 1),
                ('org-2', 'Second Synthetic Org', 1);`,
      );
      legacy.exec(
        `INSERT INTO projects
           (id, organization_id, reference, title, created_by_person_id, created_at, updated_at)
         VALUES ('project-1', 'org-1', 'PRJ-DUP001', 'One', 'person-1', 1, 1),
                ('project-2', 'org-2', 'PRJ-DUP001', 'Two', 'person-2', 1, 1);`,
      );
      legacy.close();

      assert.throws(
        () => new SqlitePlatformStore(path),
        (error: unknown) =>
          error instanceof Error &&
          /globally unique project references/i.test(error.message) &&
          /No project reference was changed/i.test(error.message),
      );

      // Nothing was rewritten: both rows survive with the reference they had.
      const after = new DatabaseSync(path);
      const rows = after
        .prepare("SELECT id, reference FROM projects WHERE reference = ?")
        .all("PRJ-DUP001");
      after.close();
      assert.equal(rows.length, 2);
      assert.deepEqual(
        rows.map((row) => (row as { id: string }).id).sort(),
        ["project-1", "project-2"],
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("customer access rules are unchanged", () => {
  it("still resolves a reference inside the customer's own organization", async () => {
    const harness = await createTestPlatform();
    const owner = await signUpAsOwnerWithProject(harness, OWNER_EMAIL);
    const reference = harness.platform.store.findProject(owner.projectId)!.reference;

    assert.equal(
      harness.platform.projects.resolveProjectIdByReference(owner.personId, reference),
      owner.projectId,
    );
    harness.platform.close();
  });

  it("still refuses another organization's reference", async () => {
    const harness = await createTestPlatform();
    const first = await signUpAsOwnerWithProject(harness, OWNER_EMAIL, "First Synthetic Org");
    const secondOwner = await signUpAsOwner(harness, OTHER_EMAIL, "Second Synthetic Org");
    const second = harness.platform.projects.createProject({
      personId: secondOwner.personId,
      organizationId: secondOwner.organizationId,
    });

    assert.throws(
      () =>
        harness.platform.projects.resolveProjectIdByReference(
          first.personId,
          second.project.reference,
        ),
      (error: unknown) => isPlatformError(error) && error.code === "not_found",
    );
    harness.platform.close();
  });

  it("still enforces ordinary member project restrictions", async () => {
    const harness = await createTestPlatform();
    const owner = await signUpAsOwnerWithProject(harness, OWNER_EMAIL);
    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    const reference = harness.platform.store.findProject(owner.projectId)!.reference;

    assert.throws(
      () => harness.platform.projects.resolveProjectIdByReference(member.personId, reference),
      (error: unknown) => isPlatformError(error) && error.code === "forbidden",
    );
    assert.deepEqual(harness.platform.projects.listAccessibleProjects(member.personId), []);

    harness.platform.projects.grantProjectAccess({
      personId: owner.personId,
      organizationId: owner.organizationId,
      projectId: owner.projectId,
      memberPersonId: member.personId,
    });
    assert.equal(
      harness.platform.projects.resolveProjectIdByReference(member.personId, reference),
      owner.projectId,
    );
    harness.platform.close();
  });
});
