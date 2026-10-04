# Customer Platform Requirements

**Status:** Founder-approved product direction  
**Owner:** Founder  
**Last updated:** 2026-10-04  
**Related decision:** [Customer Platform Direction and End-to-End Client Journey](../decisions/2026-10-04-customer-platform-direction.md)

## 1. Purpose

Define the future product contract for evolving the public business website into a customer-facing application that supports the complete customer lifecycle from the first serious project interaction through project closure and future work.

This document captures the current Founder-approved product requirements and is the planning baseline for later architecture and implementation decisions.

## 2. Product vision

The product is one unified web application with:

- public business website;
- authenticated customer workspace;
- Founder/internal workspace;
- shared secure operational data model;
- role-based access;
- continuous customer/project lifecycle.

The product should minimize manual re-entry and disconnected handoffs while preserving authority, scope, privacy, and acceptance boundaries.

## 3. Core domain model

### Person
A person has an authenticated account and may belong to an organization.

### Organization
The organization is the primary customer relationship container.

An organization may have:
- one or more members;
- one or more projects;
- organization identity/settings;
- a history of active and completed work.

### Project
A project is the primary operational container for one customer engagement.

A project is created when a customer starts a project and remains the same logical record throughout its lifecycle.

A project may contain:
- intake;
- qualification state;
- messages;
- documents;
- proposal versions;
- agreement/signature records;
- payment schedule/status;
- onboarding/discovery;
- scope versions;
- milestones;
- approvals;
- change requests;
- QA/acceptance;
- handover;
- closure;
- audit history.

## 4. Authentication and signup

### Required
- Passwordless email authentication.
- No customer password requirement in the initial model.
- Secure one-time link or equivalent verification.

### Signup flow
**Email authentication → Person account → Organization creation → Organization owner/admin → Customer dashboard**

The first user of a newly created organization is the initial owner/admin.

## 5. Customer dashboard

The dashboard should:
- establish organization context;
- show accessible active and completed projects;
- provide a prominent Start Your Project action;
- surface required customer actions;
- link to documents, messages, proposals, approvals, and project status where applicable;
- avoid exposing internal workflow terminology.

## 6. Project creation and Project Intake

When a customer selects Start Your Project:
- create the project immediately;
- assign a stable non-sensitive identifier;
- establish an initial customer-facing state;
- attach all subsequent onboarding information to the same project;
- preserve the project history throughout its lifecycle.

The product should not require manual conversion from inquiry to project simply to preserve continuity.

Project Intake should collect, as relevant:
- service/project need;
- business problem;
- desired outcome;
- target users/audience;
- pages/screens/workflows;
- existing website/system;
- required functionality;
- integrations;
- existing assets/content;
- timing;
- constraints;
- dependencies;
- other information required to determine the next step.

Progress must be saved so customers can leave and resume.

The final customer questionnaire must be derived from approved qualification/discovery requirements and must not simply expose internal process documentation.

## 7. Customer-facing lifecycle and stage terminology

Provide a detailed customer-facing timeline. The pre-activation information-gathering stage is called **Project Intake**. After the project is activated, the delivery-preparation stage is called **Delivery Onboarding**. A future baseline may include:

1. Account created
2. Project started
3. Project Intake — Information submitted
4. Project Intake — Review
5. Requirements confirmed
6. Proposal prepared
7. Proposal accepted
8. Agreement completed
9. Payment satisfied
10. Delivery Onboarding — Project setup
11. Milestones
12. Client review
13. QA
14. Handover
15. Completed

The UI must separate customer-facing status from internal operational state.

Internal qualification outcomes currently include:
- Qualified
- Clarification required
- Not a fit
- No decision

Those labels are not customer-facing copy.

## 8. Communication

The application is the primary customer communication channel.

The project workspace should eventually support:
- customer messages;
- Founder replies;
- clarification requests;
- project updates;
- proposal discussion;
- change-request discussion;
- approval-related communication;
- activity/audit history.

Email is initially a notification/authentication channel rather than the primary operational record.

## 9. Documents

Each project must eventually have a central Documents/Files area.

Initial requirements:
- secure upload;
- project association;
- access control;
- file metadata;
- uploader and timestamp metadata.

Later capabilities may include:
- versions;
- previews;
- categories;
- retention controls.

Customer/project files must not be stored in the public GitHub repository.

## 10. Organization members and access

An organization supports:
- Owner/Admin;
- invited members.

The baseline authorization model is project-specific access:
- organization owner/admin has visibility into and administrative authority over all projects within the organization by default;
- ordinary members only see projects to which they have been explicitly assigned;
- membership in one project must not automatically grant access to unrelated projects.

## 11. Founder/internal workspace

The same application should eventually provide an internal workspace.

Initial internal access:
- Founder only.

The architecture should remain extensible for future staff roles and controlled automation identities.

Future Founder capabilities include:
- opportunity/qualification management;
- proposal management;
- payment status;
- onboarding/discovery review;
- project status;
- milestone management;
- customer actions awaiting response;
- QA/handover/closure state;
- organization/project history.

## 12. Proposal workflow

The application should eventually support:

**Qualified opportunity → Proposal → Customer review → Request changes or accept**

Proposal versions must remain identifiable.

Customer acceptance must record enough evidence to identify:
- customer identity;
- organization;
- project;
- proposal version;
- acceptance action;
- date/time.

Proposal acceptance does not silently change service boundaries.

## 13. Agreement and e-signature

The long-term product should support agreement/e-signature inside the application.

Future requirements:
- identifiable agreement version;
- signatory identity;
- organization/project association;
- timestamp;
- signed state;
- immutable or tamper-evident historical record;
- secure retention.

