import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPlatformError } from "../lib/platform/errors";
import { noticeFor } from "../lib/platform/notices";
import { generateActionKey } from "../lib/platform/secrets";
import { MEMBER_EMAIL, addOrdinaryMember, type TestPlatform } from "./support/harness";
import {
  createProposalHarness,
  grantAccess,
  ownerWithProject,
  publishFirstVersion,
  publishNextVersion,
  publishedOwner,
  type Owner,
} from "./support/proposals";

const agreementContent = "Additional terms for this synthetic agreement.";

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

function expectFailure(action: () => unknown, code: string): void {
  assert.throws(
    action,
    (error: unknown) => isPlatformError(error) && error.code === code,
  );
}

function createAgreement(harness: TestPlatform, owner: Owner, additionalTerms: string) {
  return harness.platform.agreements.createAgreement({
    personId: owner.personId,
    projectId: owner.projectId,
    additionalTerms,
  });
}

function createAgreementVersion(harness: TestPlatform, owner: Owner, additionalTerms: string): void {
  harness.platform.agreements.createVersion({
    personId: owner.personId,
    projectId: owner.projectId,
    additionalTerms,
  });
}

function publishAgreementVersion(harness: TestPlatform, owner: Owner, versionNumber: number): void {
  harness.platform.agreements.publishVersion({
    personId: owner.personId,
    projectId: owner.projectId,
    versionNumber,
  });
}

/** Signs an agreement version as the owner, or as `signerPersonId` when given. */
function signAgreement(
  harness: TestPlatform,
  owner: Owner,
  versionNumber: number,
  actionKey: string,
  signerPersonId = owner.personId,
) {
  return harness.platform.customerAgreements.sign({
    personId: signerPersonId,
    projectId: owner.projectId,
    versionNumber,
    actionKey,
  });
}

/** An owner whose accepted proposal has a published, signable agreement version 1. */
async function ownerWithPublishedAgreement(
  harness: TestPlatform,
  additionalTerms: string = agreementContent,
): Promise<Owner> {
  const owner = await publishedOwner(harness);
  acceptCurrentProposal(harness, owner);
  createAgreement(harness, owner, additionalTerms);
  publishAgreementVersion(harness, owner, 1);
  return owner;
}

describe("agreement authoring", () => {
  it("requires an accepted proposal and creates immutable version 1", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithProject(harness);
    publishFirstVersion(harness, owner);

    expectFailure(
      () => createAgreement(harness, owner, agreementContent),
      "invalid_input",
    );

    acceptCurrentProposal(harness, owner);
    const view = createAgreement(harness, owner, agreementContent);

    assert.equal(view.versions.length, 1);
    assert.equal(view.versions[0]?.versionNumber, 1);
    assert.equal(view.versions[0]?.status, "draft");
    assert.equal(view.versions[0]?.proposalVersionNumber, 1);
    assert.equal(view.versions[0]?.additionalTerms, agreementContent);

    const events = harness.platform.store.listAuditEventsForProject(owner.projectId, 50);
    assert.deepEqual(
      events
        .filter((event) => event.type.startsWith("agreement"))
        .map((event) => event.type)
        .sort(),
      ["agreement.created", "agreement_version.created"].sort(),
    );
    harness.platform.close();
  });

  it("keeps one agreement identity per project and appends numbered versions", async () => {
    const harness = await createProposalHarness();
    const owner = await publishedOwner(harness);
    acceptCurrentProposal(harness, owner);

    createAgreement(harness, owner, "v1 terms");

    expectFailure(
      () => createAgreement(harness, owner, "duplicate"),
      "invalid_input",
    );

    createAgreementVersion(harness, owner, "v2 terms");
    const view = harness.platform.agreements.read(owner.personId, owner.projectId);
    assert.deepEqual(
      view.versions.map((version) => version.versionNumber),
      [1, 2],
    );
    assert.equal(view.versions[0]?.additionalTerms, "v1 terms");
    assert.equal(view.versions[1]?.additionalTerms, "v2 terms");
    harness.platform.close();
  });

  it("refuses publishing a draft whose accepted proposal baseline has gone stale", async () => {
    const harness = await createProposalHarness();
    const owner = await publishedOwner(harness);
    acceptCurrentProposal(harness, owner);
    createAgreement(harness, owner, "v1 terms");

    publishNextVersion(harness, owner, 2);
    acceptCurrentProposal(harness, owner);

    expectFailure(
      () => publishAgreementVersion(harness, owner, 1),
      "invalid_input",
    );
    harness.platform.close();
  });
});

