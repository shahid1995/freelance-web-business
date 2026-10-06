# Project Map

## Phase 0 — Business Foundation

Completed:

- 0.1 Dedicated GitHub repository and initial structure
- 0.2 Constitution and governance
- 0.3 Business positioning
- 0.4 Service catalog
- 0.5 Repository and documentation conventions

Pricing policy is a material business decision and will be documented separately when approved.

## Phase 1 — Portfolio Foundation

Completed:

- Portfolio system structure
- Project record template
- Canonical Project IDs
- Case-study template and source linkage
- Screenshot standards and evidence organization
- Portfolio registry
- Portfolio project-record intake structure
- Case-study directory conventions
- Screenshot evidence directory conventions
- Initial portfolio slots
- Phase 1 completion review

Phase 1 creates the portfolio operating system. It does not create or imply completed client work, verified business results, or public portfolio claims without evidence.

## Phase 2 — Sales System

Completed:

- Freelancer profile — master profile foundation
- Proposal templates — master proposal system
- Qualification flow — lead qualification foundation
- Lead tracker — opportunity tracking foundation
- Phase 2 completion review

The master freelancer profile remains the source for future platform-specific profile variants. Pricing and external acquisition activity remain separate Founder-approved decisions.

## Phase 3 — Client Delivery System

Completed:

- Discovery — foundation established
- Scope — foundation established
- Milestones — foundation established
- QA — foundation established
- Handover — foundation established
- Project Closure — foundation established
- Phase 3 completion review

Phase 3 provides a reusable foundation from accepted opportunity through project closure. Client-specific delivery records remain outside this public business repository.

## Phase 4 — Public Website and Customer Platform

Current:

- Public portfolio website foundation — established
- Website application scaffold — established
- Website content and portfolio integration — established
- Website visual/design foundation — established
- Customer platform direction — approved
- Customer platform requirements — established

### Implemented and merged

- Customer platform foundation — the first vertical slice: passwordless sign-in → organization creation → customer dashboard → project creation → saved Project Intake draft
- Founder/internal operating workspace and Project Intake review — Founder-only review of a submitted intake, including Start Review and internal-only qualification state, notes, decision, and next action
- Founder Project Queue — a read-only, cross-organization internal inbox of submitted intakes at /internal/projects
- Proposal Foundation — Founder-only authoring of one proposal per project with immutable numbered versions and an explicit, audited publication act

These are implemented and merged into main, but nothing is deployed or activated for live customers and no live customer data is processed.

### Future capabilities — implementation not yet approved

The approved product requirements describe the rest of the customer and delivery journey. These capabilities are present in the approved requirements, but no implementation decision has been approved for them, and they are not authorized merely by appearing in the requirements.

- customer proposal review
- request changes
- customer acceptance
- agreement/e-signature
- payments
- automatic project activation
- Delivery Onboarding
- customer/project documents
- project messaging/communication
- milestones
- client review
- QA
- handover
- closure
- notifications

Each of these remains a future design and implementation step until its own implementation decision is approved.

### Planned or deferred

- Domain/hosting — deferred
- Analytics — deferred

The customer platform requirements are defined in docs/website/customer-platform-requirements.md. Product direction is recorded in docs/decisions/2026-10-04-customer-platform-direction.md. The implementation architecture is described in website/README.md. The implemented slices are governed by the accepted decisions docs/decisions/2026-10-04-customer-platform-foundation.md, docs/decisions/2026-10-05-customer-platform-founder-workspace.md, docs/decisions/2026-10-05-founder-project-queue.md, and docs/decisions/2026-10-05-proposal-foundation.md.

The first slice uses a local SQLite data store and a local email sink behind provider-neutral ports. Selecting a managed database and activating a live email provider remain separate decisions.

Phase 4 does not authorize production deployment, external publication, live provider activation, or live customer-data processing.

## Phase 5 — Acquisition and Improvement

Planned:

- Targeted acquisition
- Client conversion tracking
- Reviews/testimonials
- Repeat business
- Periodic system review
