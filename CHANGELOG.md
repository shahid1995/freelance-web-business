# Changelog

## 2026-10-08

### Agreement and e-signature (implementation slice)
- Implemented the Founder-approved Q1-A agreement model: one primary agreement per project, immutable numbered versions, exact accepted proposal-version binding, additional contractual terms, one authorized customer signer, append-only signature evidence, idempotent signing, stale-baseline rejection, and atomic signature/version/audit writes.
- Added provider-neutral Founder agreement authoring/publishing and customer signing surfaces. Signed agreement content download/view remains explicitly deferred under Q10; no provider is selected or activated.
- Added focused real-service/real-SQL verification for authorization, baseline binding, Q1-A completion, replay safety, stale rejection, immutability, audit evidence, and unchanged customer project stage. No deployment or live customer data operation occurred.

## 2026-10-07

### Agreement and e-signature (design and Q1–Q3 approved)
- Recorded Founder approval on 2026-10-07 for the Agreement / E-signature design in docs/decisions/2026-10-07-agreement-e-signature.md (Status: Approved). Q1–Q3 were also resolved on 2026-10-07: one authorized customer signer with no default Founder countersignature; exact accepted proposal-version binding with additional contractual terms permitted; and one primary agreement per project initially, with additional agreement types deferred to future related records if needed. The design remains provider-neutral, no provider is selected, Q4–Q8 remain production/provider/legal gates, and no deployment or provider activation is authorized.
- Preserves the accepted distinction that Accept Proposal is application-level commercial evidence and explicitly not a legal signature. No contract or signature is claimed to exist, and no legal validity is asserted.
- No e-signature provider is selected or integrated (provider selection remains a later decision); no payment or project activation is implemented, and no customer project stage or `customerStageFor` is changed.
- Unresolved business and legal questions are recorded explicitly as Founder decision required: signer authority, whether the agreement restates or references the accepted terms, multiple-agreement support, legal framework, provider selection, signatory identity proofing, document retention, jurisdiction-specific requirements, decline/expiry behavior, and customer download access.
- Design only. No application code, schema, route, endpoint, UI, or test was added; nothing is deployed, no provider is activated, and no live customer data is processed.

## 2026-10-06

