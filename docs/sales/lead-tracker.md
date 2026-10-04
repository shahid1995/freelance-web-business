# Lead Tracker

**Status:** Phase 2 working lead-tracking system; future application integration defined  
**Owner:** Founder  
**Last updated:** 2026-10-04

## 1. Purpose

The lead tracker defines the business process for serious opportunities from first contact through qualification, proposal, decision, and closure.

The future customer application will provide the operational interface for live lead/opportunity records. This document remains the reusable business rule and lifecycle definition.

## 2. System of record

GitHub remains the system of record for the tracker structure, states, rules, and documentation.

When the customer application is implemented, live prospect/customer/project records should be stored in the secure application data store or another explicitly approved operating location, not in this public repository.

The application must preserve the business rules defined here without exposing internal qualification states as customer-facing copy.

## 3. Lead lifecycle

Use these primary states:

1. New — opportunity received and not yet reviewed.
2. Reviewing — basic relevance and information are being checked.
3. Clarification required — useful opportunity, but material information is missing.
4. Qualified — sufficient information exists to prepare a proposal or next commercial step.
5. Proposal prepared — proposal is internally ready.
6. Proposal sent — proposal has been delivered to the prospect.
7. Discussion — clarifications or commercial discussion are active.
8. Accepted — client has accepted the agreed commercial scope.
9. Not a fit — opportunity falls outside approved boundaries or cannot be responsibly pursued.
10. No decision — insufficient information or activity to justify further action.
11. Lost — opportunity was pursued but did not result in an accepted project.
12. Closed — opportunity is complete as a sales record and requires no further action.

Do not use Closed as a substitute for Accepted, Lost, or Not a fit. Those outcomes should remain visible in the history.

## 4. Required lead fields

Each serious opportunity should have:

Opportunity ID:
Date received:
Organization / prospect name:
Source:
Contact method:
Service category:
Problem / need:
Requested deliverables:
Qualification state:
Lead lifecycle state:
Desired timing:
Decision process:
Commercial requirement:
Known dependencies:
Risks / open questions:
Next action:
Next-action date, when applicable:
Reason no next-action date exists, when applicable:
Owner:
Last updated:
Outcome / closure reason:

Keep entries concise and factual.

## 5. Opportunity ID

Use a stable, non-sensitive identifier.

Recommended format: LEAD-YYYY-NNN

Examples:
- LEAD-2026-001
- LEAD-2026-002

Do not embed phone numbers, email addresses, customer IDs, or other personal information in the Opportunity ID.

## 6. Source tracking

Record where an opportunity originated, for example:

- Direct inquiry
- Referral
- Freelancer marketplace
- Agency relationship
- Existing contact
- Organic website inquiry
- Other documented source

Do not create false attribution. Record the actual source when known.

## 7. Required state discipline

Keep qualification state separate from lead lifecycle state.

Qualification state:
- Qualified
- Clarification required
- Not a fit
- No decision

Lead lifecycle state:
- New
- Reviewing
- Clarification required
- Qualified
- Proposal prepared
- Proposal sent
- Discussion
- Accepted
- Not a fit
- No decision
- Lost
- Closed

The qualification list remains the internal operational state. Customer-facing application labels must use the approved customer-facing timeline instead.

## 8. Next-action discipline

Every active lead should have:

- one clear next action;
- an owner;
- either a target date or an explicit factual reason why no next-action date exists.

Avoid vague next actions such as follow up when the actual action can be named.

## 9. Privacy and public-repository rules

Because this repository is public, do not store live lead records here when they contain personal or confidential information.

Never commit:

- personal phone numbers;
- personal email addresses;
- private messages;
- passwords or credentials;
- private customer documents;
- confidential budgets or procurement documents;
- private company data not approved for public use.

The public repository may contain the tracker structure, field definitions, workflow rules, and sanitized examples without real prospect data.

## 10. Follow-up rules

Follow-up should be based on the agreed next action and timing.

Record factual events such as proposal sent, clarification requested, reply received, meeting completed, decision date, and closure.

Do not manufacture urgency or misrepresent prior communication.

## 11. Pipeline review

A future Founder workspace should surface:

- active opportunities without a next action;
- qualified opportunities waiting for a proposal;
- proposals waiting for a client response;
- opportunities blocked by missing information;
- opportunities that should be closed;
- recurring sources of leads;
- recurring qualification failures.

Pipeline review should improve the process rather than encourage unsupported volume targets.

## 12. Handoff rules

### To qualification
A new project inquiry enters the qualification flow when the basic request is known.

### To proposal
Move to Proposal prepared only after qualification confirms that the opportunity is sufficiently clear and commercially processable.

### To delivery
Move to Accepted only after the agreed commercial and scope requirements are satisfied.

The future application may present a continuous customer/project record while preserving these internal lifecycle and qualification states.

## 13. Lead tracker review checklist

- [ ] Opportunity has a stable ID.
- [ ] Source is recorded accurately.
- [ ] Service category is identified or marked unclear.
- [ ] Problem and requested deliverables are captured.
- [ ] Qualification state is current.
- [ ] Lifecycle state is current.
- [ ] Next action is explicit.
- [ ] Active leads have appropriate next-action discipline.
- [ ] Material risks and dependencies are recorded.
- [ ] No unsupported client or business claims are present.
- [ ] No public-repository-sensitive data is stored.
- [ ] Closed/lost outcomes retain a factual closure reason.

## 14. Lifecycle

Opportunity received → Lead record → Qualification → Proposal → Discussion → Accepted / Lost / Not a fit / No decision → Closed

The future customer application should operationalize this process without changing its business meaning or exposing internal qualification terminology to customers.
