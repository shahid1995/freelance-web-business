# Customer Platform Direction and End-to-End Client Journey

**Status:** Approved  
**Date:** 2026-10-04  
**Founder approval:** Approved in the current project decision  
**Scope:** Future customer-facing application and business operating model

## Context

The Phase 4 website began as a public portfolio and business-presentation site. The Founder has now defined a broader long-term direction: the website should eventually become the customer-facing application for the complete business journey, from the first serious customer interaction through project delivery, handover, closure, and future work.

The existing repository already contains reusable foundations for positioning, sales qualification, proposals, client discovery, scope, milestones, QA, handover, and project closure. The new requirement is to provide one operational interface that connects those stages without turning the public GitHub repository into a live customer-data store.

The current website should therefore not be treated as a simple contact-form project. Contact/onboarding is the first visible step toward the larger customer platform.

## Decision

The business website will evolve into a unified web application with two permission-separated surfaces:

1. **Public/customer-facing experience** — public business information plus authenticated customer onboarding and project management.
2. **Founder/internal workspace** — internal operational views for live customer, opportunity, proposal, payment, project, delivery, and closure records.

The application will use an organization-centric model:

**Person → Organization → Projects**

A customer account begins at the first serious customer interaction using passwordless email authentication. Organization creation occurs during signup, and the first user becomes the organization owner/admin.

Each organization may have multiple projects. A project is created immediately when the customer starts a project and remains the same logical record throughout its lifecycle.

## Approved customer experience

- Passwordless email authentication.
- Organization created during signup.
- Customer dashboard after signup.
- Guided **Start Your Project** flow prominently available.
- Multiple projects per organization.
- Detailed customer-facing project timeline.
- Website/application as the primary customer communication channel.
- Central project document area.
- Organization owner/admin plus invited members.
- Project-specific access for ordinary organization members.
- Proposal review and acceptance inside the application.
- Formal agreement/e-signature inside the application as a future capability.
- Online payments inside the application as a future capability.
- Configurable payment schedules per project.
- Automatic project activation when required commercial conditions are satisfied.
- Guided client onboarding after activation.
- Customer submits onboarding information; Founder reviews and follows up inside the application.
- Internal qualification states remain internal and are never exposed as customer-facing labels.

## Operational model

The application becomes the operational system for live records such as:

- customer accounts;
- organizations and members;
- projects;
- inquiry and qualification state;
- communication;
- documents;
- proposal versions;
- agreement/signature status;
- payment state;
- discovery information;
- scope versions;
- milestones;
- customer approvals;
- change requests;
- QA/acceptance state;
- handover state;
- closure state;
- audit history.

GitHub remains the sole system of record for:

- business strategy;
- governance;
- material business decisions;
- approved service definitions;
- reusable business rules;
- documentation;
- application source code;
- repository/project history.

Live customer and project records must not be copied into the public business repository.

## Customer-facing versus internal state

The application must separate internal operational states from customer-facing presentation.

A customer-facing timeline may show:

**Account created → Project started → Information submitted → Review → Requirements confirmed → Proposal prepared → Proposal accepted → Agreement completed → Payment satisfied → Project setup → Milestones → Client review → QA → Handover → Completed**

Internal states such as **Qualified**, **Clarification required**, **Not a fit**, and **No decision** remain internal workflow states.

## Business and delivery boundaries

The application must preserve the existing rules:

- approved service definitions remain the scope boundary;
- qualification does not replace discovery;
- accepted commercial scope remains the delivery baseline;
- discovery must not silently expand accepted scope;
- scope remains versioned and reviewable;
- milestones organize approved work but do not redefine scope;
- defects remain distinct from new requests;
- client acceptance remains distinct from internal QA;
- handover remains distinct from closure;
- closure does not grant portfolio publication permission;
- future work is routed separately from closed scope unless an approved support arrangement applies.

## Security and privacy direction

The customer platform requires a secure application data boundary for live customer/project information.

The public repository must continue to exclude passwords, API keys/tokens, private keys, session identifiers, confidential customer information, client credentials, private project records, and sensitive payment information.

The application architecture must support least-privilege access, project-specific customer access, secure file handling, audit history, and environment-separated secrets.

## AI / LLM boundary

AI/LLM integration is explicitly deferred.

The current architecture must not depend on Gemini, OpenAI, Ollama, OpenRouter, or another LLM provider.

A future AI project guide may be added only through a separate Founder-approved decision.

## Deferred infrastructure and integrations

This decision does not authorize:

- production deployment;
- domain/DNS changes;
- hosting changes;
- payment-provider activation;
- e-signature provider activation;
- email-service activation;
- analytics activation;
- external customer communications;
- live customer-data migration.

These require separate implementation and/or Founder authorization.

## Phased product direction

### Stage 1 — Product foundation
Define application data model, organization/project model, roles, permissions, lifecycle states, and audit requirements.

### Stage 2 — Customer account and project onboarding
Build passwordless signup, organization creation, dashboard, project creation, saved onboarding progress, and initial project intake.

### Stage 3 — Sales workflow
Connect project intake to qualification and proposal without exposing internal qualification terminology.

### Stage 4 — Commercial workflow
Add proposal versions, customer acceptance, agreement/e-signature, configurable payment schedules, payment state, and automatic activation.

### Stage 5 — Delivery onboarding
Add guided onboarding, discovery information, Founder review, clarification, and delivery-readiness controls.

### Stage 6 — Project workspace
Add scope, milestones, documents, project communication, approvals, reviews, and change requests.

### Stage 7 — QA, handover, and closure
Add customer acceptance, appropriate QA visibility, handover, access transition, closure, and post-closure routing.

### Stage 8 — Founder operating workspace
Add internal pipeline and project-management views for live operations.

### Stage 9 — Advanced capabilities
Later additions may include recurring maintenance workflows, richer reporting, integrations, automation, and AI assistance.

## Consequences

The approach creates one continuous customer journey and avoids re-entering the same information across disconnected tools. It also turns the existing Phase 2 and Phase 3 foundations into future application workflows.

The trade-off is that the website becomes a real application requiring authentication, a secure data store, authorization, file storage, auditability, backups/recovery, and operational support. Implementation must therefore be incremental and verification-driven.

## Scope boundary

This decision establishes product direction and requirements. It does not implement the application, choose every infrastructure provider, approve pricing policy, authorize deployment, or authorize live external processing.

The next implementation slice should create the smallest vertical path through secure customer identity, organization creation, project creation, and saved project onboarding progress.
