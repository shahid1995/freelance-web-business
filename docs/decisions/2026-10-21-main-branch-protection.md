# Main Branch Protection Policy and Activation Plan

**Status:** APPROVED — IMPLEMENTATION AUTHORISED — NOT ACTIVE  
**Owner:** Founder  
**Date:** 2026-10-21  
**Scope:** Repository governance for the `main` branch only

> Founder approval was given on 2026-10-21 for the recommended starting policy below and for implementation of the main-only protection rules. This document records that approval. The live ruleset has not been created or activated; activation is complete only after the settings are applied and independently verified.

## 1. Purpose and authority

This proposal defines a minimum, practical protection policy for `main` in the public repository `shahid1995/freelance-web-business`.

The Founder remains the final authority. GitHub is the sole system of record. The Founder has approved the recommended starting decisions in §5 and §13 and authorised implementation. Actual configuration must still pass the activation-time checks below; no setting may be reported active until live verification confirms it.

The relevant governing documents are [the Constitution](../../CONSTITUTION.md), [Governance](../governance.md), and the [repository and documentation conventions](../conventions/repository-and-documentation.md).

## 2. Context and risk

The repository recently experienced an accidental payment-configuration merge into `main`, requiring a path-scoped rollback. See [the scanner-retirement decision](2026-10-21-scanner-workflow-retirement.md) for the relevant incident context and the workflow-retirement follow-up.

That incident does not prove branch protection alone would have prevented every error, but it demonstrates the need for stronger default integration controls and a reliable review trail.

The intended safeguards are to make ordinary changes reach `main` through pull requests, prevent force-push and branch-deletion accidents, and require a small set of trustworthy automated checks without creating a policy that silently blocks documentation-only work.

## 3. Current verified state

The latest live checks performed for this proposal observed:

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

## 4. Options considered

### Option A — Leave `main` unprotected

Rejected as the default recommendation. It leaves no server-side enforcement that routine changes must use a pull request and no configured required status checks.

### Option B — Classic branch protection rule

