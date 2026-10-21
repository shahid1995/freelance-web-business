# Main Branch Protection Policy and Activation Plan

- **Status:** APPROVED — CONFIGURATION ACTIVE AND VERIFIED — ENFORCEMENT VERIFIED
- **Owner:** Founder
- **Date:** 2026-10-21
- **Last re-verified against live GitHub:** 2026-10-21
- **Scope:** Repository governance for the `main` branch only

> Founder approval was given on 2026-10-21 for the recommended starting policy below and for implementation of the main-only protection rules. This document records that approval.
>
> **Update (2026-10-21):** The ruleset has since been applied and independently re-read from the live GitHub API. Ruleset `25555806` (`protect-main-founder-approved`) exists, targets exactly `refs/heads/main`, and reports `enforcement: active`. The configuration is therefore **active**, not merely approved. Merge-blocking behaviour was then demonstrated separately by a controlled pull request and is recorded in §11.1; it is **not** implied by the word "active" alone.

## 1. Purpose and authority

This approved policy defines a minimum, practical protection policy for `main` in the public repository `shahid1995/freelance-web-business`.

The Founder remains the final authority. GitHub is the sole system of record. The Founder has approved the recommended starting decisions in §5 and §13 and authorised implementation. The approved policy has since been applied as repository ruleset `25555806` and re-read live from GitHub (§3.4). Configuration state and enforcement state are recorded separately: an active ruleset is a configuration fact, while merge-blocking behaviour is an enforcement fact, demonstrated by the controlled pull-request test recorded in §11.1.

The relevant governing documents are [the Constitution](../../CONSTITUTION.md), [Governance](../governance.md), and the [repository and documentation conventions](../conventions/repository-and-documentation.md).

## 2. Context and risk

The repository recently experienced an accidental payment-configuration merge into `main`, requiring a path-scoped rollback. See [the scanner-retirement decision](2026-10-21-scanner-workflow-retirement.md) for the relevant incident context and the workflow-retirement follow-up.

That incident does not prove branch protection alone would have prevented every error, but it demonstrates the need for stronger default integration controls and a reliable review trail.

The intended safeguards are to make ordinary changes reach `main` through pull requests, prevent force-push and branch-deletion accidents, and require a small set of trustworthy automated checks without creating a policy that silently blocks documentation-only work.

## 3. Current verified state

### 3.1 State at proposal preparation (historical)

The following observations were made while the policy was being drafted. They are retained as decision history. They are **superseded** by the live re-verification in §3.4.

