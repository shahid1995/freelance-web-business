# Project Milestones

**Status:** Phase 3 working delivery process  
**Owner:** Founder  
**Last updated:** 2026-09-27

## 1. Purpose

Milestones turn the approved project scope into a sequenced delivery plan.

A milestone should group related work into an observable stage with a clear purpose, defined dependencies, expected inputs, completion conditions, and a known handoff to the next stage.

Milestones organize delivery. They do not redefine the approved scope.

## 2. Entry conditions

Create the milestone plan only when:

- the project scope is Approved;
- major deliverables and acceptance criteria are known;
- material dependencies and client responsibilities are visible;
- known open items have owners and status;
- the delivery owner can identify a practical sequence for the work.

Do not create artificial milestones simply to make a plan look detailed.

## 3. Milestone authority and scope boundary

The Approved project scope is the delivery baseline.

Use these sources in order:

1. Founder-approved business and delivery rules
2. Approved project scope
3. Approved discovery decisions and clarifications
4. Client-approved changes to scope
5. Implementation detail

A milestone cannot add, remove, or materially redefine a scope item on its own.

When planning reveals that an item cannot be delivered within the approved scope or dependencies, record the issue and use the agreed change-control process rather than silently rewriting the milestone or scope.

## 4. Milestone objectives

A useful milestone plan should establish:

1. milestone sequence;
2. milestone purpose;
3. scope items covered;
4. required inputs;
5. dependencies;
6. owner;
7. planned start or readiness condition;
8. target completion point when approved;
9. completion criteria;
10. client review or approval point when applicable;
11. blockers and risks;
12. handoff to the next milestone or QA.

Milestone detail should be proportionate to project size.

## 5. Milestone structure

### 5.1 Milestone identity

Each milestone should have:

- Milestone ID
- Name
- Purpose
- Status
- Owner
- Scope references
- Planned sequence

Use stable IDs such as M-001, M-002, and so on.

### 5.2 Scope coverage

Every milestone should identify which approved scope items it advances.

Examples:

- page or screen group;
- feature group;
- workflow;
- integration;
- migration stage;
- configuration;
- handover preparation.

Do not use milestone labels that imply work outside the approved scope.

### 5.3 Dependencies and inputs

Record what must be available before the milestone can start or finish:

- client content;
- approvals;
- account access;
- integration availability;
- source data;
- completed predecessor milestone;
- required environment;
- design or implementation decisions.

Identify the owner for material external dependencies where practical.

### 5.4 Readiness condition

A milestone should have an explicit start condition.

Examples:

- approved scope and required assets received;
- previous milestone completed;
- client approval recorded;
- external integration available;
- migration source confirmed.

Do not mark a milestone In progress while a material prerequisite is still unknown unless the milestone explicitly allows parallel preparation.

### 5.5 Completion criteria

Completion criteria should be observable.

Examples:

- specified scope items implemented;
- required review material prepared;
- milestone acceptance conditions met;
- required client input received;
- known milestone defects recorded or addressed according to the agreed quality process;
- handoff package prepared for the next stage.

Milestone completion is not the same as final project acceptance unless the milestone is explicitly the final delivery stage.

## 6. Suggested milestone patterns

Use the pattern that fits the actual project rather than forcing every project into the same sequence.

### Business website / landing page

Possible sequence:

1. Project setup and inputs
2. Structure and primary page implementation
3. Remaining agreed pages/content integration
4. Responsive and integration completion
5. Review and acceptance preparation
6. Handover preparation

### Website redesign / modernization

Possible sequence:

1. Existing-site inventory and confirmed priorities
2. Updated structure and primary redesign work
3. Remaining agreed page/flow modernization
4. Content or migration completion
5. Review and acceptance preparation
6. Handover preparation

### Custom web application

Possible sequence:

1. Project setup, environments, and confirmed requirements
2. Core workflow foundation
3. Primary application functionality
4. Secondary workflows and integrations
5. Review, stabilization, and acceptance preparation
6. Handover preparation

### Dashboard / portal

Possible sequence:

1. Data and access setup
2. Core views and navigation
3. Permissions and workflows
4. Integrations and remaining agreed functionality
5. Review and acceptance preparation
6. Handover preparation

### Maintenance / improvements

Possible sequence:

1. Reproduce and confirm requested issues
2. Implement grouped fixes
3. Verify affected areas
4. Client review where applicable
5. Handover / closure

These are reusable patterns, not commitments to a fixed number of milestones.

## 7. Milestone sequencing

Sequence milestones using actual dependencies.

Prefer:

- prerequisite work before dependent work;
- client-input work only after required inputs are available;
- integration work after required accounts and interfaces are confirmed;
- review stages after the relevant implementation is complete;
- QA planning early enough to influence implementation, not only at the end.

Parallel work is acceptable when dependencies are independent and ownership is clear.

