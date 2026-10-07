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
- Customer Proposal Review — an authorized customer reads the current published proposal version for their own project at /dashboard/projects/{reference}/proposal; strictly read-only, with no response action
- Customer Proposal Response — two explicit, version-bound customer actions on the current published proposal version at /dashboard/projects/{reference}/proposal: Request Changes (any authorized customer with project access, required message up to 5,000 characters) and Accept Proposal (organization Owner/Admin only), recorded in append-only `proposal_responses` history and audited with identifiers only

These are implemented and merged into main, but nothing is deployed or activated for live customers and no live customer data is processed.

### Future capabilities — implementation not yet approved

The approved product requirements describe the rest of the customer and delivery journey. These capabilities are present in the approved requirements, but appearing there does not authorize them: each still requires an approved design and a separate implementation task.

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

The agreement/e-signature design gate is now open in docs/decisions/2026-10-07-agreement-e-signature.md (Status: Proposed; Founder approval pending). It is a proposed design only: it is not implemented, no provider is selected, and no legal or retention decision is made. Opening a design gate is not implementation.

### Planned or deferred

- Domain/hosting — deferred
- Analytics — deferred

The customer platform requirements are defined in docs/website/customer-platform-requirements.md. Product direction is recorded in docs/decisions/2026-10-04-customer-platform-direction.md. The implementation architecture is described in website/README.md. The implemented slices are governed by the accepted decisions docs/decisions/2026-10-04-customer-platform-foundation.md, docs/decisions/2026-10-05-customer-platform-founder-workspace.md, docs/decisions/2026-10-05-founder-project-queue.md, docs/decisions/2026-10-05-proposal-foundation.md, docs/decisions/2026-10-06-customer-proposal-review.md, and docs/decisions/2026-10-06-customer-proposal-response.md.

The first slice uses a local SQLite data store and a local email sink behind provider-neutral ports. Selecting a managed database and activating a live email provider remain separate decisions.

Phase 4 does not authorize production deployment, external publication, live provider activation, or live customer-data processing.

## Phase 5 — Acquisition and Improvement

Planned:

- Targeted acquisition
- Client conversion tracking
- Reviews/testimonials
- Repeat business
- Periodic system review