describe("customer agreement signing", () => {
  it("allows only organization owners/admins to sign and completes Q1-A atomically", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithPublishedAgreement(harness);

    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    grantAccess(harness, owner, member.personId);

    expectFailure(
      () => signAgreement(harness, owner, 1, generateActionKey(), member.personId),
      "forbidden",
    );

    const signed = signAgreement(harness, owner, 1, "agreement-sign-1");
    assert.equal(signed.versionNumber, 1);

    const agreement = harness.platform.store.findAgreementByProject(owner.projectId);
    assert.ok(agreement);
    const [version] = harness.platform.store.listAgreementVersions(agreement.id);
    assert.ok(version);
    assert.equal(version.status, "signed");

    const signatures = harness.platform.store.listAgreementSignaturesByVersion(version.id);
    assert.equal(signatures.length, 1);
    assert.equal(signatures[0]?.authorityRole, "owner");

    const events = harness.platform.store
      .listAuditEventsForProject(owner.projectId, 50)
      .filter((event) => event.type === "agreement.signed");
    assert.equal(events.length, 1);

    const standing = harness.platform.customerAgreements.readByProjectId(
      owner.personId,
      owner.projectId,
    );
    assert.equal(standing.state, "completed");
    assert.equal(standing.proposal, null);
    assert.equal(standing.additionalTerms, null);

    harness.platform.close();
  });

  it("resolves an idempotent replay before terminal-state rejection", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithPublishedAgreement(harness);

    const first = signAgreement(harness, owner, 1, "same-key");
    const replay = signAgreement(harness, owner, 1, "same-key");

    assert.deepEqual(replay, first);
    expectFailure(
      () => signAgreement(harness, owner, 1, "same-key-new-operation"),
      "agreement_completed",
    );
    const agreement = harness.platform.store.findAgreementByProject(owner.projectId);
    assert.ok(agreement);
    const version = harness.platform.store.listAgreementVersions(agreement.id)[0]!;
    assert.equal(harness.platform.store.listAgreementSignaturesByVersion(version.id).length, 1);
    assert.equal(
      harness.platform.store.listAuditEventsForProject(owner.projectId, 50).filter(
        (event) => event.type === "agreement.signed",
      ).length,
      1,
    );
    harness.platform.close();
  });

  it("rejects idempotency-key reuse for a different agreement version", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithPublishedAgreement(harness, "version one");

    const first = signAgreement(harness, owner, 1, "reused-key");
    assert.equal(first.versionNumber, 1);

    createAgreementVersion(harness, owner, "version two");
    publishAgreementVersion(harness, owner, 2);

    expectFailure(
      () => signAgreement(harness, owner, 2, "reused-key"),
      "invalid_input",
    );

    const agreement = harness.platform.store.findAgreementByProject(owner.projectId);
    assert.ok(agreement);
    assert.equal(
      harness.platform.store.listAgreementSignaturesByVersion(
        harness.platform.store.listAgreementVersions(agreement.id)[1]!.id,
      ).length,
      0,
    );
    harness.platform.close();
  });

  it("does not expose an older published version after a newer agreement version is signed", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithPublishedAgreement(harness, "version one");

    createAgreementVersion(harness, owner, "version two");
    publishAgreementVersion(harness, owner, 2);
    signAgreement(harness, owner, 2, generateActionKey());

    const view = harness.platform.customerAgreements.readByProjectId(
      owner.personId,
      owner.projectId,
    );
    assert.equal(view.state, "completed");
    assert.equal(view.versionNumber, 2);

    expectFailure(
      () => signAgreement(harness, owner, 1, generateActionKey()),
      "agreement_completed",
    );
    harness.platform.close();
  });

  it("rejects a stale published agreement after a newer proposal version is accepted", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithPublishedAgreement(harness);

    publishNextVersion(harness, owner, 2);
    acceptCurrentProposal(harness, owner);

    expectFailure(
      () => signAgreement(harness, owner, 1, generateActionKey()),
      "agreement_updated",
    );

    const agreement = harness.platform.store.findAgreementByProject(owner.projectId);
    assert.ok(agreement);
    const version = harness.platform.store.listAgreementVersions(agreement.id)[0]!;
    assert.equal(version.status, "published");
    assert.equal(harness.platform.store.listAgreementSignaturesByVersion(version.id).length, 0);
    harness.platform.close();
  });

  it("does not change the customer project stage when an agreement is created or signed", async () => {
    const harness = await createProposalHarness();
    const owner = await publishedOwner(harness);
    acceptCurrentProposal(harness, owner);

    const before = harness.platform.projects.getCustomerProject(owner.personId, owner.projectId);
    createAgreement(harness, owner, agreementContent);
    publishAgreementVersion(harness, owner, 1);
    signAgreement(harness, owner, 1, generateActionKey());
    const after = harness.platform.projects.getCustomerProject(owner.personId, owner.projectId);

    assert.equal(after.project.stage, before.project.stage);
    harness.platform.close();
  });
});


