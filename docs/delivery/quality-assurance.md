# Quality Assurance and Verification

**Status:** Phase 3 working delivery process  
**Owner:** Founder  
**Last updated:** 2026-09-27

## 1. Purpose

QA verifies that the implemented project satisfies the Approved scope, milestone completion conditions, and agreed acceptance criteria.

QA is evidence-based. A build succeeding, code existing, or a developer reporting that a feature works is not by itself sufficient verification.

QA should identify defects, incomplete requirements, unsupported assumptions, and known limitations before handover and final client acceptance.

## 2. QA authority and boundaries

The Approved project scope remains the delivery baseline.

QA may identify that an implementation does not satisfy the approved requirement. QA must not create new requirements merely because a different behavior would be preferable.

When QA reveals a requested behavior that is outside the Approved scope:

1. Record the finding.
2. Distinguish the defect from a new request.
3. Route a new request through change control.
4. Do not silently treat the new behavior as a defect against the original scope.

Security, privacy, accessibility, performance, and integration checks should be applied when they are relevant to the project, contractual requirements, or material risk.

## 3. QA entry conditions

Begin project QA when:

- the relevant implementation milestone is ready for review;
- the Approved scope and acceptance criteria are available;
- the test environment or review environment is accessible;
- required test data and client inputs are available;
- known limitations or blockers are already recorded;
- the QA owner understands which scope and milestone items are being verified.

QA can occur incrementally during milestones. Final project QA should not be the first time critical workflows are tested.

## 4. QA planning

Create a QA plan from the actual project, not from a generic checklist.

Identify:

- scope items to verify;
- milestone completion criteria;
- primary user flows;
- acceptance criteria;
- supported browsers and devices when specified;
- integrations;
- data and permissions;
- accessibility expectations;
- performance expectations;
- security and privacy risks;
- content requirements;
- deployment or handover checks;
- required client review points.

Each important requirement should have a corresponding verification method.

## 5. Verification methods

Use the simplest reliable method that provides evidence.

### Functional verification

Verify that:

- required pages, screens, and features exist;
- primary workflows complete correctly;
- validation and error handling behave as specified;
- permissions and roles behave as scoped;
- integrations produce the agreed behavior;
- data is created, read, updated, or removed as intended where applicable.

### Responsive and browser verification

When relevant to the project, check:

- agreed desktop and mobile layouts;
- supported browsers;
- primary screen sizes;
- navigation and interactive controls;
- text wrapping and content visibility;
- fixed/sticky elements;
- forms and input behavior;
- touch interactions.

Do not claim support for browsers, devices, or environments that were not actually checked.

### Accessibility verification

When relevant, verify at minimum the agreed or material areas such as:

- keyboard navigation;
- visible focus;
- semantic structure;
- labels and accessible names for controls;
- heading structure;
- sufficient text/readability behavior;
- meaningful alternative text where required;
- error identification and recovery;
- reduced-motion behavior where relevant.

Accessibility checks should be proportionate to the project and should distinguish automated findings from manual verification.

### Performance verification

When performance is in scope or materially relevant, check appropriate measures such as:

- page or route load behavior;
- major asset sizes;
- image handling;
- unnecessary blocking work;
- client-side errors;
- important interaction responsiveness;
- agreed performance targets.

Do not state performance guarantees unless they are explicitly approved and measured.

### Security and privacy verification

When relevant, verify:

- authentication and authorization boundaries;
- exposure of sensitive information;
- insecure configuration visible in the delivered environment;
- input handling and obvious validation failures;
- access-control behavior;
- secrets are not present in source or public output;
- test data does not expose real client information;
- client credentials are not copied into the public business repository.

High-risk findings should block the affected delivery until resolved or explicitly accepted through the appropriate authority.

### Integration verification

For each material integration:

- confirm the expected connection path;
- verify required authentication or authorization behavior;
- verify success and relevant failure states;
- verify data mapping;
- verify dependency assumptions;
- record limitations imposed by the external service.

Third-party service failures should be distinguished from defects in the delivered project when evidence supports that distinction.

### Content and configuration verification

When relevant, verify:

- agreed content is present;
- required legal/compliance text is included from client-provided or approved sources;
- links and navigation work;
- forms point to the intended destination;
- metadata or configuration included in scope is present;
- environment-specific configuration is appropriate.

Do not rewrite client-provided legal or regulated content as part of QA unless that work is explicitly in scope.

### Regression verification

After material fixes, re-check:

- the original failing behavior;
- related primary workflows;
- adjacent functionality that could reasonably have been affected.

Regression depth should reflect the risk and size of the change.

## 6. Test evidence

Every material QA pass should record enough evidence to explain what was checked.

Useful evidence includes:

- test case or checklist ID;
- date;
- environment;
- browser/device when relevant;
- preconditions;
- steps or verification method;
- expected result;
- observed result;
- pass/fail status;
- defect reference when applicable;
- tester/owner;
- evidence link or artifact reference where appropriate.

Evidence should be stored in the client project repository or another approved project location, not in the public business repository when it contains client-specific information.

## 7. Defect classification

Use factual categories rather than subjective severity labels.

### Blocker

A material failure prevents a required primary workflow, creates a critical security/privacy issue, or makes the agreed deliverable unusable for its intended purpose.

### Major

A significant in-scope feature or workflow does not satisfy the agreed requirement and requires correction before normal acceptance.

### Minor

A limited defect does not prevent the main agreed workflow and can reasonably be addressed without changing the scope.

