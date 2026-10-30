# Independent Code Review Standard

- **Status:** Proposed operational standard — pending Founder review
- **Owner:** Founder
- **Last updated:** 2026-10-30
- **Applies to:** Code reviews for this repository, including ChatGPT-assisted independent reviews

## 1. Purpose

Find defects that can affect users, data, security, or delivery. A review is useful when it identifies a real, actionable problem—not when it produces the largest number of comments.

The default review is **diff-first, evidence-led, and proportionate**. It should be comparable in usefulness to an automated pull-request reviewer while adding independent reasoning about business rules, trust boundaries, data flow, failure modes, and regressions.

This standard complements the repository's tests, CI checks, security scans, and approved decisions. It does not replace them.

## 2. Authority and boundaries

- The **Founder** is the final decision-maker.
- **GitHub** is the system of record.
- **Hermes or another implementation agent** may implement work within the authorized scope.
- The **independent reviewer** assesses the change and recommends action; it does not take implementation or release authority.

Unless the Founder separately authorizes it, a review is read-only. The reviewer must not edit application source, tests, configuration, or workflows; push commits; merge or close a PR; approve a PR; change repository settings; deploy; activate providers; or modify production data.

Automated reviewer output (including CodeRabbit, Codacy, SonarCloud, Semgrep, CodeQL, and similar tools) is evidence to investigate, not an authoritative verdict. A tool finding must be checked against the actual code, inputs, reachability, and impact before it is reported as a defect.

## 3. Default review workflow

### 3.1 Establish the target once

At the start, establish the repository, PR, base SHA, head SHA, and changed-file list. Read the Constitution, governance guidance, applicable `AGENTS.md` files, and the specific approved decisions or contracts relevant to the changed behavior.

Record the exact head reviewed. If the head changes during review, stop and review the new diff rather than mixing evidence from different commits.

Do not repeatedly fetch unchanged PR metadata, list every check, or re-verify branch settings when those facts are not relevant to the code question. Recheck metadata only when the target may have changed or when an external action is being considered.

### 3.2 Review the diff first

Read the complete diff and classify the changed surface. For each meaningful change, inspect only the surrounding implementation needed to understand:

- callers and consumers;
- authorization and trust boundaries;
- data models, persistence, and transactions;
- validation, error handling, and side effects;
- relevant tests, configuration, and public contracts.

Do not turn an ordinary PR review into a whole-repository audit. Expand beyond the diff only when tracing a real dependency, shared invariant, security boundary, or plausible regression requires it.

### 3.3 Apply the relevant defect checks

Prioritize checks that match the changed code. Consider:

1. **Correctness and business logic:** wrong conditions, state transitions, calculations, validation, edge cases, and inconsistent business rules.
2. **Security and privacy:** authentication, authorization, origin/CSRF controls, input handling, injection, secrets, information disclosure, tenant isolation, and abuse paths.
3. **Data integrity:** transaction boundaries, partial writes, uniqueness, idempotency, ordering, migrations, retention, and recovery.
4. **Reliability:** concurrency, race conditions, retries, timeouts, failure handling, and external-service assumptions.
5. **Compatibility and architecture:** API contracts, schema changes, callers, framework behavior, configuration, and unintended coupling.
6. **Performance:** demonstrable unnecessary work, query amplification, unbounded operations, or resource risks—not speculative micro-optimizations.
7. **Tests:** missing behavior, weak assertions, test-only paths, vacuous tests, over-mocking, and tests that do not detect the claimed regression.

Do not mechanically apply every category to every PR. Spend review effort where the changed behavior creates risk.

### 3.4 Verify proportionately

Use the strongest practical evidence with the least unnecessary work:

- inspect tests that exercise the changed behavior;
- run focused tests or checks when the environment and repository access make that useful;
- use full suites and builds when the scope or risk justifies them;
- inspect CI results for the exact reviewed head, not a previous commit;
- distinguish a product failure from a test defect, environment issue, flaky result, and unrelated baseline failure.

