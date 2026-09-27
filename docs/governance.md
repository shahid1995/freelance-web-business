# Governance

## Authority order

1. **Founder** — final business decision authority.
2. **Second Brain** — authoritative knowledge and accepted decision context.
3. **GitHub** — authoritative implementation and project record.
4. **Execution agents/tools** — implementation and verification support.

The practical rule is: **decisions are human-owned; implementation is repository-owned; context is knowledge-system-owned; execution is delegated.**

## Change lifecycle

For material work:

1. Inspect current state.
2. Identify the governing decision or create one if required.
3. Define a narrow acceptance criterion.
4. Implement on an isolated branch.
5. Verify the exact resulting state.
6. Review the change.
7. Merge only after the change is accepted.
8. Treat deployment/publication as a separate authorized action.

## Decision classes

### Material business decision

Examples: positioning, pricing policy, service scope, authority boundaries, major client-risk policy.

**Requires:** documented decision and Founder approval.

### Operational improvement

Examples: checklist wording, internal workflow refinement, non-strategic template improvement.

**Requires:** evidence and review; formal ADR only when material.

### Implementation detail

Examples: file organization, formatting, automation implementation, documentation mechanics.

**Requires:** alignment with accepted decisions and verification.

## Conflict rule

If the repository and knowledge context disagree on a material unresolved decision, do not silently choose a side. Surface the conflict and obtain Founder direction.

## External-action rule

A merged GitHub change is not permission to deploy, publish, contact a client, or alter live infrastructure.