### Observation

A non-defect note, usability suggestion, implementation detail, or future consideration that does not represent failure against the approved requirement.

A classification may be revised when better evidence becomes available.

## 8. Defect record

For each defect, record:

- defect ID;
- date reported;
- related scope/milestone item;
- environment;
- expected behavior;
- observed behavior;
- reproduction steps;
- impact;
- classification;
- owner;
- status;
- fix reference;
- verification result.

Keep descriptions factual. Avoid turning preferences into defects unless they conflict with an approved requirement.

## 9. Defect lifecycle

Use clear statuses:

- New
- Confirmed
- In progress
- Fixed
- Ready for verification
- Verified
- Deferred
- Rejected
- Closed

A rejected or deferred defect should include the factual reason.

A defect should not be marked Verified merely because a fix was committed. The affected behavior must be re-tested.

## 10. QA gates

Use these gates proportionate to the project.

### Gate 1 — Test readiness

- relevant scope is known;
- milestone is ready;
- environment is available;
- required inputs and test data are available;
- known blockers are recorded.

### Gate 2 — Functional verification

- required scope items are tested;
- primary workflows pass or have recorded defects;
- important integration behavior is checked;
- permission/access behavior is checked when applicable.

### Gate 3 — Cross-environment verification

- supported browsers/devices are checked where required;
- responsive behavior is checked;
- important environment-specific behavior is verified.

### Gate 4 — Quality and risk verification

- relevant accessibility checks are completed;
- relevant performance checks are completed;
- relevant security/privacy checks are completed;
- high-risk findings are resolved or explicitly handled.

### Gate 5 — Acceptance readiness

- agreed acceptance criteria are satisfied;
- known defects are documented;
- unresolved items have owners and disposition;
- evidence is stored in the approved project location;
- handover prerequisites are known.

Passing a gate means the defined checks were completed; it does not mean business outcomes are guaranteed.

## 11. QA exceptions and accepted limitations

Sometimes a project contains an explicitly accepted limitation.

Record:

- limitation;
- affected scope or workflow;
- reason;
- known impact;
- who accepted it;
- acceptance date;
- whether follow-up is required.

An accepted limitation must not be silently treated as a defect-free implementation.

Do not use an exception record to approve a material scope change that has not gone through change control.

## 12. Client acceptance and QA

QA evidence and client acceptance are related but distinct.

The delivery owner verifies the implementation against the approved scope and QA plan.

The client confirms acceptance of the agreed deliverable through the approved project communication or agreement channel.

Client acceptance should reference the scope version or milestone being accepted.

Client feedback that requests new work after acceptance should be assessed as a change request rather than automatically treated as a defect.

## 13. Final QA record template

Use this structure in the approved client project location:

### QA record

Project ID:  
QA cycle: QA-001  
Scope version:  
Milestone(s):  
QA owner:  
Environment:  
Date:

#### 1. Verification coverage

| Check ID | Area | Scope / acceptance reference | Result | Evidence |
|---|---|---|---|---|
| Q-001 | Primary workflow | [Reference] | Pass / Fail | [Reference] |

#### 2. Browser / device checks

| Environment | Coverage | Result | Notes |
|---|---|---|---|
| [Browser/device] | [Area] | Pass / Fail | [Notes] |

#### 3. Accessibility checks

#### 4. Performance checks

#### 5. Security / privacy checks

#### 6. Integration checks

#### 7. Content / configuration checks

#### 8. Defects

| Defect ID | Classification | Status | Scope / milestone | Verification |
|---|---|---|---|---|
| DEF-001 | Major | Verified | [Reference] | [Evidence] |

#### 9. Accepted limitations

| Limitation | Impact | Accepted by | Date | Follow-up |
|---|---|---|---|---|
| [Limitation] | [Impact] | [Authority] | [Date] | [Action] |

#### 10. QA conclusion

- Ready for client acceptance
- Not ready for client acceptance
- Ready with explicitly accepted limitations

Conclusion basis:

#### 11. Sign-off

QA owner:  
Date:  
Client acceptance reference, when applicable:

## 14. QA checklist

Before declaring a project Ready for client acceptance:

- [ ] Approved scope version is identified.
- [ ] Relevant milestone completion conditions are satisfied.
- [ ] Primary user flows are tested.
- [ ] Required functional behavior is verified.
- [ ] Relevant browser/device behavior is verified.
- [ ] Relevant accessibility checks are completed.
- [ ] Relevant performance checks are completed.
- [ ] Relevant security/privacy checks are completed.
- [ ] Material integrations are tested.
- [ ] Required content/configuration is checked.
- [ ] Regression checks are completed after material fixes.
- [ ] Defects have clear status and disposition.
- [ ] Accepted limitations have explicit authority and evidence.
- [ ] QA evidence is stored in the approved project location.
- [ ] Any new requested work is separated from defect findings and routed through change control.
- [ ] Client acceptance can be requested against a clearly identified scope or milestone baseline.

## 15. Handoff to handover

When QA is complete:

1. Confirm the approved scope and acceptance conditions are satisfied or explicitly dispositioned.
2. Record outstanding defects or accepted limitations.
3. Prepare the handover inputs defined by the scope and proposal.
4. Carry known operational notes and dependencies into handover.
5. Preserve QA evidence in the client project location.
6. Request or record client acceptance through the approved channel.

QA establishes verification evidence. Handover establishes what the client receives and how the completed project is transferred.
