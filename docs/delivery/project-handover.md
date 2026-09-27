# Project Handover

**Status:** Phase 3 working delivery process  
**Owner:** Founder  
**Last updated:** 2026-09-27

## 1. Purpose

Handover transfers the completed, verified project from active delivery into the client's agreed operating state.

Handover should make clear:

- what was delivered;
- which scope version and acceptance baseline apply;
- what the client receives;
- how the client or authorized operator uses or maintains the delivered system;
- which access, deployment, hosting, domain, integration, or operational responsibilities transfer;
- what known limitations remain;
- where the project record and supporting evidence are stored;
- what support or follow-up remains, if any was agreed.

Handover is not an opportunity to introduce new functionality or silently extend support obligations.

## 2. Handover entry conditions

Begin handover preparation when:

- the relevant scope and milestone work is complete or explicitly dispositioned;
- QA has reached its applicable acceptance-readiness gate;
- known defects and accepted limitations are recorded;
- the final scope/version baseline is identified;
- required handover items from the proposal and scope are known;
- any required client inputs for transfer are available.

Do not represent the project as fully handed over while material delivery prerequisites remain unresolved.

## 3. Handover authority and boundaries

The approved scope and agreed commercial terms determine what is transferred.

Use these sources in order:

1. Founder-approved business and delivery rules
2. Approved project scope and accepted changes
3. QA conclusion and verified limitations
4. Proposal and agreed handover terms
5. Approved project decisions
6. Implementation details and operational notes

Handover does not authorize new scope.

A request for additional features, infrastructure, integrations, training, support, or operational responsibility must be assessed under the change-control process or a separate approved engagement.

## 4. Handover package

Build the handover package from the actual project.

### 4.1 Delivered work summary

Record:

- project identifier;
- final approved scope version;
- completed milestones;
- delivered pages, screens, features, workflows, or improvements;
- completed integrations;
- final QA status;
- accepted limitations or deferred items.

Do not describe uncompleted work as delivered.

### 4.2 Source and project materials

Transfer only what the proposal, scope, or agreement requires.

Possible items include:

- source repository access or source handover;
- design/source files when included;
- content or migration outputs when included;
- configuration documentation;
- environment/setup documentation;
- deployment instructions;
- usage notes;
- maintenance instructions;
- approved project records.

Client-specific materials belong in the client project repository or another approved client location.

### 4.3 Operational information

Where relevant, document:

- production URL;
- staging or test URL;
- hosting/provider information;
- domain/DNS responsibility;
- deployment process;
- environment separation;
- scheduled jobs or background processes;
- integrations and their owners;
- backup or recovery expectations when included;
- monitoring or analytics setup when included;
- known operational dependencies.

Record enough information for the agreed operator to understand responsibility boundaries.

### 4.4 Access and credentials

Never place passwords, API keys, private keys, session data, recovery codes, or other secrets in this public business repository.

Transfer access through the approved secure method for the client/project.

Record only non-secret metadata needed to understand:

- what account or system exists;
- who should own it;
- who is responsible for maintaining access;
- whether access transfer is complete;
- whether old project access should be removed.

## 5. Acceptance and handover relationship

Client acceptance and handover are related but distinct.

QA establishes evidence that the implementation meets the approved technical and project requirements.

Client acceptance confirms that the client accepts the agreed deliverable through the approved project communication or agreement channel.

Handover confirms that the agreed deliverable, supporting materials, access responsibilities, and operational information have been transferred.

Do not treat a completed code repository, QA pass, or delivery-owner statement as client acceptance by itself.

## 6. Handover checklist

Before marking handover Ready:

- [ ] Final approved scope version is identified.
- [ ] Completed milestones are accounted for.
- [ ] QA conclusion is recorded.
- [ ] Required defects are resolved or explicitly dispositioned.
- [ ] Accepted limitations are documented.
- [ ] Proposal/scope-defined handover items are identified.
- [ ] Source/repository transfer requirements are understood.
- [ ] Operational responsibilities are documented.
- [ ] Access ownership and transfer status are clear.
- [ ] Secrets are transferred only through approved secure channels.
- [ ] Client-specific records remain outside the public business repository.
- [ ] Any remaining change requests are separated from handover.
- [ ] Client acceptance is requested or recorded when required.
- [ ] Closure prerequisites are known.

## 7. Handover stages

### Stage 1 — Prepare

Assemble the agreed handover package and confirm outstanding items.

### Stage 2 — Validate

Check that:

- handover materials correspond to the final scope;
- instructions are usable;
- transferred assets are complete;
- access ownership is understood;
- known limitations are visible.

### Stage 3 — Transfer

Transfer the agreed assets, documentation, access, and operational responsibility through the approved channels.

Record what was transferred and when.

### Stage 4 — Client review

Allow the client or authorized operator to review the handover package.

Record factual questions, missing items, or requested corrections.

Separate genuine handover defects from new scope requests.

