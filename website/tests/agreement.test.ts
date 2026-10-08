import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPlatformError } from "../lib/platform/errors";
import { generateActionKey } from "../lib/platform/secrets";
import {
  createProposalHarness,
  ownerWithProject,
  publishFirstVersion,
  publishNextVersion,
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

describe("agreement authoring", () => {
  it("requires an accepted proposal and creates immutable version 1", async () => {
    const harness = await createProposalHarness();
    const owner = await ownerWithProject(harness);
    publishFirstVersion(harness, owner);

    expectFailure(
      () =>
        harness.platform.agreements.createAgreement({
          personId: owner.personId,
          projectId: owner.projectId,
          additionalTerms: agreementContent,
        }),
      "invalid_input",
    );

    acceptCurrentProposal(harness, owner);
    const view = harness.platform.agreements.createAgreement({
      personId: owner.personId,
      projectId: owner.projectId,
      additionalTerms: agreementContent,
    });

    assert.equal(view.versions.length, 1);
    assert.equal(view.versions[0]?.versionNumber, 1);
    assert.equal(view.versions[0]?.status, "draft");
    assert.equal(view.versions[0]?.proposalVersionNumber, 1);
    assert.equal(view.versions[0]?.additionalTerms, agreementContent);

    const events = harness.platform.store.listAuditEventsForProject(owner.projectId, 50);
    assert.deepEqual(
      events.filter((event) => event.type.startsWith("agreement")).map((event) => event.type),
      ["agreement_version.created", "agreement.created"],
    );
    harness.platform.close();
  });

  it("keeps one agreement identity per project and appends numbered versions", async () => {
    const harness = await createProposalHarness();
    const owner = await publishedOwner(harness);
    acceptCurrentProposal(harness, owner);

    harness.platform.agreements.createAgreement({
      personId: owner.personId,
      projectId: owner.projectId,
      additionalTerms: "v1 terms",
    });

    expectFailure(
      () =>
        harness.platform.agreements.createAgreement({
          personId: owner.personId,
          projectId: owner.projectId,
          additionalTerms: "duplicate",
        }),
      "invalid_input",
    );

    harness.platform.agreements.createVersion({
      personId: owner.personId,
      projectId: owner.projectId,
      additionalTerms: "v2 terms",
    });
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
    harness.platform.agreements.createAgreement({
      personId: owner.personId,
      projectId: owner.projectId,
      additionalTerms: "v1 terms",
    });

    publishNextVersion(harness, owner, 2);
    acceptCurrentProposal(harness, owner);

    expectFailure(
      () =>
        harness.platform.agreements.publishVersion({
          personId: owner.personId,
          projectId: owner.projectId,
          versionNumber: 1,
        }),
      "invalid_input",
    );
    harness.platform.close();
  });
});

describe("customer agreement signing", () => {
  it("allows only organization owners/admins to sign and completes Q1-A atomically", async () => {
    const harness = await createProposalHarness();
    const owner = await publishedOwner(harness);
    acceptCurrentProposal(harness, owner);
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

    const member = await addOrdinaryMember(harness, owner.organizationId, MEMBER_EMAIL);
    harness.platform.projects.grantProjectAccess({
      personId: owner.personId,
      organizationId: owner.organizationId,
      projectId: owner.projectId,
      memberPersonId: member.personId,
    });

    expectFailure(
      () =>
        harness.platform.customerAgreements.sign({
          personId: member.personId,
          projectId: owner.projectId,
          versionNumber: 1,
          actionKey: generateActionKey(),
        }),
      "forbidden",
    );

    const signed = harness.platform.customerAgreements.sign({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
      actionKey: "agreement-sign-1",
    });
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
    const owner = await publishedOwner(harness);
    acceptCurrentProposal(harness, owner);
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

    const first = harness.platform.customerAgreements.sign({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
      actionKey: "same-key",
    });
    const replay = harness.platform.customerAgreements.sign({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
      actionKey: "same-key",
    });

    assert.deepEqual(replay, first);
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

  it("rejects a stale published agreement after a newer proposal version is accepted", async () => {
    const harness = await createProposalHarness();
    const owner = await publishedOwner(harness);
    acceptCurrentProposal(harness, owner);
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

    publishNextVersion(harness, owner, 2);
    acceptCurrentProposal(harness, owner);

    expectFailure(
      () =>
        harness.platform.customerAgreements.sign({
          personId: owner.personId,
          projectId: owner.projectId,
          versionNumber: 1,
          actionKey: generateActionKey(),
        }),
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
    harness.platform.customerAgreements.sign({
      personId: owner.personId,
      projectId: owner.projectId,
      versionNumber: 1,
      actionKey: generateActionKey(),
    });
    const after = harness.platform.projects.getCustomerProject(owner.personId, owner.projectId);

    assert.equal(after.project.stage, before.project.stage);
    harness.platform.close();
  });
});
