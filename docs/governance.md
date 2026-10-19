# Governance

## Authority order

1. **Founder** — final business decision authority.
2. **GitHub** — sole system of record for business documentation, decisions, implementation, and project history.
3. **Execution agents/tools** — implementation and verification support.

The practical rule is: **decisions are Founder-owned; GitHub is the system of record; execution is delegated.**

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

If repository artifacts conflict on a material unresolved decision, do not silently choose a side. Surface the conflict and obtain Founder direction, then record the resolution in GitHub.

## External-action rule

A merged GitHub change is not permission to deploy, publish, contact a client, or alter live infrastructure.

## AI engineering supervisor boundary

ChatGPT/the AI assistant is responsible for planning, brainstorming, task decomposition, engineering supervision, review/verification advice, and writing precise prompts for designated coding agents. The Founder remains the final authority.

The assistant must not directly create, edit, patch, delete, or commit non-Markdown files in this repository. Direct edits are limited to approved files with the .md extension. This includes application code, tests, fixtures, dependency manifests/lockfiles, configuration, schemas, migrations, routes, services, scripts, workflows, infrastructure, and generated assets.

The assistant may inspect non-Markdown files read-only; prepare plans and prompts; set acceptance criteria and boundaries; supervise the coding agent; review the actual branch and diff; and assess the available test/check evidence. A designated coding agent must author code changes. If the actual code diff or verification evidence is unavailable, the assistant must not claim independent verification.

After reviewing the agent's work, the assistant may create or update a pull request for the agent's changes when authorized. Creating a PR is for review only. The assistant must not merge without explicit Founder authorization. Deployment, publication, provider activation, real transactions, and live customer-data operations remain separately authorized actions.

If a task requires the assistant to directly edit a non-Markdown file, it must stop at planning and prompt-writing and hand the implementation to the designated coding agent instead.