Viable for a single repository and straightforward for standard settings. It can enforce pull requests, required checks, and restrictions such as force-push prevention. GitHub documents its behaviour in [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

### Option C — One repository ruleset targeting `main`

**Recommended for Founder consideration.** Rulesets are visible to readers, can be put into different enforcement states where supported, and can be layered without relying on a single matching classic branch-protection rule. Current repository metadata showed no rulesets. See [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) and [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

Choose either Option B or C for the first implementation; do not configure both redundantly. The recommendation is a single ruleset targeting only `main`, subject to confirmation that the required controls are available in this repository's GitHub plan and account UI.

## 5. Recommended minimum policy

The Founder-approved minimum policy is:

1. Target only the exact `main` branch.
2. Require a pull request before merging.
3. Do not add a bypass actor or administrator bypass exception in the initial policy; confirm the selected GitHub mechanism enforces the rule for the repository owner/admin as intended.
4. Initially require the three candidate checks listed in §7 only after the check-name and reliable-run preflight is reconfirmed on representative PRs. If any selected context is missing, ambiguous, skipped, or unreliable, do not activate the rule until resolved.
5. Require all review conversations to be resolved before merge.
6. Explicitly block force pushes and branch deletion.
7. Do not require an independent approval in the current single-Founder model. Revisit that decision if a genuine independent reviewer becomes available.
8. Initially leave strict up-to-date-branch enforcement and linear-history enforcement off; decide separately after check reliability and merge-method policy are confirmed.

This policy creates a PR trail without pretending that a lone Founder can supply an independent approval. It also avoids turning an external integration that has only been observed on a limited sample into a hard gate.

## 6. Pull-request requirement

Routine changes should be made on an isolated topic branch and proposed to `main` through a pull request, consistent with [repository conventions](../conventions/repository-and-documentation.md).

The proposed rule should reject ordinary direct updates to `main`, subject to the chosen mechanism's documented bypass behaviour. No bypass actors should be configured initially. Any emergency exception must require a separate explicit Founder decision, a recorded reason, and subsequent review of the resulting commit.

Do not validate the rule by attempting a direct push to `main`. Use the settings UI/API for read-only verification and, if needed, a separately authorised disposable test branch for enforcement testing.

## 7. Required status checks: exact candidates and limits

The approved candidate list below is based on observed check-run names and workflow definitions. These checks are not yet required on `main`; the exact contexts must still be selected and verified during activation.

| Exact observed check-run name | Source | Recommendation | Reason / qualification |
|---|---|---|---|
| `Analyze (javascript-typescript)` | `CodeQL Advanced` workflow in `codeql.yml` | Candidate for required | Runs on pull requests to `main`; observed successful on PR #55 and on the merge commit |
| `Codacy Security Scan` | `codacy.yml` workflow | Candidate for required | Runs on pull requests to `main`; observed successful on PR #55 and on the merge commit |
| `dependency-review` | `dependency-review.yml` workflow | Candidate for required | Runs on pull requests to `main`; observed successful on PR #55; it is a PR check, not expected to run on a normal push to `main` |
| `Website CI` / its actual job check | `ci.yml` | **Do not require yet** | Path filters mean it may be absent on docs-only PRs. First adjust its reporting design in a separate reviewed change, or implement a stable always-running gate |
| `SonarCloud Code Analysis` | SonarQube Cloud GitHub App | Advisory until further verified | Seen on PR #55 and the merge commit; latest main report passed the quality gate but reported three new issues |
| `semgrep-cloud-platform/scan` | Semgrep app integration | Advisory until further verified | Successful result observed on PR #55; repeatability across PR types has not been established |
| `security/snyk (shahid1995)` | Snyk commit-status context | Advisory until further verified | Successful status observed on PR #55; classic status API reporting on the merge commit had no individual status entries |

Before choosing a required check, verify the **exact check-run context** in GitHub's selector for the target branch, not merely the workflow display name. Require only checks which are expected on every relevant pull request, reliably report success/failure, and cannot be silently skipped by path filters.

The Website CI path-filter issue should be handled as its own scoped change before Website CI becomes a required check. This proposal must not modify that workflow.

## 8. Approval, administrator enforcement, and bypass

The operating model currently has a single Founder with final authority. GitHub does not treat the author's own approval as an independent review, so requiring one approval by default could make routine work impossible without producing a genuine independent reviewer.

Recommended initial policy:

- Require a PR, but set the minimum independent approval count to zero for now.
- Apply the PR and required-check rules to the repository owner/admin where the selected mechanism allows that choice.
- Leave the bypass list empty initially.
- Do not create fictional reviewers, teams, or bots to satisfy an approval requirement.
- If another trusted independent reviewer is added in the future, consider requiring one approval, dismissing stale approvals on new commits, and requiring approval of the latest push.
- Remember that the repository owner may retain the ultimate administrative ability to change or remove settings. Rules are an enforced control within GitHub's permission model, not a replacement for Founder governance and audit trails.

## 9. Other safeguards evaluated

- **Force pushes:** recommend blocking them on `main`.
- **Branch deletion:** recommend blocking deletion of `main`.
- **Conversation resolution:** recommend requiring open PR review conversations to be resolved before merge.
- **Up-to-date branches:** defer initially. Revisit after the required-check set is reliable and concurrent PRs create meaningful stale-base risk; strict freshness can require repeated CI runs and create avoidable friction in a single-Founder workflow.
- **Linear history:** defer. The repository currently allows merge commits, rebase, and squash. If linear history is desired, explicitly decide whether to disable merge commits and use squash or rebase, rather than enabling a rule without aligning merge-method settings.
- **Signed commits:** defer until the Founder has verified a sustainable signing setup for local commits and any relevant automation.
- **Merge queue / deployment requirements:** not recommended now. No evidence in this scope establishes sufficient concurrency or an authorized staging-deployment gate.
- **Secret scanning and runtime API security:** separate controls and workstreams; do not conflate them with branch protection.

## 10. Activation checklist (Founder approval recorded; settings still inactive)

Before anyone enables settings:

- [x] Founder approved one repository ruleset targeting `main`, subject to confirmation that the needed controls are available in the repository's GitHub plan and settings UI.
- [ ] Re-fetch current `main` SHA and verify this proposal is still based on an appropriate current state.
- [ ] Open GitHub repository settings in a write-authorised account and verify current branch protection and rulesets directly; capture the configuration state for the audit record.
- [ ] Confirm the rule targets exactly `main`, with no unintended branch pattern.
- [ ] Confirm the PR requirement applies to administrators/owner or explicitly document the approved exception.
- [ ] Confirm the bypass list is empty unless the Founder has separately approved a named, justified exception.
- [ ] On representative recent PRs, confirm each selected required context has its intended exact name and reliably completes.
- [ ] Resolve the Website CI path-filter/reporting issue before considering it required.
- [ ] Decide approval count, conversation resolution, branch freshness, deletion/force-push, and linear-history choices.
- [ ] If an evaluation-only enforcement mode is available, use it first and review reported violations before activating blocking enforcement.
- [ ] Record the exact ruleset/rule values, activation time, authorising Founder decision, and rollback procedure.
- [ ] Do not deploy or change provider settings; branch protection is a repository governance change only.

Founder approval is recorded above. The remaining live-configuration and post-activation verification items must stay incomplete until they are actually performed and evidenced.

## 11. Post-activation verification plan

Only after separate approval and actual activation:

1. Re-read the live rule/ruleset and confirm it targets `main`, has the agreed enforcement status, required checks, approval count, and bypass configuration.
2. Create a controlled documentation-only PR and confirm the selected required checks are present and completed. This is especially important for path-filter behaviour.
3. Create a controlled PR that changes website source in a separately authorised change and confirm Website CI runs if/when it becomes a required check.
4. Confirm an intentionally incomplete test PR cannot be merged while a required check is missing or failed. Do not merge the test PR.
5. Never test direct-push blocking by attempting a push to the production `main` branch. If proof of rejection is needed, use a separately authorised disposable branch/ruleset with equivalent controls.
6. Record observed outcomes, GitHub URLs, any skipped check, and any mismatch between the Checks API and classic status API.
7. Re-fetch the main branch and active rules/rulesets after testing to confirm no unintended branch or repository changes occurred.

## 12. Rollback plan

Rollback is also a settings change and therefore requires separate Founder authorisation.

If a policy blocks legitimate work:

1. Identify the exact blocking rule/check and preserve its run URL and error text.
2. Determine whether the cause is an incorrect context name, an expected path-filtered job, a true failed check, a branch that is behind, or a permission/bypass mismatch.
3. Prefer fixing the workflow/check reporting in a separate reviewed PR over weakening unrelated safeguards.
4. If rollback is necessary, the Founder or explicitly authorised administrator may switch the ruleset to a non-enforcing state or restore the prior branch rule as supported by GitHub. Record the previous and new values and the reason.
5. Re-enable enforcement only after the failed condition is understood and verification passes.

No rollback or live setting change is authorised by this proposal.

## 13. Open Founder decisions (13)

The Founder approved the following decisions on 2026-10-21. These decisions authorise implementation, but do not prove that any GitHub setting is active.

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

Founder answers should be recorded in GitHub before activation. A future implementation PR must not infer approval merely because this proposal is merged.

## 14. Evidence, references, and limitations

### Repository evidence

- [Current main merge commit](https://github.com/shahid1995/freelance-web-business/commit/1b2e12484542923d5124839c81800fe6202bd88c)
- [Scanner retirement decision](2026-10-21-scanner-workflow-retirement.md)
- [Website CI workflow](../../.github/workflows/ci.yml)
- [CodeQL Advanced workflow](../../.github/workflows/codeql.yml)
- [Codacy Security Scan workflow](../../.github/workflows/codacy.yml)
- [Dependency Review workflow](../../.github/workflows/dependency-review.yml)
- [GitHub checks on the scanner-retirement PR](https://github.com/shahid1995/freelance-web-business/pull/55)
- [Repository rulesets endpoint](https://api.github.com/repos/shahid1995/freelance-web-business/rulesets)

### GitHub documentation

- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [Managing a branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)

### Limitations

This proposal is based on repository files and GitHub metadata/check-run evidence available at preparation time. The current branch object reports `main` as not protected and the rulesets endpoint returned an empty list, but the dedicated branch-protection detail endpoint was inaccessible to the connected integration. The GitHub settings UI must be checked directly before activation. Required-check selection and enforcement have not been tested because no settings were changed.

The successful checks on PR #55 and its merge commit do not constitute runtime API security testing or prove that every external app check will always run. The classic status endpoint's `pending` state with no status contexts must be distinguished from the separately successful Check Runs API results. The exact status-check configuration remains an activation-time verification requirement.

**Final state:** APPROVED — IMPLEMENTATION AUTHORISED — NOT ACTIVE. The policy is approved, but no branch protection/ruleset settings have yet been changed. No workflow, application source, deployment, or production data has been changed.