### Stage 5 — Acceptance

Record client acceptance using the approved communication or agreement channel when acceptance is required.

Acceptance should reference:

- project ID;
- scope version;
- milestone or final deliverable, when relevant;
- acceptance date;
- client approver;
- acceptance evidence/reference.

### Stage 6 — Transition to closure

Once the handover conditions are satisfied:

- resolve or disposition remaining handover items;
- confirm final operational ownership;
- identify any agreed support period;
- prepare the project closure record.

## 8. Handover states

Use clear states:

- Draft — package being prepared
- Ready for transfer — required items are assembled and internally checked
- Transferring — transfer is underway
- Client review — awaiting client review or questions
- Accepted — client acceptance is recorded
- Corrective action — a handover issue requires correction
- Complete — agreed handover conditions are satisfied
- Superseded — replaced by a later approved handover record

Do not use Complete when client acceptance or another required transfer condition is still outstanding.

## 9. Handover record template

Use this structure in the approved client project location:

### Handover record

Project ID:  
Handover ID: HAND-001  
Scope version:  
Handover status: Draft / Ready for transfer / Transferring / Client review / Accepted / Corrective action / Complete / Superseded  
Handover owner:  
Prepared date:  
Transfer date:  
Acceptance date:

#### 1. Delivered work summary

#### 2. Completed milestones

| Milestone | Status | Completion reference |
|---|---|---|
| M-001 | Completed | [Reference] |

#### 3. QA status

QA cycle:  
QA conclusion:  
Outstanding defects:  
Accepted limitations:

#### 4. Handover items

| Item ID | Item | Required by scope/proposal | Transfer method | Status |
|---|---|---|---|---|
| H-001 | [Item] | Yes / No | [Method] | Pending |

#### 5. Operational information

Production URL:  
Staging/test URL:  
Hosting responsibility:  
Domain/DNS responsibility:  
Deployment responsibility:  
Monitoring/analytics responsibility:  
Backup/recovery responsibility:  
Integration owners:

Do not place credentials or secrets in this record unless it is held in an approved secure client location specifically designed for them.

#### 6. Access transfer

| System / account | Intended owner | Transfer status | Secure transfer reference |
|---|---|---|---|
| [System] | [Owner] | Pending | [Reference] |

#### 7. Known limitations / remaining items

| Item | Status | Owner | Agreed next action |
|---|---|---|---|
| [Item] | Open / Accepted / Deferred | [Owner] | [Action] |

#### 8. Client review

Reviewed by:  
Review date:  
Questions / corrections:

#### 9. Client acceptance

Client approver name:  
Client approver role / authority:  
Acceptance reference:  
Acceptance date:  
Accepted scope version:

#### 10. Final transition

Operational owner after handover:  
Agreed support period, when applicable:  
Closure readiness: Ready / Not ready

## 10. Corrections after transfer

A correction should be assessed against the final scope and handover record.

### Handover defect

A transferred item does not match the Approved scope, agreed acceptance condition, or documented handover requirement.

Correct it within the applicable delivery responsibility and record the correction.

### New request

The client asks for functionality, content, integration, support, training, infrastructure, or responsibility that was not part of the agreed deliverable.

Route it through change control or a new approved engagement.

Do not relabel new work as a correction merely to avoid the scope process.

## 11. Access removal and security

After transfer, review whether delivery-side access should remain.

Where applicable:

- remove obsolete access;
- confirm client-owned accounts are controlled by the client;
- rotate temporary credentials through the approved secure process;
- remove temporary test accounts;
- remove unnecessary deployment or administrative access;
- confirm secrets are not left in source, documentation, screenshots, or public outputs.

The extent of access removal depends on the agreed operating model and any continuing support engagement.

## 12. Handover checklist for final completion

Before marking handover Complete:

- [ ] Final scope and acceptance baseline are identified.
- [ ] Required deliverables are transferred.
- [ ] Source/repository access is transferred when included.
- [ ] Operational documentation is transferred when included.
- [ ] Access ownership is confirmed.
- [ ] Secrets were handled only through approved secure channels.
- [ ] QA evidence is retained in the client project location.
- [ ] Known limitations are documented.
- [ ] Remaining items have clear disposition.
- [ ] Client acceptance is recorded when required.
- [ ] Any post-handover requests are classified as corrections or new scope.
- [ ] Unnecessary delivery access is removed or explicitly retained for an agreed support reason.
- [ ] Closure readiness is confirmed.

## 13. Handoff to project closure

When handover is Complete:

1. Confirm the final accepted scope version.
2. Confirm client acceptance evidence.
3. Confirm remaining items and support obligations.
4. Confirm access and operational ownership.
5. Archive or preserve required project records in the client project location.
6. Create the project closure record.
7. Capture reusable, sanitized lessons only when appropriate for the central business repository.

Handover completes the transfer. Project closure records the final state of the engagement and any approved follow-up obligations.
