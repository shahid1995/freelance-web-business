# Freelance Web Development Business Constitution

**Status:** Initial draft — Phase 0
**Authority:** Founder
**Last updated:** 2026-09-27

## 1. Purpose

Build a durable, professional web-development business that acquires clients, delivers reliable websites and web applications, creates reusable assets, and improves continuously through documented learning.

## 2. Founder Authority

The Founder is the final authority for:

- business direction
- service positioning
- pricing policy
- client acceptance criteria
- major operational decisions
- public-facing claims and brand representation
- changes to this constitution

## 3. Source-of-Truth Boundaries

### GitHub — Implementation Authority

GitHub contains the implementation, version history, reusable assets, portfolio website source, templates, procedures, and project artifacts that are intentionally stored in the repository.

### Second Brain — Knowledge and Context Authority

The Obsidian Second Brain contains broader knowledge, research, reasoning context, and decision context that may inform this business.

A GitHub artifact must not silently override an accepted business decision stored as authoritative context.

### Execution Agents and Tools

Agents and tools are execution support. They may implement approved work, inspect evidence, and report findings, but they may not redefine accepted product or business decisions.

## 4. Client Separation

Every real client project must be isolated in its own repository or explicitly approved project boundary.

The central business repository must not become a storage location for client secrets or confidential customer material.

## 5. Scope Control

No project should begin with materially undefined deliverables.

Each paid project should establish, as appropriate:

- deliverables
- exclusions
- milestones
- acceptance criteria
- revision boundaries
- client-provided inputs
- deployment/handover responsibilities

## 6. Integrity

The business must not:

- claim work was completed when it was not
- present fabricated client work as real client work
- invent performance, revenue, traffic, or conversion results
- conceal material project limitations
- expose confidential client information
- use client credentials outside the authorized scope

## 7. Quality

Work should be tested before delivery to the extent appropriate for the project.

Testing should cover the main user flows and important responsive behavior, with additional checks for security, accessibility, performance, or integration risk when relevant.

## 8. Financial Discipline

Pricing must be based on scope, effort, risk, value, platform fees, and sustainable delivery capacity rather than a race to the lowest price.

## 9. Reusability

When a project produces a genuinely reusable pattern, checklist, component, template, or lesson, capture it in the business system where appropriate.

## 10. Continuous Improvement

The operating loop is:

**Capture → Connect → Understand → Decide → Act → Review**

Completed projects should feed improvements back into the system.

## 11. Change Management

Material permanent business decisions should be documented in `docs/decisions/`.

Operational documents may evolve without an ADR when the change does not materially alter business strategy, public positioning, pricing policy, authority boundaries, or client risk.

## 12. Public Repository Safety

Because this repository is intentionally public:

- do not commit passwords, API keys, tokens, private keys, or session data
- do not commit confidential client documents
- do not commit personal data unless intentionally public and necessary
- keep environment-specific secrets outside Git
- review changes before publication

## 13. Deployment Authority

Publishing or deploying a public-facing website, client project, or production system requires explicit authorization for that action. Repository changes alone do not authorize deployment.
