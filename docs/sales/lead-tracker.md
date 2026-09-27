# Lead Tracker

**Status:** Phase 2 working lead-tracking system  
**Owner:** Founder  
**Last updated:** 2026-09-27

## 1. Purpose

The lead tracker records serious business opportunities from first contact through qualification, proposal, decision, and closure.

The tracker is a process record, not a client database. Store only the information needed to manage the opportunity and protect the sales workflow.

## 2. System of record

For this business, the GitHub repository is the system of record for the tracker structure and rules.

Individual lead records should use an approved operating location when implemented. Do not place live prospect data, personal contact details, credentials, or confidential client information into this public repository.

This document defines the fields, states, and workflow that any future lead-tracking implementation must follow.

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

For example:

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

The lifecycle list above is the complete set of states defined in Section 3. Qualification state remains a separate field and should not be inferred from lifecycle state.

## 8. Next-action discipline

Every active lead should have:

- one clear next action;
- an owner;
- either a target date or an explicit reason why no next-action date exists.

If a target date is available, record it in Next-action date and leave the reason field empty.

If a target date is not appropriate or cannot yet be determined, leave Next-action date empty and record the factual reason in Reason no next-action date exists.

Examples:

- Request missing sitemap
- Confirm required integration
- Send proposal for review
- Follow up after agreed date
- Close after no response
- Record client decision

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

The public repository may contain:

- the tracker structure;
- field definitions;
- workflow rules;
- sanitized examples that contain no real prospect information.

## 10. Follow-up rules

Follow-up should be based on the agreed next action and timing.

Record factual events:

- proposal sent;
- clarification requested;
- reply received;
- meeting completed;
- decision date;
- opportunity closed.

Do not manufacture urgency or misrepresent prior communication.

## 11. Pipeline review

A periodic review should identify:

- active opportunities without a next action;
- qualified opportunities waiting for a proposal;
- proposals waiting for a client response;
- opportunities blocked by missing information;
- opportunities that should be closed;
- recurring sources of leads;
- recurring qualification failures.

Pipeline review should improve the process rather than encourage unsupported volume targets.

## 12. Lead record template

Use this structure for an individual lead in the approved operating location:

### Lead record

Opportunity ID: LEAD-YYYY-NNN  
Date received: YYYY-MM-DD  
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

### Activity log

| Date | Event | Summary | Next action |
|---|---|---|---|
| YYYY-MM-DD | Received | Initial opportunity recorded | Review relevance |
| YYYY-MM-DD | Qualification | Factual summary | Next action |

Keep the activity log factual, minimal, and free of unnecessary personal information.

## 13. Handoff rules

### To qualification

A new opportunity enters the qualification flow when the basic request is known.

### To proposal

Only move to Proposal prepared after the qualification flow confirms that the opportunity is sufficiently clear and commercially processable.

### To delivery

Only move to Accepted after the agreed commercial and scope requirements are satisfied.

The lead tracker does not replace the eventual project scope, agreement, delivery record, or client repository.

## 14. Lead tracker review checklist

- [ ] Opportunity has a stable ID.
- [ ] Source is recorded accurately.
- [ ] Service category is identified or marked unclear.
- [ ] Problem and requested deliverables are captured.
- [ ] Qualification state is current.
- [ ] Lifecycle state is current and uses one of the states defined in Section 3.
- [ ] Next action is explicit.
- [ ] Active leads have either an appropriate next-action date or a factual reason no date exists.
- [ ] Material risks and dependencies are recorded.
- [ ] No unsupported client or business claims are present.
- [ ] No public-repository-sensitive data is stored.
- [ ] Closed/lost outcomes retain a factual closure reason.

## 15. Lifecycle

Opportunity received → Lead record → Qualification → Proposal → Discussion → Accepted / Lost / Not a fit / No decision → Closed

The tracker exists to preserve continuity and evidence across the sales process, not to replace judgment or Founder authority.