A green build proves only that the build completed. A green scanner wrapper does not prove every analyzer executed successfully or that there are no findings. A test count does not prove that the changed behavior is covered.

Treat implementation-agent reports as claims until supported by direct evidence. Do not rerun broad checks or enumerate unrelated workflow metadata merely to make the report look comprehensive.

## 4. Findings: what qualifies and how to report

Report a finding when there is a concrete defect or a sufficiently specific, material risk with a credible trigger and consequence. Prefer one finding per underlying root cause. Merge duplicate tool alerts that describe the same line and behavior.

Every finding must include:

- **Severity** and **confidence**;
- **Location:** exact file and line or the smallest useful range;
- **Problem:** what is wrong, stated plainly;
- **Trigger/evidence:** the input, state, call path, or condition that exposes it;
- **Impact:** what can happen and who or what is affected;
- **Recommendation:** the smallest reasonable direction for correction.

Use this severity scale:

| Severity | Meaning |
|---|---|
| **Critical** | Immediate, broadly exploitable compromise, severe data exposure/loss, or equivalent urgent impact. |
| **High** | Serious security, authorization, integrity, or core-flow defect with a credible path to significant harm. |
| **Medium** | Material correctness, security, reliability, or user-flow defect with bounded reach or meaningful preconditions. |
| **Low** | Limited-impact defect or concrete maintainability issue that is worth correcting but is not a major release risk. |
| **Informational** | Optional improvement or observation; not a defect and not a blocker. Keep these separate from findings. |

Confidence is **High**, **Medium**, or **Low**. State uncertainty explicitly. Do not inflate severity to attract attention.

A static-analysis warning is not automatically a security vulnerability. Check whether untrusted input can reach the operation, whether the path is production-reachable, and whether the alleged impact is possible. Likewise, a clone or complexity metric is not a defect by itself.

Do not report formatting preferences, speculative future problems without a concrete path, duplicate alerts as separate defects, or issues already disproved by the code and tests.

## 5. Review result and response format

Lead with actionable findings, ordered by severity. Keep the report short enough that the Founder can make a decision quickly.

Use one of these outcomes:

- **Findings present:** list each actionable finding with the fields in §4.
- **No actionable findings in reviewed scope:** say so plainly and name the files/behavior and checks actually reviewed.
- **Partial / inconclusive:** identify the precise evidence or access gap that prevents a conclusion.

After findings, include only the useful context:

- verification performed and exact head reviewed;
- important CI failures that are separate from code defects;
- material coverage gaps or unverified claims;
- non-blocking suggestions, clearly separated from defects.

Do not produce long inventories of successful checks, PR metadata, tool annotations, or repository settings unless they affect the decision. Do not claim that the entire repository is bug-free based on a PR review.

A concise finding should read like this:

> **[High] Reject cross-tenant access before loading the record** — `path/to/file.ts:42`  
> A member can submit another tenant's record ID and reach the update path because ownership is not checked before the write. Reproduce with a session from tenant A and a record ID from tenant B. This permits cross-tenant modification. Enforce tenant ownership in the service before mutation.

## 6. Review depth

The default is a focused pull-request review: inspect the diff, trace the directly affected paths, examine relevant tests, and verify material claims. This is the standard for ordinary documentation, UI, and bounded implementation changes.

Use a deeper, targeted review when a change touches authentication, authorization, payments, personal/customer data, persistence or migrations, concurrency, external integrations, cryptographic/token handling, or a public API contract. Deep review means expanding the relevant threat or failure analysis—not indiscriminately scanning unrelated files.

A whole-repository audit is a separate task and must not be implied by a routine PR review.

## 7. Completion and handoff

Before reporting completion:

- confirm findings are tied to the exact reviewed head;
- deduplicate overlapping findings;
- separate code defects from CI/baseline problems and optional improvements;
- state what was not verified;
- preserve the review-only boundary.

The independent reviewer provides recommendations. The Founder decides whether to accept a finding, request a fix, accept a documented limitation, or authorize a later change. Implementation, merge, and deployment remain separate actions.