## 8. Client dependencies and waiting states

A milestone may become blocked when a required external input or decision is unavailable.

Use clear statuses:

- Planned — defined but not ready to start
- Ready — prerequisites are satisfied
- In progress — active work is underway
- Blocked — progress is prevented by a recorded dependency or decision
- Review — awaiting defined review or acceptance
- Completed — completion criteria are satisfied
- Deferred — intentionally postponed with an approved reason
- Superseded — replaced by an approved scope or milestone change

When a milestone is Blocked, record:

- blocker;
- owner;
- date identified;
- expected next action;
- impact on downstream milestones.

Do not hide waiting time inside an apparently active milestone.

## 9. Timeline discipline

Use timeline information only when it is supported by the approved scope, dependencies, and actual delivery capacity.

A milestone may use:

- readiness condition;
- target date;
- target date range;
- sequencing relative to another milestone.

Do not invent delivery dates to make a proposal or project plan look more certain.

When a dependency changes the planned timeline, update the milestone record and identify the cause.

## 10. Milestone change control

Treat a requested milestone change as a scope issue when it:

- adds work not covered by the Approved scope;
- removes an approved deliverable;
- materially changes acceptance criteria;
- changes client or delivery responsibilities;
- creates a new integration or infrastructure responsibility.

Before implementing such a change:

1. Record the requested change.
2. Identify affected milestones and scope items.
3. Record schedule, dependency, or acceptance impact.
4. Obtain the required client agreement and any internal approval.
5. Update the approved scope when the scope itself changes.
6. Update affected milestones and preserve the prior record.

A milestone plan may be re-sequenced without changing scope when the actual deliverables and acceptance conditions remain unchanged.

## 11. Milestone reviews

At each milestone review, confirm:

- planned scope items are still correct;
- dependencies are satisfied or explicitly blocked;
- client inputs and decisions are recorded;
- completion criteria are met;
- defects or known limitations are visible;
- next milestone prerequisites are ready;
- any requested changes are routed through change control.

Use a milestone review to expose delivery state, not to create new scope.

## 12. Milestone record template

Use this structure in the approved client project location:

### Milestone record

Project ID:  
Milestone ID: M-001  
Name:  
Purpose:  
Status: Planned / Ready / In progress / Blocked / Review / Completed / Deferred / Superseded  
Owner:  
Sequence:  
Scope references:  
Planned start / readiness condition:  
Target completion, when approved:  

#### 1. Scope covered

#### 2. Inputs required

| Input | Owner | Required by | Status |
|---|---|---|---|
| [Input] | [Owner] | [Date] | Open |

#### 3. Dependencies

| Dependency | Owner | Status | Impact |
|---|---|---|---|
| [Dependency] | [Owner] | Open | [Impact] |

#### 4. Work included

#### 5. Completion criteria

- [ ] [Criterion]
- [ ] [Criterion]

#### 6. Client review / approval

Review required: Yes / No  
Approver:  
Approval evidence / reference:  
Review date:  

#### 7. Blockers / risks

#### 8. Next handoff

Next milestone / QA / handover:  
Handoff conditions:  

#### 9. Activity log

| Date | Event | Summary | Next action |
|---|---|---|---|
| YYYY-MM-DD | Created | Initial milestone plan | Prepare prerequisites |

## 13. Milestone checklist

Before marking a milestone Ready:

- [ ] Approved project scope is the baseline.
- [ ] Scope references are identified.
- [ ] Purpose and completion criteria are clear.
- [ ] Required inputs are identified.
- [ ] Material dependencies have owners where practical.
- [ ] Readiness condition is satisfied.
- [ ] Sequence is consistent with actual dependencies.
- [ ] Timeline information is supported by known conditions.
- [ ] Client review/approval needs are explicit.
- [ ] No unapproved scope has been added.

Before marking a milestone Completed:

- [ ] Completion criteria are satisfied.
- [ ] Required review has occurred where applicable.
- [ ] Blockers are cleared or formally carried forward.
- [ ] Known limitations or defects are recorded.
- [ ] Next handoff conditions are ready.
- [ ] Any requested scope changes were handled through change control.

## 14. Handoff to QA

When implementation milestones reach the agreed review point:

1. Identify the scope items and acceptance criteria being verified.
2. Provide the relevant implementation/environment information.
3. Carry known limitations and open items into QA.
4. Confirm required client inputs are complete or explicitly noted.
5. Establish which milestone or project-level acceptance conditions remain outstanding.

Milestone completion should make QA more structured, not replace QA.

## 15. Handoff to project closure

For the final milestone:

- confirm all approved scope items are accounted for;
- confirm outstanding items are documented;
- prepare the agreed handover inputs;
- carry final acceptance criteria into handover and closure;
- route any remaining change request through change control.

The milestone plan remains the execution sequence for the approved scope. It is not a substitute for project QA, handover, or closure.