### Customer Proposal Response (implementation)
- Implemented and merged the approved Customer Proposal Response slice from docs/decisions/2026-10-06-customer-proposal-response.md (PR #45, merge commit d9c95f265393197878fe55a5820a26e00e8fe0a9): two explicit, version-bound customer actions on the current published proposal version — Request Changes and Accept Proposal — with a new append-only `proposal_responses` table, a sibling `CustomerProposalResponseService`, the form-post endpoint `POST /api/projects/{reference}/proposal-response`, and the response UI on `/dashboard/projects/{reference}/proposal`.
- Append-only response history is the source of truth; a version's standing (open / changes requested / accepted) is always derived from it. No stored response state is added to the proposal, the version, or the project, and the store exposes no update or delete path for a written row.
- Version binding: the customer submits the visible version number and the server re-derives the current published version under `status = 'published' AND published_at IS NOT NULL` inside the same transaction that writes; a stale version is rejected with nothing written — no silent rebinding, no superseded-version acceptance, no partial record.
- Request Changes is open to any authorized customer with project access, with a required message capped at 5,000 characters validated in the service and re-enforced by the table's CHECK constraint. Repeated requests are each recorded immutably, and `action_key` makes retried or replayed submissions idempotent: one row, one audit event.
- Accept Proposal is restricted to the organization Owner/Admin by the existing authorization, evaluated inside the service on every call; the `founder` capability is never a customer response path. Acceptance is allowed only while a version is open, is rejected after a change request on that version, and is terminal per project + proposal + version, with at most one acceptance row enforced by a partial unique index. Acceptance is application-level evidence only — not a signature, and it creates no agreement, payment, or activation.
- Added audit events `proposal_response.accepted` and `proposal_response.changes_requested`, appended in the same transaction as the response row and carrying identifiers only — never the customer's message and never proposal content. Reading remains non-mutating with no view event.
- No project-level acceptance state and no customer project-stage change: `customerStageFor` and the customer-facing *Proposal accepted* stage are unchanged, no customer JSON read endpoint was added, and notifications, messaging, documents, and rate limits remain out of scope.
- Added 40 focused tests covering the ADR's verification contract: authorization (including the service-level IDOR regression restated for this service and revocation between submissions), version binding in both concurrent-publication orders, the rule table, message and action-key validation before persistence, idempotent replays, database CHECK and unique-index enforcement, the two-layer evidence contract including rollback when the audit append fails, and unchanged customer projections and stage derivation.
- Nothing is deployed or activated for live customers and no live customer data is processed. The merge does not authorize deployment.

### Customer Proposal Response (design accepted)
- Accepted the Customer Proposal Response design — Request Changes and Accept Proposal, each bound to one exact published proposal version — in docs/decisions/2026-10-06-customer-proposal-response.md (Status: Accepted; Founder approval: Approved 2026-10-06).
- The design specifies append-only `proposal_responses` history as the source of truth; the customer submits the visible version number and the server re-derives the current published version under `status = 'published' AND published_at IS NOT NULL` inside the recording transaction, rejecting a stale version and writing nothing; Request Changes is open to any authorized customer with a required message capped at 5,000 characters; Accept Proposal is restricted to the organization Owner/Admin and is application-level evidence only, explicitly not a legal signature.
- Also fixed: acceptance is disallowed once Request Changes exists for that version (the workflow is Request Changes → Founder publishes the next version → review → Request Changes again or Accept); acceptance is terminal per project + proposal + version; no project-level acceptance state is added; `customerStageFor` and the customer-facing *Proposal accepted* stage are unchanged.
- **Design accepted on 2026-10-06; implementation followed in PR #45** (see the implementation entry above). The design-acceptance change itself was documentation only. This is not a production release, and no deployment, provider activation, or live customer-data operation occurred.

### Customer Proposal Review (implementation)
- Implemented and merged the accepted Customer Proposal Review design from docs/decisions/2026-10-06-customer-proposal-review.md (PR #43, merge commit c4bf074): an authorized customer can read the current published proposal version for their own project at /dashboard/projects/{reference}/proposal.
- The slice is read-only: no form and no state-changing control, no customer JSON endpoint, no write and no audit event on reading, no customer project-stage change, and a field-by-field customer-safe projection that excludes internal proposal and version identifiers.
- Discoverability is the existing `hasPublishedProposal` customer signal, false for no proposal and for drafts only, so a draft can never be inferred.
- Nothing is deployed or activated for live customers and no live customer data is processed.

## 2026-10-05

### Proposal Foundation (implementation)
- Implemented the approved Proposal Foundation slice from docs/decisions/2026-10-05-proposal-foundation.md.
- Added a proposal domain, store-port methods, a `node:sqlite` adapter, an internal projection, a Founder-only service, and a Founder-only internal UI surface (`/internal/projects/{reference}/proposal` plus `POST /api/internal/projects/{reference}/proposal`). No new dependency, table outside the existing store, or customer-facing change was introduced.
- One proposal per project, enforced by a database unique constraint. One proposal identity stays stable across versions.
- Versions are immutable and append-only, numbered oldest first and unique within the proposal. Changing what a proposal says means writing the next version; there is no update or delete path for a written version.
- Proposal content is deliberately all free text with no amount or currency column, because pricing is a separate, unapproved Founder decision; `commercialTerms` records the terms the Founder has approved.
- `draft` is the default version status. Publication is a separate, explicit, Founder-only, idempotent act that records a publish instant. Publishing does not mean the customer has seen or accepted anything, and it does not move the customer-facing stage.
- Customer boundary unchanged: no customer route, endpoint, or projection reads a proposal, drafts never reach a customer view, and the customer-facing project stage, customer projections, and access rules are untouched by creating, versioning, or publishing a proposal.
- Authorization reuses the existing `founder` internal capability and never infers internal access from an organization owner/admin role, so no second permission concept was added.
- Added audit events `proposal.created`, `proposal_version.created`, and `proposal_version.published`. Metadata identifies the actor, project, proposal, and version number and never copies proposal content, so the audit trail cannot become a second copy of the commercial document.
- Added 19 focused tests covering proposal authorization, version immutability and deterministic numbering, publication behaviour, the unchanged customer boundary and access rules, the audit contract (including that metadata never copies proposal content), and server-side status validation.
- Did not deploy, activate any provider, or process live customer data. Customer review, request-changes, acceptance, agreement/e-signature, payments, automatic activation, notifications/email, file attachments, AI/LLM, templates, analytics, and delivery onboarding remain out of scope.

## 2026-10-05

### Founder Project Queue (implementation)
- Added a Founder-only internal queue at /internal/projects that lists projects whose Project Intake has been submitted, newest submission first with project reference as the deterministic secondary order. Governed by docs/decisions/2026-10-05-founder-project-queue.md.
- Cross-organization by design: the Founder holds the internal capability and membership in no customer organization, so customer organization and project access rules are not consulted for the queue.
- Read-only. Loading the queue performs no write and creates no audit event, and cannot start a review.
- Only submitted intake appears; the draft filter is applied in SQL, so an unfinished intake is never read.
- Narrow internal projection carrying only project reference, title, organization name, submission timestamp, customer-facing stage, and whether review has started. Internal notes, qualification state, Founder decision, internal next action, intake answers, customer identity, and audit data are excluded by construction.
- Each queue row links to the existing /internal/projects/{reference}/review page, which remains the only place internal work happens and is unchanged by this slice.
- Added a cross-organization submitted-intake query to the existing store port and removed a vestigial unused index type. No table, column, migration, dependency, or customer-facing change was introduced.
- Added 16 focused tests covering queue authorization, draft exclusion, cross-organization visibility, deterministic ordering, projection narrowness, read-only loading, and unchanged customer projections and access rules.
- Did not deploy, activate any provider, or process live customer data.

## 2026-10-05

### Founder Workspace and Project Intake review (implementation)
- Implemented the approved Founder/internal workspace slice defined in docs/decisions/2026-10-05-customer-platform-founder-workspace.md.
- Added a dedicated server-side internal capability (`founder`) attached to a Person, independent of organization membership and customer roles, never inferred from an organization owner/admin role, never grantable through customer UI or customer endpoints, and never returned in a customer response. Initial assignment is a controlled server-side bootstrap from `CUSTOMER_PLATFORM_FOUNDER_EMAIL_HASHES`, which is empty by default.
- Documented and regression-tested the capability lifecycle as **initial assignment rather than a live allow-list**, matching the accepted decision: once a person holds the capability the stored grant is authoritative, and removing an address hash from configuration does not revoke it. Revocation is an explicit server-side operation. The slice has no administration surface, so nothing can revoke today; a revocation made while the hash stays configured would be re-established by the bootstrap, recorded as a known limitation needing its own decision before any administration surface exists.
- Added a separate internal route tree (/internal/projects/{reference}/review) and API surface (/api/internal/projects/{reference}/review), with no links from customer-facing UI and no shared handler with the customer endpoints. Internal authorization is checked on the server on every operation and state-changing requests keep the existing session and origin protections.
- Added a strictly read-only Founder review view showing the organization, customer identity, project, submitted Project Intake, customer-facing stage, and audit history, built field by field in a separate internal projection that drops audit metadata.
- Added an explicit Start Review action, the only thing that moves the customer-facing stage from Project Intake — Information submitted to Project Intake — Review. Loading the review page performs no write and creates no audit event.
- Added internal-only qualification state, internal notes, Founder decision, and internal next action, each Founder-only, server-authorized, persisted to the same project, and audited. None of them moves the customer-facing stage.
- Closed the Founder decision vocabulary to proceed, clarification_required, not_a_fit, and hold. Unknown and empty values are rejected on the server and never coerced; the decision is stored separately from qualification state and is never derived from it.
- Added audit events project_intake.review_started, project.customer_stage_changed, project.qualification_changed, project.internal_note_added, project.internal_note_updated, project.founder_decision_recorded, and project.internal_next_action_recorded.
- Made project references globally unique with a database-enforced unique index, so a customer-visible reference identifies exactly one project across the whole platform rather than one per organization. Reference allocation now checks globally instead of per organization, the customer organization-scoped lookup and project-access rules are unchanged, and a database that already contains cross-organization duplicates fails to open with an explanatory message rather than rewriting any existing reference.
- Preserved the approved organization/project access model and the existing customer projections unchanged; customer responses still carry no internal field.
- Added 36 focused tests covering internal authorization, review behaviour, state separation, Founder decision validation, and access preservation.
- Did not deploy, activate any provider, or process live customer data. Proposal generation, proposal acceptance, agreements/e-signature, payments, delivery onboarding, AI/LLM, analytics, file storage, and customer chat remain out of scope.

## 2026-10-05

### Customer platform foundation merged and Founder-approved
- Merged the first customer-platform vertical slice (PR #35, merge commit 904057f) into main.
- Recorded Founder approval of the Customer Platform Foundation decision (docs/decisions/2026-10-04-customer-platform-foundation.md): Status Accepted, approved 2026-10-05.
- The slice is implemented and merged but is not deployed or activated for live customers. Nothing is deployed, no provider is activated, and no live customer data is processed.
- Updated repository status documentation so it no longer describes the first customer-platform vertical slice as a future or unmerged slice.
- Opened the next design gate: Founder/internal workspace and Project Intake review, proposed in docs/decisions/2026-10-05-customer-platform-founder-workspace.md (Status Proposed; Founder approval pending). No application code, routes, database schema, or authentication behavior changed.

## 2026-10-04

### Customer platform first vertical slice (implementation)
- Implemented passwordless customer identity → organization creation → customer dashboard → project creation → saved Project Intake draft progress as a server-authoritative slice.
- Added the provider-neutral domain, data-store, and email-delivery boundaries under website/lib/platform/, with a `node:sqlite` adapter and a local email sink behind those ports. No database or mail dependency was added and no provider was activated.
- Added single-use sign-in links with hashed secrets, short configurable expiry, atomic consumption, replay rejection, sign-in and verification rate limiting, and responses that do not reveal whether an address is registered.
- Added opaque server-side sessions stored as hashes, HttpOnly/Secure/SameSite cookie handling that is environment-aware, server-side revocation, and origin checks on every state-changing request.
- Added Person, Organization, Membership, Project, Project Access, Project Intake, Authentication Challenge, Session, and Audit Event records.
- Added the ADR authorization matrix enforced on the server: organization owner/admin administration and organization-wide project access, ordinary members limited to explicitly assigned projects, and immediate revocation when an assignment is removed.
- Added customer-facing projections that are built field by field, so qualification state, internal notes, Founder-only decisions, internal next actions, and audit metadata cannot reach a customer response.
- Added customer routes /sign-in, /onboarding/organization, /dashboard, and /dashboard/projects/{reference}/intake, plus their endpoints. Existing public routes and public-site behavior are unchanged.
- Added a Node test-runner suite covering the foundation ADR verification contract, and `npm test` plus `tsconfig.test.json`. No test framework dependency was added.
- Added the foundation acceptance-gate documentation for the selected authentication/session and data-store approaches in website/README.md.
- Did not deploy, activate any provider, or process live customer data. Merging this change does not authorize deployment or live customer operation.

## 2026-10-04

### Customer platform direction
- Approved the long-term evolution of the public website into a unified customer-facing application and Founder/internal workspace.
- Defined the organization-centric model: person → organization → projects.
- Defined passwordless customer identity, guided project onboarding, project-specific customer access, in-application communication, central project documents, proposal acceptance, future agreement/e-signature, configurable payments, automatic activation, delivery onboarding, milestones, QA, handover, and closure.
- Established customer-facing lifecycle status separately from internal qualification states.
- Deferred AI/LLM, hosting/domain, analytics, and provider-specific live integrations from the current implementation slice.
- Added the canonical customer-platform requirements document at docs/website/customer-platform-requirements.md.
- Updated the website, sales, delivery, roadmap, and content-map documents so they no longer describe the product as a portfolio-only or contact-form-only system.

## 2026-09-27

### Phase 4.2 website scaffold
- Established the Next.js 16 App Router application scaffold under website/.
- Added shared accessible navigation, footer, skip-link, responsive styling, service content model, service detail routes, about route, portfolio-safe work route, contact placeholder, and not-found route.
- Kept the scaffold server-rendered and dependency-light with plain CSS.
- Kept live contact integrations, analytics, domain/hosting, deployment, and publication outside the scaffold PR.

### Phase 4 foundation
- Established the Public Portfolio Website foundation, including information architecture, public route map, content source hierarchy, portfolio publication rules, claims controls, accessibility and performance requirements, privacy/security boundaries, environment/deployment boundaries, and website acceptance criteria.
- Created the website/ source-directory contract for the public portfolio website.
- Kept domain/hosting, contact flow, analytics, production deployment, and publication as separate Phase 4 work items.

### Phase 3 completion
- Completed the Phase 3 Client Delivery System structural review.
- Verified continuity across Discovery, Scope, Milestones, QA, Handover, and Project Closure.
- Verified scope/change-control boundaries, client-acceptance authority, defect versus new-request separation, and client-repository/public-repository safety controls.
- Confirmed no client-specific delivery records were introduced into the public business repository.
- Marked Phase 3 structurally complete and advanced the roadmap to Phase 4 — Public Portfolio.

### Phase 3
- Advanced the roadmap to the Client Delivery System.
- Established the reusable Client Discovery process, including entry conditions, discovery stages, questions, outputs, boundaries, change control, privacy rules, record structure, and handoff to scope.
- Established the reusable Project Scope process, including scope authority, included and excluded work, deliverables, acceptance criteria, client responsibilities, assumptions, dependencies, constraints, open items, traceability, versioning, and change control.
- Established the reusable Project Milestones process, including sequencing, readiness conditions, dependency management, completion criteria, blocker states, timeline discipline, change control, review, and handoff to QA and closure.
- Established the reusable Quality Assurance and Verification process, including test planning, functional and cross-environment checks, accessibility, performance, security/privacy, integrations, defect classification, evidence, QA gates, accepted limitations, and handoff to handover.
- Established the reusable Project Handover process, including transfer prerequisites, deliverable and operational handover, access and credential boundaries, client acceptance, corrections versus new requests, access removal, handover states, and closure readiness.
- Established the reusable Project Closure process, including final scope reconciliation, acceptance and handover reconciliation, open-item disposition, access/security closure, commercial and administrative status, evidence retention, portfolio/public-use boundaries, closure states, reopening rules, and future-work routing.
- Marked all six reusable delivery components as having working foundations.
- Identified a separate Phase 3 completion review as the next delivery-system checkpoint.

### Phase 2 completion
- Completed the Phase 2 Sales System structural review.
- Confirmed the freelancer profile, proposal system, qualification flow, and lead tracker form a reusable sales workflow.
- Confirmed qualification and lifecycle states remain distinct.
- Confirmed active lead next-action discipline requires either a target date or a factual reason no date exists.
- Confirmed evidence, claims, commercial, and public-repository privacy controls remain in force.
- Kept live prospect records, external platform activity, outreach, and unapproved pricing outside the public repository.
- Marked Phase 2 structurally complete and advanced the roadmap to Phase 3 — Client Delivery System.

### Phase 2 foundation
- Started the Sales System.
- Established a canonical master freelancer profile.
- Established a reusable proposal template system with scope, deliverables, assumptions, acceptance, and service-specific prompts.
- Established a qualification flow for relevance, scope clarity, dependencies, readiness, decision process, commercial readiness, and risk checks.
- Defined qualification outcomes and handoff rules before proposal preparation.
- Established a lead-tracking structure for opportunity states, next actions, handoffs, and closure.
- Added privacy boundaries so live personal or confidential prospect data is not stored in the public repository.
- Defined proposal controls so commercial terms use only Founder-approved pricing.
- Defined evidence and claims controls for platform-specific profile variants.
- Kept pricing, unverified credentials, client results, ratings, and fabricated portfolio proof out of the profile and proposal system.

### Phase 1
- Completed the Phase 1 portfolio foundation review.
- Confirmed the portfolio system is structurally ready to move into the Sales System phase.
- Established canonical Project IDs across the portfolio registry and project-record structure.
- Added explicit project-directory ID conventions for consistent case-study and evidence references.
- Established the portfolio project-record intake structure.
- Added conventions for individual project records.
- Added case-study directory conventions.
- Added screenshot evidence directory conventions.
- Kept the portfolio system evidence-based and separated from invented client work.

### Earlier Phase 1 foundation
- Started the Portfolio Foundation.
- Added the portfolio directory orientation document.
- Added a standard portfolio project record template.
- Added a standard public case-study template.
- Added screenshot/evidence standards for the public repository.
- Reworked the portfolio index into a registry with ownership, publication-status, and evidence controls.
- Kept initial portfolio slots explicitly labeled as concepts rather than completed client work.

### Phase 0.5
- Established repository and documentation conventions.
- Defined directory ownership, filename rules, document structure, decision-record conventions, changelog usage, branch naming, commit style, pull request expectations, verification records, link conventions, public-repository safety, and archival rules.
- Added a reusable pull request template.
- Marked Phase 0 as complete and Phase 1 as the next planned phase.

### Phase 0.4
- Established the initial six-service public catalog.
- Defined purpose, target use cases, core deliverables, typical scope, exclusions, optional extensions, client inputs, and acceptance criteria for each service.
- Added explicit catalog-wide scope boundaries.
- Kept pricing separate from service definitions as a Founder-owned business decision.
- Added separate service definition documents for business websites, landing pages, redesign/modernization, custom web applications, dashboards/portals, and maintenance/improvements.

### Phase 0.3
- Added the business positioning document.
- Defined initial target audience groups and their common web problems.
- Defined the core public service positioning without introducing pricing decisions.
- Added a public messaging hierarchy and evidence-based language guidance.
- Explicitly separated development deliverables from business outcomes that cannot be guaranteed.
- Updated the phase roadmap to match the current Founder-defined sequence: 0.4 Service Catalog, 0.5 Repository and Documentation Conventions.

### Phase 0.2
- Promoted CONSTITUTION.md from initial draft to Version 1.0.
- Clarified Founder, GitHub, and execution-agent authority boundaries.
- Established GitHub as the sole system of record for business documentation, decisions, and project context.
- Added explicit decision-conflict handling.
- Strengthened client repository and confidential-data separation.
- Defined integrity rules for portfolio and sales representation.
- Added merge/change-control expectations.
- Clarified that merge does not authorize deployment or publication.
- Added public-repository safety rules for screenshots and exported data.
- Added governance-review triggers.

### Phase 0.1
- Confirmed the dedicated repository exists as a public GitHub repository.
- Confirmed the default branch is main.
- Reorganized the initial bootstrap into the intended long-term repository structure.
- Preserved the existing constitution and initial business material.
- Added repository-level secret-safety and client-separation boundaries.
