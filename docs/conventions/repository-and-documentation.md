# Repository and Documentation Conventions

**Status:** Phase 0.5 — Approved repository convention set
**Owner:** Founder
**Last updated:** 2026-09-27

## 1. Purpose

These conventions make the public GitHub repository predictable, searchable, reviewable, and maintainable as the business grows.

They define how business material is organized and changed. They do not replace the Constitution, service definitions, project scope, or Founder decisions.

## 2. Repository authority

GitHub is the sole system of record for business documentation, decisions, implementation, and project history.

The Founder remains the final authority for material business decisions.

Changes that materially affect business strategy, positioning, pricing, service scope, authority, client risk, or public claims require Founder approval and must be recorded in GitHub.

## 3. Directory responsibilities

Use the top-level directories consistently:

- docs/strategy/ — business strategy and planning
- docs/positioning/ — market, audience, positioning, and messaging
- docs/services/ — public service definitions and scope boundaries
- docs/pricing/ — approved pricing policy and pricing decisions
- docs/sales/ — sales and qualification material
- docs/delivery/ — client delivery practices
- docs/quality/ — QA and quality standards
- docs/finance/ — business finance material
- docs/decisions/ — material permanent business decisions
- portfolio/ — portfolio projects, evidence, and case studies
- templates/ — reusable client/business templates
- operations/ — recurring checklists, workflows, and trackers
- website/ — public portfolio website source

Do not create a new top-level directory for a narrow topic when an existing directory can own it.

## 4. File naming

Use lowercase kebab-case for new Markdown filenames.

Examples:

- business-positioning.md
- service-catalog.md
- client-discovery.md

Use README.md for the index or orientation document of a directory.

Avoid spaces, camelCase, unexplained abbreviations, and duplicate names in different folders unless the different paths represent genuinely different concepts.

## 5. Document structure

Living business documents should use a predictable structure where useful:

1. Title
2. Status
3. Owner when material
4. Last updated
5. Purpose or scope
6. Main content
7. Boundaries, assumptions, or exclusions where relevant
8. Approval/status notes where relevant

Not every document needs every section. Use only metadata that helps readers understand authority or freshness.

## 6. Decision records

Material permanent business decisions belong in docs/decisions/.

Use the filename pattern:

YYYY-MM-DD-short-title.md

A decision record should normally contain:

- Context
- Problem or question
- Options considered
- Decision
- Consequences
- Status
- Date
- Founder approval when relevant

Do not use a decision document to disguise an implementation detail as a business decision.

## 7. Changelog

CHANGELOG.md records meaningful repository-level milestones.

Add an entry for:

- phase completion
- material governance changes
- material strategy/positioning/service changes
- substantial reusable-system additions

Do not use the changelog for every small typo or routine documentation edit.

## 8. Branch conventions

Use short, descriptive branch names that identify the work type and subject.

Preferred patterns:

- phase-0-4-service-catalog
- docs/topic-name
- feat/topic-name
- fix/topic-name
- chore/topic-name

Use one coherent objective per branch.

main is the integration branch. Routine work should be developed on a separate branch and proposed through a pull request.

## 9. Commit conventions

Commit messages should be short, specific, and written as an action.

Preferred prefixes:

- docs:
- feat:
- fix:
- chore:
- refactor:

Examples:

- docs: establish service catalog
- docs: update delivery checklist
- chore: reorganize portfolio structure

Avoid vague messages such as update, changes, or work.

## 10. Pull requests

Each pull request should state:

- Purpose
- Scope
- What is not included
- Acceptance criteria
- Verification performed
- Relevant decision/issue when applicable

Keep one coherent objective per pull request.

A pull request may be stacked on another pull request when the dependency is intentional and clearly described.

Merging does not authorize deployment, publication, client communication, or other external actions.

## 11. Verification records

For material work, record the verification performed in the pull request or relevant issue.

Verification should identify what was actually checked, not merely state that the work was reviewed.

For documentation-only changes, verification should include at least:

- affected files read back from GitHub
- required sections or links checked
- accidental secrets or sensitive data checked when relevant
- repository diff reviewed for unrelated changes

## 12. Links and references

Prefer relative repository links for material stored in this repository.

Use descriptive link text.

Do not rely on external pages as the sole record of a business decision that belongs in GitHub.

When an external source is necessary for context, identify the source and capture the durable business implication in GitHub when appropriate.

## 13. Sensitive material

This repository is public.

Never commit:

- passwords
- API keys or tokens
- private keys or certificates
- session data
- confidential client documents
- private customer datasets
- credentials copied from client systems

Sanitize screenshots, exports, examples, and portfolio evidence before committing them.

## 14. Revisions, archival, and removal

When a document becomes obsolete:

- update or replace it when the new document represents the same continuing policy;
- preserve the historical record when the old decision is materially important;
- remove a document only when it is clearly unnecessary and removal does not destroy required business history.

Do not silently delete a material decision or important project record.

## 15. Practical change rule

For repository work, use:

Inspect → Plan → Implement → Verify → Review → Merge

Before merging, confirm that:

- the change matches the intended scope;
- required documentation is updated;
- no unrelated work is included;
- links and filenames are correct;
- public-repository safety rules are satisfied;
- the acceptance criteria are actually verified.