| Item | Observation | Evidence / limitation |
|---|---|---|
| `main` commit at proposal preparation | `1b2e12484542923d5124839c81800fe6202bd88c` | [Merge commit](https://github.com/shahid1995/freelance-web-business/commit/1b2e12484542923d5124839c81800fe6202bd88c); re-check immediately before any future activation |
| Branch metadata | `protected: false`; protection metadata reported disabled, with no required status-check contexts | Live GitHub branch endpoint at the time of inspection |
| Repository rulesets | Rulesets endpoint returned an empty list | [Repository rulesets API](https://api.github.com/repos/shahid1995/freelance-web-business/rulesets) returned `[]` during this inspection |
| Dedicated branch-protection detail endpoint | Access denied to the connected integration | The detail endpoint returned HTTP 403; do not infer further settings from that endpoint |
| Default branch | `main` | Repository metadata |
| Merge methods currently allowed | Merge commits, rebase, and squash | Live repository metadata; squash was used for PR #55 |
| Root/nested `AGENTS.md` guidance checked | No `AGENTS.md` was found at repository root, `docs/`, or `docs/decisions/` | This is not a claim that no such file could exist at any other path |

### Observed check-run inventory

The current workflow files are:

- [Website CI](../../.github/workflows/ci.yml): workflow name `Website CI`. Its pull-request and push triggers are path-filtered to `website/**` and `.github/workflows/ci.yml`.
- [CodeQL Advanced](../../.github/workflows/codeql.yml): pull requests to `main` run the JavaScript/TypeScript analysis. The observed check-run name is `Analyze (javascript-typescript)`.
- [Codacy Security Scan](../../.github/workflows/codacy.yml): runs on pull requests to `main`. The observed check-run name is `Codacy Security Scan`.
- [Dependency review](../../.github/workflows/dependency-review.yml): runs on pull requests to `main`. The observed check-run name is `dependency-review`.

On PR #55, the check runs named `Analyze (javascript-typescript)`, `Codacy Security Scan`, and `dependency-review` completed successfully. The successful run evidence is available from the [PR #55 checks](https://github.com/shahid1995/freelance-web-business/pull/55).

Additional app-based checks have also been observed on PR #55, including `SonarCloud Code Analysis`, `semgrep-cloud-platform/scan`, and the Snyk status context `security/snyk (shahid1995)`. Evidence from one PR is not enough to establish that every external app check will always be emitted on every relevant PR.

Important distinctions and limits:

- `Website CI` may not run on documentation-only PRs because of its path filters. Do not make it required until the workflow reports a stable, successful gate for every PR type where it must be enforced.
- The merge commit's GitHub Checks API showed three completed successful check runs: SonarCloud Code Analysis, `Analyze (javascript-typescript)`, and Codacy Security Scan.
- The classic commit-status endpoint for that merge commit reported `pending` with no individual status entries. This differs from the successful Check Runs API results; it must not be treated as proof those check runs failed. Before requiring any classic status context, confirm it appears reliably in GitHub's required-check selector and on representative PRs.
- The post-merge SonarCloud quality-gate check passed, but its report also indicated three new issues. Passing a quality gate must not be described as zero findings.
- No check inventory here proves runtime API security testing exists. That remains a separate open gap.

### 3.4 Live configuration verification (re-read from GitHub, 2026-10-21)

The following values were re-read directly from the live GitHub REST API after the policy was applied. They are **verified facts**, not inferences.

| Item | Live value | Evidence |
|---|---|---|
| Ruleset ID | `25555806` | [Live ruleset](https://github.com/shahid1995/freelance-web-business/rules/25555806) and [ruleset API](https://api.github.com/repos/shahid1995/freelance-web-business/rulesets/25555806) |
| Ruleset name | `protect-main-founder-approved` | Same endpoints |
| Ruleset target | `branch` | Same endpoints |
| Enforcement | `active` | Same endpoints |
| Created / updated | `2026-10-21T14:52:05.876Z` / `2026-10-21T14:53:13.794Z` | Same endpoints |
| Branch scope | `include: ["refs/heads/main"]`, `exclude: []` | `conditions.ref_name` on the same endpoint |
| Ruleset count in repository | Exactly `1` — no duplicate or competing ruleset | [Repository rulesets API](https://api.github.com/repos/shahid1995/freelance-web-business/rulesets) returned a single-element array |
| `main` branch metadata | `protected: true` | Live branch endpoint for `main` |
| Classic branch protection on `main` | `enabled: false`, `required_status_checks.enforcement_level: "off"`, `contexts: []` | Live branch endpoint; confirms the approved "ruleset only, no redundant classic rule" choice (Q1) |
| Ruleset evaluation against `main` | GitHub reports all four rules of ruleset `25555806` as applying to `refs/heads/main`: `deletion`, `non_fast_forward`, `pull_request`, `required_status_checks` | [Rules branch evaluation endpoint](https://api.github.com/repos/shahid1995/freelance-web-business/rules/branches/main) |
| `main` SHA at verification | `39be4554c871c9341b979124f9371e2f99b28a19` | Merge commit of [PR #56](https://github.com/shahid1995/freelance-web-business/pull/56) |

Rule-by-rule re-read of ruleset `25555806`:

| Rule | Live value | Approved-policy correspondence |
|---|---|---|
| `pull_request` | `required_approving_review_count: 0` | Q5 — zero independent approvals for the single-Founder model |
| `pull_request` | `required_review_thread_resolution: true` | Q12 — conversation resolution required |
| `pull_request` | `require_code_owner_review: false`, `require_last_push_approval: false`, `dismiss_stale_reviews_on_push: false` | Q12 — stale-approval rules deferred |
| `pull_request` | `require_extra_approval_for_unattributed_changes: true` | Platform default for repository rulesets; noted, not a Founder-approved change |
| `pull_request` | `allowed_merge_methods: ["merge", "squash", "rebase"]` | Q13 — linear history deferred; merge methods unchanged |
| `required_status_checks` | `strict_required_status_checks_policy: false` | Q11 — branch-up-to-date enforcement left off |
| `required_status_checks` | `do_not_enforce_on_create: false` | Required checks are enforced on pull-request creation, not deferred |
| `required_status_checks` | contexts `Analyze (javascript-typescript)`, `Codacy Security Scan`, `dependency-review`, each with `integration_id: 15368` (GitHub Actions) | Q6, Q7, Q8 — the three approved candidates, now required |
| `deletion` | present (deletion of `main` blocked) | Q13 |
| `non_fast_forward` | present (force pushes blocked) | Q13 |
| `branch_freshness` / linear history / signed commits / merge queue | **absent** | Q11, Q13, Q12 — deferred controls remain off |

Confirmations that nothing extra was enabled:

- `Website CI` is **not** among the required contexts (Q9 — its `website/**` path filters would leave it absent on documentation-only pull requests).
- `SonarCloud Code Analysis`, `semgrep-cloud-platform/scan`, and `security/snyk (shahid1995)` are **not** among the required contexts (Q10 — advisory).
- Branch-freshness enforcement is **off** (`strict_required_status_checks_policy: false`).
- The ruleset does **not** modify, weaken, or duplicate any other rule; exactly one ruleset exists.

**Bypass-actor evidence and its limit.** The unauthenticated ruleset response omits the `bypass_actors` field entirely, so this verification could not independently re-confirm the bypass list from the public API. The earlier admin-permission observation recorded in [Issue #57](https://github.com/shahid1995/freelance-web-business/issues/57) reported an empty bypass list and `current_user_can_bypass: never`. That earlier observation is recorded here as a reported fact with a stated access level, **not** as something re-confirmed in this pass. It is listed in §14 as a remaining limitation.

### 3.5 Check-run inventory on the verified `main` SHA

Check runs on `main` at `39be4554c871c9341b979124f9371e2f99b28a19`:

| Check run | Status | Producing app | Run / job link |
|---|---|---|---|
| `Analyze (javascript-typescript)` | completed / success | GitHub Actions (`15368`) | [run 39618314693, job 119284805672](https://github.com/shahid1995/freelance-web-business/actions/runs/39618314693/job/119284805672) |
| `Codacy Security Scan` | completed / success | GitHub Actions (`15368`) | [run 39618314512, job 119284803707](https://github.com/shahid1995/freelance-web-business/actions/runs/39618314512/job/119284803707) |
| `SonarCloud Code Analysis` | completed / success | SonarQube Cloud (`12526`) | [run 119290389197](https://github.com/shahid1995/freelance-web-business/runs/119290389197) |

The classic commit-status endpoint for the same commit reports `state: pending` with `total_count: 0` — the same distinction recorded at proposal time. It is not evidence of failure; the Check Runs API shows the three runs above completed successfully.

**Important consequence for enforcement testing.** The `dependency-review` workflow is triggered by `pull_request` only. It therefore does **not** run on the merge commit, and the merge commit carries only two of the three required contexts. All three required contexts are only observable on a pull request. This is the reason the controlled test in §11 uses a pull request rather than a push.

## 4. Options considered

### Option A — Leave `main` unprotected

Rejected as the default recommendation. It leaves no server-side enforcement that routine changes must use a pull request and no configured required status checks.

### Option B — Classic branch protection rule

Viable for a single repository and straightforward for standard settings. It can enforce pull requests, required checks, and restrictions such as force-push prevention. GitHub documents its behaviour in [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

### Option C — One repository ruleset targeting `main`

**Approved choice, subject to feature availability.** Rulesets are visible to readers, can be put into different enforcement states where supported, and can be layered without relying on a single matching classic branch-protection rule. Rulesets are now available and in use: ruleset `25555806` is active on `refs/heads/main`, and the classic branch-protection subobject for `main` reports `enabled: false`, so the two mechanisms are not duplicating each other. See [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) and [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

Choose either Option B or C for the first implementation; do not configure both redundantly. The approved approach is a single ruleset targeting only `main`, subject to confirmation that the required controls are available in this repository's GitHub plan and account UI. **Outcome:** Option C was chosen and implemented. Ruleset `25555806` is the single ruleset in the repository, and the classic branch-protection subobject for `main` reports `enabled: false`, so the two mechanisms were not configured redundantly.

## 5. Founder-approved minimum policy

The Founder-approved minimum policy is:

1. Target only the exact `main` branch.
2. Require a pull request before merging.
3. Do not add a bypass actor or administrator bypass exception in the initial policy; confirm the selected GitHub mechanism enforces the rule for the repository owner/admin as intended.
4. Initially require the three candidate checks listed in §7 only after the check-name and reliable-run preflight is reconfirmed on representative PRs. If any selected context is missing, ambiguous, skipped, or unreliable, do not activate the rule until resolved. **Outcome:** the preflight was reconfirmed (§3.4, §3.5) and the three contexts are now required. If a selected context later proves missing or unreliable, the rule is to investigate that specific condition rather than to weaken an unrelated control (§12).
5. Require all review conversations to be resolved before merge.
6. Explicitly block force pushes and branch deletion.
7. Do not require an independent approval in the current single-Founder model. Revisit that decision if a genuine independent reviewer becomes available.
8. Initially leave strict up-to-date-branch enforcement and linear-history enforcement off; decide separately after check reliability and merge-method policy are confirmed.

This policy creates a PR trail without pretending that a lone Founder can supply an independent approval. It also avoids turning an external integration that has only been observed on a limited sample into a hard gate.

## 6. Pull-request requirement

Routine changes should be made on an isolated topic branch and proposed to `main` through a pull request, consistent with [repository conventions](../conventions/repository-and-documentation.md).

The rule should reject ordinary direct updates to `main`, subject to the chosen mechanism's documented bypass behaviour. No bypass actors should be configured initially. Any emergency exception must require a separate explicit Founder decision, a recorded reason, and subsequent review of the resulting commit.

The pull-request requirement is configured: ruleset `25555806` contains a `pull_request` rule and `main` reports `protected: true`. Whether it actually rejects an ordinary direct update has **not** been demonstrated — no direct push to `main` was attempted, by design. See §11.1 and §14.

Do not validate the rule by attempting a direct push to `main`. Use the settings UI/API for read-only verification and, if needed, a separately authorised disposable test branch for enforcement testing.

## 7. Required status checks: exact candidates and limits

The approved candidate list below is based on observed check-run names and workflow definitions. **The first three entries are now required on `main`** by ruleset `25555806`, using the exact contexts shown, each tied to GitHub Actions integration ID `15368`. The remaining entries are advisory and were deliberately not made hard gates.

| Exact observed check-run name | Source | Current status | Reason / qualification |
|---|---|---|---|
| `Analyze (javascript-typescript)` | `CodeQL Advanced` workflow in `codeql.yml` | **Required** (Q6) | Runs on pull requests to `main`; successful on PR #55, on the merge commit, and on `main` at `39be4554` |
| `Codacy Security Scan` | `codacy.yml` workflow | **Required** (Q7) | Runs on pull requests to `main`; successful on PR #55, on the merge commit, and on `main` at `39be4554` |
| `dependency-review` | `dependency-review.yml` workflow | **Required** (Q8) | Runs on pull requests to `main`; successful on PR #55. Pull-request trigger only — it does not run on a push or merge to `main` |
| `Website CI` / its actual job check | `ci.yml` | **Not required** (Q9) | Path filters mean it may be absent on docs-only PRs. First adjust its reporting design in a separate reviewed change, or implement a stable always-running gate |
| `SonarCloud Code Analysis` | SonarQube Cloud GitHub App | Advisory (Q10) | Seen on PR #55 and on `main` at `39be4554`; latest main report passed the quality gate but reported three new issues |
| `semgrep-cloud-platform/scan` | Semgrep app integration | Advisory (Q10) | Successful result observed on PR #55; repeatability across PR types has not been established |
| `security/snyk (shahid1995)` | Snyk commit-status context | Advisory (Q10) | Successful status observed on PR #55; classic status API reporting on the merge commit had no individual status entries |

Before choosing a required check, verify the **exact check-run context** in GitHub's selector for the target branch, not merely the workflow display name. Require only checks which are expected on every relevant pull request, reliably report success/failure, and cannot be silently skipped by path filters.

The Website CI path-filter issue should be handled as its own scoped change before Website CI becomes a required check. This policy does not authorise modifying that workflow as part of the ruleset implementation.

## 8. Approval, administrator enforcement, and bypass

The operating model currently has a single Founder with final authority. GitHub does not treat the author's own approval as an independent review, so requiring one approval by default could make routine work impossible without producing a genuine independent reviewer.

Founder-approved initial policy:

- Require a PR, but set the minimum independent approval count to zero for now.
- Apply the PR and required-check rules to the repository owner/admin where the selected mechanism allows that choice.
- Leave the bypass list empty initially.
- Do not create fictional reviewers, teams, or bots to satisfy an approval requirement.
- If another trusted independent reviewer is added in the future, consider requiring one approval, dismissing stale approvals on new commits, and requiring approval of the latest push.
- Remember that the repository owner may retain the ultimate administrative ability to change or remove settings. Rules are an enforced control within GitHub's permission model, not a replacement for Founder governance and audit trails.

## 9. Other safeguards evaluated

- **Force pushes:** block them on `main`.
- **Branch deletion:** block deletion of `main`.
- **Conversation resolution:** require open PR review conversations to be resolved before merge.
- **Up-to-date branches:** defer initially. Revisit after the required-check set is reliable and concurrent PRs create meaningful stale-base risk; strict freshness can require repeated CI runs and create avoidable friction in a single-Founder workflow.
- **Linear history:** defer. The repository currently allows merge commits, rebase, and squash. If linear history is desired, explicitly decide whether to disable merge commits and use squash or rebase, rather than enabling a rule without aligning merge-method settings.
- **Signed commits:** defer until the Founder has verified a sustainable signing setup for local commits and any relevant automation.
- **Merge queue / deployment requirements:** not recommended now. No evidence in this scope establishes sufficient concurrency or an authorized staging-deployment gate.
- **Secret scanning and runtime API security:** separate controls and workstreams; do not conflate them with branch protection.

## 10. Activation checklist (Founder approval recorded; configuration applied and re-read)

Before anyone enables settings (the settings have since been applied; each item below reflects its verification state, and items that are still open are left unchecked):

- [x] Founder approved one repository ruleset targeting `main`, subject to confirmation that the needed controls are available in the repository's GitHub plan and settings UI.
- [x] Re-fetch current `main` SHA and verify this proposal is still based on an appropriate current state. Verified: `main` is at `39be4554c871c9341b979124f9371e2f99b28a19` (merge commit of PR #56), the commit that carried this policy record onto `main`.
- [x] Open GitHub repository settings in a write-authorised account and verify current branch protection and rulesets directly; capture the configuration state for the audit record. Verified from the live rulesets and branch endpoints — see §3.4.
- [x] Confirm the rule targets exactly `main`, with no unintended branch pattern. Verified: `include: ["refs/heads/main"]`, `exclude: []`, and exactly one ruleset exists in the repository.
- [x] Confirm the PR requirement applies to administrators/owner or explicitly document the approved exception. Verified: the ruleset defines a `pull_request` rule with no bypass actor, and `main` reports `protected: true`. See the bypass-evidence limit in §3.4 and §14.
- [x] Confirm the bypass list is empty unless the Founder has separately approved a named, justified exception. Verified by the earlier admin-permission observation recorded in Issue #57; **not** independently re-confirmable from the public API in this pass. Tracked in §14.
- [x] On representative recent PRs, confirm each selected required context has its intended exact name and reliably completes. Verified: the exact contexts in §3.4 match the observed check-run names, and all three completed successfully on PR #55, on the merge commit, and on `main` at `39be4554`.
- [ ] Resolve the Website CI path-filter/reporting issue before considering it required. **Still open** — `Website CI` is not required and no workflow change has been made.
- [x] Decide approval count, conversation resolution, branch freshness, deletion/force-push, and linear-history choices. Verified live: zero approvals, conversation resolution on, branch freshness off, deletion and force-push blocked, linear history off, signed commits and merge queue absent.
- [ ] If an evaluation-only enforcement mode is available, use it first and review reported violations before activating blocking enforcement. **Superseded** — the ruleset was activated directly; no evaluation-mode report exists to review. Recorded here as a fact, not an outstanding recommendation.
- [x] Record the exact ruleset/rule values, activation time, authorising Founder decision, and rollback procedure. Ruleset `25555806`, `protect-main-founder-approved`, created `2026-10-21T14:52:05.876Z`, updated `2026-10-21T14:53:13.794Z`; full rule table in §3.4; rollback in §12.
- [x] Do not deploy or change provider settings; branch protection is a repository governance change only. No deployment, provider change, or application change was made.
- [x] Demonstrate enforcement behaviour with a controlled pull request (see §11). **Done** — see §11.1. A pending required check was shown to cause GitHub to refuse the merge, and a pull request missing a required context was shown to be reported `blocked`. The deliberately-failing-check variant remains untested (§14).

The configuration items above are supported by live evidence, and the enforcement item is supported by the controlled pull-request record in §11.1. Statements in this document describing enforcement as verified are limited to the conditions actually observed.

## 11. Post-activation verification plan and record

After actual activation:

1. Re-read the live rule/ruleset and confirm it targets `main`, has the agreed enforcement status, required checks, approval count, and bypass configuration. **Done** — see §3.4.
2. Create a controlled documentation-only PR and confirm the selected required checks are present and completed. This is especially important for path-filter behaviour. **Done** — PR #58, a documentation-only change, reported all three required contexts and completed them successfully. See §11.1.
3. Create a controlled PR that changes website source in a separately authorised change and confirm Website CI runs if/when it becomes a required check. **Not performed** — out of scope for the current pass; `Website CI` is not a required check.
4. Confirm an intentionally incomplete test PR cannot be merged while a required check is missing or failed. Do not merge the test PR. **Done for the pending and missing cases; not for the failing case** — see §11.1. A pending required check was refused by GitHub with an explicit rule-violation message, and a pull request whose head is missing a required context is reported `blocked`. A deliberately *failing* required check was **not** introduced; creating an artificial failure or altering the required-check list was not authorised, so that one variant remains untested.
5. Never test direct-push blocking by attempting a push to the production `main` branch. If proof of rejection is needed, use a separately authorised disposable branch/ruleset with equivalent controls. **Respected** — no push to `main` was attempted at any point.
6. Record observed outcomes, GitHub URLs, any skipped check, and any mismatch between the Checks API and classic status API. **Done** — see §11.1 and §14. No required context was skipped on the test pull request. The mismatch noted at proposal time still stands: the classic status endpoint reports `pending` with no status contexts while the Check Runs API shows the three runs completed successfully.
7. Re-fetch the main branch and active rules/rulesets after testing to confirm no unintended branch or repository changes occurred. **Done** — the ruleset was re-read after the controlled test and was unchanged (`updated_at` still `2026-10-21T14:53:13.794Z`), still the only ruleset, still targeting `refs/heads/main`; `main` is still at `39be4554c871c9341b979124f9371e2f99b28a19`, and no pull request was merged.

### 11.1 Controlled enforcement test — record

**Test design.** A documentation-only, non-mergeable temporary artifact was added on an isolated branch based on the freshly verified `main` SHA, so that a pull request against `main` could be observed while the three required contexts were pending, and then a merge could be attempted and observed to be refused.

| Item | Value |
|---|---|
| Test branch | `test/ruleset-enforcement-2026-10-21` |
| Branch base | `origin/main` at `39be4554c871c9341b979124f9371e2f99b28a19` |
| Head SHAs used | `4ed472edac5f16b2e570fd0f7787353014761c12` (first push), then `511826d0cd9aff7291d5c577131f2ed3d6a558d5` (second push, used for the merge attempt) |
| Only changed file | `docs/decisions/2026-10-21-main-ruleset-enforcement-test.md` — a temporary, clearly labelled artifact with no secrets, no customer data, no business or policy claims, and no application change |
| Diff vs `main` | Documentation only, 1 file added, 0 deletions, no application, workflow, or configuration file touched |
| Test pull request | [PR #58](https://github.com/shahid1995/freelance-web-business/pull/58) — opened, then **closed without merging** (`state: closed`, `merged: false`, `closed_at: 2026-10-21T17:01:02Z`) |
| Merge performed | **No.** Exactly one merge attempt was made, and it was refused. The pull request was closed unmerged, as the plan required |
| Test branch disposition | Left in place, with the evidence comment on PR #58, so the record stays inspectable. The branch and its artifact are safe to delete; the artifact must never be merged |

**Result: enforcement confirmed for the pending and missing conditions.**

**1. A pending required check blocks the merge (decisive).** One merge attempt was made while the required checks were in flight, on head SHA `511826d0cd9aff7291d5c577131f2ed3d6a558d5`. GitHub refused it with an explicit rule-violation message:

```
Cannot merge PR #58 in shahid1995/freelance-web-business: Repository rule violations found

2 of 3 required status checks are in progress.
```

At that moment `Analyze (javascript-typescript)` and `Codacy Security Scan` were both `in_progress` and `dependency-review` had reported `success`. The refusal names the rule violation and counts the pending required checks, and the pull request was not merged.

**2. Merge state tracks the required contexts.** Observed on PR #58:

| Observed | `mergeable_state` | Required-check condition at that moment |
|---|---|---|
| ~14 s after creation | `blocked` | `Analyze (javascript-typescript)` and `Codacy Security Scan` in progress, `dependency-review` passed |
| mid-run | `unstable` | `Analyze (javascript-typescript)` and `dependency-review` passed, `Codacy Security Scan` still running, several non-required checks also in flight |
| after all three required contexts reported `success` | `clean` | all three required contexts passed |

`mergeable_state` is GitHub's advisory summary field and is computed asynchronously, so the first row is the merge-blocked signal and the explicit refusal in point 1 is the authoritative evidence.

**3. A missing required context also blocks the merge.** The pre-existing pull request [PR #53](https://github.com/shahid1995/freelance-web-business/pull/53) has head SHA `91fffbeb08c5a6b24834442bb4c1c1b5726a6cb7`, which predates `.github/workflows/codacy.yml` and therefore carries `Codacy Static Code Analysis` (a different app) rather than the required `Codacy Security Scan` context. GitHub reports it as `mergeable: true`, `mergeable_state: "blocked"`, `merged: false` — blocked by the same ruleset, with no merge attempted on it.

**4. The configuration is live and singular.** `GET /repos/shahid1995/freelance-web-business/rulesets` returns exactly one ruleset, and `GET /repos/shahid1995/freelance-web-business/rules/branches/main` shows GitHub evaluating all four of its rules against `main`.

**What remains untested.** A required check that *fails* was not exercised, and direct-push rejection was not tested by design. Both are recorded as limitations in §14.

## 12. Rollback plan

Rollback is also a settings change and therefore requires separate Founder authorisation. **No rollback has been performed, and none is authorised by this document.**

The concrete object to roll back is repository ruleset `25555806` (`protect-main-founder-approved`), which is the only ruleset in the repository. The classic branch-protection object for `main` is already `enabled: false` with no required contexts, so there is no second control to restore.

If a policy blocks legitimate work:

1. Identify the exact blocking rule/check and preserve its run URL and error text.
2. Determine whether the cause is an incorrect context name, an expected path-filtered job, a true failed check, a branch that is behind, or a permission/bypass mismatch.
3. Prefer fixing the workflow/check reporting in a separate reviewed PR over weakening unrelated safeguards.
4. If rollback is necessary, the Founder or explicitly authorised administrator may switch ruleset `25555806` to a non-enforcing state or delete it, as supported by GitHub. Record the previous and new values and the reason. The recorded pre-rollback values are in §3.4 and must be captured before any change.
5. Re-enable enforcement only after the failed condition is understood and verification passes.

Rollback remains a separate settings change and requires explicit Founder authorisation.

## 13. Open Founder decisions (13)

The Founder approved the following decisions on 2026-10-21. These decisions authorise implementation, and the resulting configuration has since been applied and re-read live (§3.4). Approval and activation are recorded facts; demonstrated enforcement behaviour is recorded separately in §11.1.

| ID | Decision | Founder-approved decision | Why / condition |
|---|---|---|---|
| Q1 | Protection mechanism | One repository ruleset | Clear visibility and flexible enforcement; confirm feature availability and settings UI |
| Q2 | Branch scope | Exact `main` only | Minimise accidental impact on topic branches |
| Q3 | PR requirement | Required | Preserve reviewable change history and prevent routine direct updates |
| Q4 | Admin/owner applicability and bypass | Apply the rules to owner/admin; no bypass actor | Preserve enforcement and avoid silent exceptions; confirm the UI's exact semantics |
| Q5 | Minimum independent approvals | Zero initially | Single-Founder model; revisit if an independent reviewer becomes available |
| Q6 | CodeQL check | Require `Analyze (javascript-typescript)` after fresh selector verification | Repeated success observed on the current PR head and merge commit |
| Q7 | Codacy check | Require `Codacy Security Scan` after fresh selector verification | Repeated success observed on the current PR head and merge commit |
| Q8 | Dependency review | Require `dependency-review` after fresh selector verification | Runs on PRs to `main`; successful on PR #55 |
| Q9 | Website CI | Do not require until its path-filtered reporting is fixed | Avoid an absent required check on docs-only PRs |
| Q10 | SonarCloud, Semgrep, Snyk checks | Advisory initially | Confirm repeatable availability and investigate status-context differences before making these hard gates |
| Q11 | Branch must be up to date | Off initially | Avoid repeated CI friction until concurrent development makes strict freshness worthwhile |
| Q12 | Conversation resolution, stale approvals, signed commits | Require conversation resolution; defer stale-approval and signing rules | Resolution is low friction; approvals and signing need a real independent reviewer and tested signing process |
| Q13 | Force-push/deletion and linear history | Block force pushes and deletion; defer linear history | Preserve `main`; decide merge-method changes separately |

The Founder approval record above authorises implementation of this policy, and the implementation has since been applied and re-read live as ruleset `25555806`. Merging this document was not evidence that settings are active; the live re-read in §3.4 is. Enforcement behaviour is separately evidenced in §11.1.

## 14. Evidence, references, and limitations

### Repository evidence

- [Current main merge commit](https://github.com/shahid1995/freelance-web-business/commit/39be4554c871c9341b979124f9371e2f99b28a19) — `main` at `39be4554c871c9341b979124f9371e2f99b28a19`
- [Policy approval PR #56](https://github.com/shahid1995/freelance-web-business/pull/56) — merged, merge commit `39be4554c871c9341b979124f9371e2f99b28a19`
- [Live ruleset 25555806](https://github.com/shahid1995/freelance-web-business/rules/25555806)
- [Tracking issue #57](https://github.com/shahid1995/freelance-web-business/issues/57)
- [Controlled enforcement test PR #58](https://github.com/shahid1995/freelance-web-business/pull/58) — closed without merging; the evidence comment on it records the merge refusal
- [Rules branch evaluation endpoint](https://api.github.com/repos/shahid1995/freelance-web-business/rules/branches/main)
- [Scanner retirement decision](2026-10-21-scanner-workflow-retirement.md)
- [Website CI workflow](../../.github/workflows/ci.yml)
- [CodeQL Advanced workflow](../../.github/workflows/codeql.yml)
- [Codacy Security Scan workflow](../../.github/workflows/codacy.yml)
- [Dependency Review workflow](../../.github/workflows/dependency-review.yml)
- [GitHub checks on the scanner-retirement PR](https://github.com/shahid1995/freelance-web-business/pull/55)
- [Repository rulesets endpoint](https://api.github.com/repos/shahid1995/freelance-web-business/rulesets)
- [Live ruleset detail endpoint](https://api.github.com/repos/shahid1995/freelance-web-business/rulesets/25555806)
- [CodeQL run on `main` at `39be4554`](https://github.com/shahid1995/freelance-web-business/actions/runs/39618314693/job/119284805672)
- [Codacy run on `main` at `39be4554`](https://github.com/shahid1995/freelance-web-business/actions/runs/39618314512/job/119284803707)
- [SonarCloud run on `main` at `39be4554`](https://github.com/shahid1995/freelance-web-business/runs/119290389197)

### GitHub documentation

- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [Managing a branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)

### Limitations

**Configuration verification (re-read 2026-10-21).** The live ruleset detail, the repository rulesets list, the `main` branch object, the `main` commit, and the check runs on `main` were all read directly from the GitHub REST API. The dedicated classic branch-protection detail endpoint (`/branches/main/protection`) requires authentication and was not readable; the classic protection state was instead read from the branch object's `protection` subobject, which reported `enabled: false`.

**Not independently re-confirmable in this pass.** The ruleset response available to this verification omitted the `bypass_actors` field, so the empty bypass list and `current_user_can_bypass: never` are carried forward from the earlier admin-permission observation recorded in Issue #57 rather than re-confirmed here. This is stated as a limitation, not as a fresh verification.

**Enforcement demonstrated, with a stated scope.** See §11.1. The ruleset reports `active`, and merge-blocking behaviour was then observed directly rather than inferred. GitHub refused a merge of the test pull request while required contexts were pending ("Repository rule violations found — 2 of 3 required status checks are in progress"), and a pre-existing pull request whose head commit lacks the required `Codacy Security Scan` context is reported `mergeable_state: "blocked"`. The deliberately-failing-check variant was not exercised.

**Deliberately untested conditions.** No deliberately failing required check was introduced, so the "a required check that *fails* blocks the merge" condition is untested; the *pending* and *missing* conditions are tested and recorded in §11.1. No direct push to `main` was attempted, so direct-push rejection is untested by design. `Website CI` path-filter behaviour was not exercised, and `Website CI` is not a required check. The pull-request requirement was not tested by attempting a direct update to `main` (§6).

**Scope of the check inventory.** The successful checks on PR #55, on the merge commit, and on `main` at `39be4554` do not constitute runtime API security testing or prove that every external app check will always run. The classic status endpoint's `pending` state with no status contexts must be distinguished from the separately successful Check Runs API results. The `dependency-review` context is produced only on pull requests, so a push or merge to `main` will never carry all three required contexts.

**Final state:** APPROVED — CONFIGURATION ACTIVE AND VERIFIED — ENFORCEMENT VERIFIED. The policy is approved, the Founder has authorised implementation, and the configuration is live and independently re-read as repository ruleset `25555806` (`protect-main-founder-approved`), active on `refs/heads/main` with the three approved required contexts. Merge-blocking behaviour was then demonstrated on separate pull requests: a pending required check caused GitHub to refuse the merge with an explicit rule-violation message, and a pull request missing a required context is reported `blocked` (§11.1). No pull request was merged, no direct push to `main` was made, no workflow, application source, deployment, or production data has been changed, and the ruleset was neither modified nor duplicated during this verification.