describe("customer agreement projection boundary", () => {
  it("shows signing content before Q1-A signing but withholds signed content until Q10 is decided", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithPublishedAgreement(harness);

    const before = harness.platform.customerAgreements.readByProjectId(
      owner.personId,
      owner.projectId,
    );
    assert.equal(before.state, "awaiting_signature");
    assert.equal(before.canSign, true);
    assert.ok(before.proposal);
    assert.equal(before.additionalTerms, agreementContent);

    signAgreement(harness, owner, 1, generateActionKey());

    const after = harness.platform.customerAgreements.readByProjectId(
      owner.personId,
      owner.projectId,
    );
    assert.equal(after.state, "completed");
    assert.equal(after.canSign, false);
    assert.equal(after.proposal, null);
    assert.equal(after.additionalTerms, null);
    assert.ok(after.signedAt !== null);
    harness.platform.close();
  });
});


describe("customer agreement access boundary", () => {
  it("allows an assigned ordinary member to read the agreement but never to sign", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithPublishedAgreement(harness);

    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    grantAccess(harness, owner, member.personId);

    const visible = harness.platform.customerAgreements.readByProjectId(
      member.personId,
      owner.projectId,
    );
    assert.equal(visible.state, "awaiting_signature");
    assert.equal(visible.canSign, false);
    assert.ok(visible.proposal);

    expectFailure(
      () => signAgreement(harness, owner, 1, generateActionKey(), member.personId),
      "forbidden",
    );
    harness.platform.close();
  });
});


describe("completed-agreement notice", () => {
  it("renders a dedicated completed notice that does not ask the customer to retry", () => {
    const notice = noticeFor({ error: "agreement-completed" });
    assert.ok(notice);
    assert.equal(notice.message, "This agreement version has already been signed and completed, so it cannot be signed again. No further action is needed.");
    assert.ok(!notice.message.includes("try again"));
  });

  it("keeps the completed notice distinct from the stale-version updated notice", () => {
    const completed = noticeFor({ error: "agreement-completed" });
    const updated = noticeFor({ error: "agreement-updated" });
    assert.ok(completed);
    assert.ok(updated);
    assert.notEqual(completed.message, updated.message);
  });
});
