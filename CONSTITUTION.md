# Freelance Web Development Business

**Status:** Version 1.0 — Phase 0.2
**Authority:** Founder
**Last updated:** 2026-09-27

## 1. Purpose

Build a durable, professional web-development business that acquires clients, delivers reliable websites and web applications, creates reusable assets, and improves continuously through documented learning.

This constitution defines the business-level authority, repository boundaries, decision rules, integrity requirements, and change controls that apply across the business system.

## 2. Founder Authority

The Founder is the final authority for:
- business direction and priorities
- service positioning and public claims
- pricing policy
- client acceptance criteria
- material commercial and operational decisions
- portfolio representation
- changes to this constitution
- authorization of deployments, publication, and other irreversible external actions

Implementation agents and tools do not supersede Founder decisions.

## 3. Source-of-Truth Boundaries

### GitHub — Sole System of Record and Implementation Authority

GitHub is the sole system of record for this business. It contains the versioned business strategy, decisions, research and reference material, approved templates, operating procedures, portfolio source material, and website source intentionally stored here.

GitHub records what has actually been decided and implemented in the business repository. Material Founder decisions should be recorded in GitHub so that the repository remains the durable source of business context and execution history.

### Founder — Decision Authority

The Founder is the final authority for material business decisions. When a decision has not yet been documented in GitHub, the Founder's direction controls and should be recorded in GitHub before it becomes part of the operating system.

### Execution Agents and Tools

Agents and tools are execution support. They may inspect evidence, propose implementation details, implement approved work, run verification, and report findings. They may not redefine accepted business strategy, invent business decisions, silently change scope, publish or deploy without authorization, or introduce client or business secrets into this repository.

## 4. Client Separation

Every real client project must be isolated in its own repository or explicitly approved project boundary. The central business repository is not a client-project repository.

Do not store here:
- client passwords
- API keys or tokens
- production secrets
- private keys or certificates
- confidential customer documents
- private customer datasets
- unrelated project source code
- credentials copied from client systems

Client-specific implementation belongs in the client's repository. Reusable, sanitized knowledge may be captured here only when it contains no confidential client information and is appropriate for reuse.

## 5. Scope Control

No paid project should begin with materially undefined deliverables.

As appropriate, each project should establish:
- deliverables
- exclusions
- milestones
- acceptance criteria
- revision boundaries
- client-provided inputs
- dependencies
- deployment and handover responsibilities
- assumptions and known constraints

Material scope changes should be recorded before implementation proceeds.

## 6. Integrity and Representation

The business must not:
- claim work was completed when it was not
- present fictional or internal work as client work
- invent performance, revenue, traffic, or conversion results
- imply client approval that was not received
- conceal material project limitations
- expose confidential client information
- use client credentials outside the authorized scope

Portfolio and sales material must distinguish clearly between real client work, founder-owned/internal work, and demonstrations or concepts.

## 7. Quality and Delivery

Work should be tested before delivery to the extent appropriate for the project.

Verification should cover the main user flows and important responsive behavior, with additional checks for security, accessibility, performance, integrations, and browser compatibility when relevant to the project.

A deliverable is not considered verified merely because code exists or a build succeeds.

## 8. Financial Discipline

Pricing and commercial decisions should account for scope, effort, risk, value, platform fees, delivery capacity, support obligations, and revision/change risk.

The business should not accept unsustainable scope merely to maximize project volume.

Material pricing policy belongs in docs/pricing/ and requires Founder approval.

## 9. Reusability

When a project produces a genuinely reusable pattern, checklist, component, template, or lesson, capture it in GitHub where appropriate.

Reusable material must be sanitized and must not expose client-confidential information. Client-specific code remains in the client repository.

## 10. Continuous Improvement

The business operating loop is:

**Strategy → Services → Portfolio → Sales → Client Delivery → Review → Document Learnings → System Improvement**

Completed work should generate evidence and lessons that can improve future decisions, templates, quality controls, and delivery practices.

## 11. Decision Management

Material permanent business decisions should be documented in docs/decisions/.

A material decision should normally record:
1. Context
2. Problem or question
3. Options considered
4. Decision
5. Consequences
6. Status
7. Date and Founder approval where relevant

Operational improvements may be made without a formal decision record when they do not materially alter strategy, positioning, pricing policy, authority boundaries, client risk, or public claims.

When uncertainty materially affects a business decision, record the uncertainty rather than presenting an assumption as a fact.

## 12. Change and Merge Control

Repository changes should be scoped to one coherent objective, reviewable, traceable to a phase/issue/approved decision when material, and verified before merge.

The default workflow is:

**Inspect → Plan → Implement → Verify → Review → Merge**

Merging a pull request does not authorize deployment or public publication. Unrelated project work must not be mixed into business-repository changes.

## 13. Public Repository Safety

Because this repository is intentionally public:
- never commit passwords, API keys, tokens, private keys, or session data
- never commit confidential client documents
- never commit private customer data unless it is intentionally public and necessary
- keep environment-specific secrets outside Git
- inspect generated files before committing
- treat screenshots and exported datasets as potentially sensitive
- remove credentials and identifying customer information from portfolio evidence

Public visibility is intentional. It does not by itself grant third parties permission to reuse proprietary business materials.

## 14. Deployment and Publication Authority

Repository changes alone do not authorize external publication.

Explicit Founder authorization is required before deploying the business website, deploying a client system, publishing a production release, changing live infrastructure, sending client-facing communications as an operational action, or performing another irreversible external action.

Agents may prepare deployment instructions or verify a deployment after authorization, but may not infer authorization from a merged PR.

## 15. Governance Review

This constitution should be reviewed when the business materially changes its operating model, a new class of client/service introduces new risk, an authority boundary becomes ambiguous, repeated operational failures expose a missing rule, or the Founder explicitly requests a governance review.

The constitution should remain concise enough to be understood and strong enough to prevent recurring governance errors.