Legal validity, provider selection, document retention, and jurisdiction-specific requirements require separate decisions before production activation.

## 14. Payments

The long-term product should support online payments inside the application.

Payment schedules are configurable per project. Possible approved structures include:
- full upfront;
- deposit plus later payments;
- milestone-linked payments;
- another Founder-approved arrangement.

The application records payment state against the project and must not store raw payment credentials.

Provider selection, pricing, refunds, taxes, and financial policy require separate decisions.

## 15. Automatic project activation

The baseline commercial gate is:

**Proposal accepted → Agreement completed → Required payment conditions satisfied → Project activated**

The application should activate the project automatically when all required configured conditions are satisfied.

The exact activation conditions may vary by approved commercial configuration.

## 16. Delivery Onboarding and discovery

Project activation starts **Delivery Onboarding**.

The onboarding should collect information required by the existing discovery foundation:
- project objective;
- current situation;
- primary users;
- key workflows;
- existing systems/assets;
- client inputs;
- integrations/dependencies;
- constraints/assumptions;
- acceptance expectations;
- unresolved questions.

The approved interaction model is:

**Customer submits → Founder reviews → Founder follows up inside the application**

The first version does not require real-time shared editing of the formal discovery record.

## 17. Scope

The application should eventually support a versioned project scope derived from the accepted commercial baseline and discovery.

Scope must distinguish:
- included work;
- excluded work;
- deliverables;
- acceptance criteria;
- client responsibilities;
- assumptions;
- dependencies;
- constraints;
- open items;
- change history.

Material scope changes require explicit customer agreement through the approved workflow.

## 18. Milestones and delivery

The application should show milestones derived from approved scope.

Each milestone should support:
- purpose;
- scope references;
- required inputs;
- dependencies;
- readiness;
- status;
- completion criteria;
- customer review/approval where applicable;
- blockers/risks;
- activity history.

Milestones do not redefine approved scope.

## 19. Reviews and approvals

Where customer action is required, provide explicit actions such as:
- Review;
- Approve;
- Request changes.

Approval records must be auditable.

A customer message or comment must not silently modify an approved baseline.

## 20. Change requests

Customers should be able to initiate change requests from the project workspace.

The system must distinguish:
- defect/correction against existing approved scope;
- new/out-of-scope request.

New requests do not become approved scope automatically. The Founder reviews and determines the next commercial/scope action.

## 21. QA and acceptance

The application should eventually expose appropriate customer-facing QA/acceptance progress without exposing unnecessary internal test detail.

Customer acceptance remains distinct from internal QA.

Support:
- customer review;
- acceptance decision;
- request for correction;
- acceptance evidence;
- relationship to relevant scope/milestone version.

## 22. Handover and closure

The customer-facing lifecycle should support:

**Final QA → Customer acceptance → Handover → Closure**

Handover should communicate:
- delivered work;
- required materials;
- operational responsibility;
- access transfer status;
- known limitations;
- remaining items;
- support arrangement when explicitly agreed.

Closure records the final state without silently reopening scope or granting portfolio publication permission.

## 23. Repeat business

A closed project remains part of the organization's history.

The customer can start a new project from the same organization account.

Target relationship model:

**Organization → Project 1 → Project 2 → Project 3 → Future maintenance/new work**

## 24. Audit history

Material actions should create audit history, including as appropriate:
- account creation;
- organization changes;
- project creation;
- role/access changes;
- proposal version changes;
- proposal acceptance;
- agreement/signature state;
- payment state changes;
- discovery submissions;
- scope versions;
- approvals;
- change requests;
- milestone state changes;
- handover;
- closure.

Exact storage and retention require a later technical/security decision.

## 25. Notifications

Email should notify customers about events such as:
- sign-in;
- action required;
- proposal available;
- clarification requested;
- approval required;
- payment due;
- milestone ready for review;
- project status change.

The notification provider must remain replaceable. Brevo is a candidate, not yet an implementation decision.

## 26. Data boundaries

### GitHub
Authoritative for:
- business rules;
- documentation;
- decisions;
- reusable policies;
- source code;
- repository history.

### Application
Operational store for live:
- customer;
- organization;
- project;
- communication;
- documents;
- proposals;
- agreements;
- payments;
- delivery;
- approvals;
- closure data.

### Client repositories
Client-specific source code and detailed implementation remain in the client repository or another approved project boundary.

The customer application does not replace the client source repository.

## 27. Security and privacy requirements

The application must be designed for:
- least-privilege authorization;
- project-specific customer access;
- secure session/authentication handling;
- secure file storage;
- environment-separated secrets;
- protection of sensitive payment information;
- auditable material actions;
- explicit data retention/deletion rules before production use.

The public GitHub repository must continue to exclude passwords, API keys/tokens, private keys, session identifiers, confidential customer information, client credentials, private project records, and sensitive payment information.

## 28. Deferred capabilities

Not in the current implementation contract:
- LLM/AI project guide;
- automated AI qualification decisions;
- AI-generated commercial commitments;
- advanced automation/agent identities;
- analytics;
- production deployment;
- domain/DNS management;
- provider-specific payment implementation;
- provider-specific e-signature implementation.

Each deferred capability requires its own implementation/Founder decision when reached.

## 29. Implementation principle

Do not build the complete platform in one release.

Each implementation stage should deliver a thin vertical slice through real customer behavior with:
- explicit acceptance criteria;
- data-model checks;
- authorization checks;
- user-flow verification;
- security/privacy verification;
- auditability where applicable;
- regression verification.

The first implementation slice should cover:

**passwordless customer identity → organization creation → customer dashboard → project creation → saved project onboarding progress**

No payment, production deployment, live e-signature, or AI is required for that first slice.
