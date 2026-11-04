# Payment Slice 2 — Revised Proposal, Revision 3 (Documentation-Only)

## Revision Scope and Authority Statement

This document is the third corrective revision of the Payment Slice 2 proposal. Its **content** is documentation only: it modifies no application source, no tests, no migrations or schemas, no dependencies, no workflows, and no governance documents (`docs/decisions/2026-10-12-payments-project-activation.md`, `docs/project-map.md`, `CONSTITUTION.md`).

Its **publication** is a separate fact that must be stated rather than elided: this revision is published by committing this one Markdown file to branch `review/payment-slice-2-proposal-clean` and updating the existing Draft pull request #68. That publication created a branch, a commit, and a pull request. It created no implementation, no schema, no provider integration, and no deployment. Publishing documentation is not implementation authorization.

Revision 1 corrected the first round of architectural and governance defects. Revision 2 corrected a second round (identity layering, verification/conflict separation, the fake verifier, allocation concurrency, decimals, SQLite failure reporting). Revision 3 corrects a third round of findings that survived Revision 2, each of which was a *structural* defect rather than a wording defect:

- **A** — the canonical transaction key still contained `source_registration_id`, so the same provider funds movement could be accepted twice through two registrations or two projects.
- **B** — an unresolved observation was described as existing without a canonical transaction, while the schema required one; conflict membership used an `observation_ids` array.
- **C** — `verification_result.payment_transaction_id` and `payment_transaction.accepted_verification_id` formed a circular foreign-key dependency under immediate enforcement.
- **D** — the transaction's commercial baseline was stated as "none" in the record model while other sections assumed a configuration version.
- **E** — `verifier_kind`, `verified_by`, `verifier_reference`, `verified_at_source`, and `data_classification` were used by constraints without being defined in any table.
- **F** — "one active registration", "one open conflict", and "terminal supersession" were asserted, not enforced by any stored state, key, or concurrency rule.

Revision 3 replaces assertions with named constraints. Where a rule cannot be enforced by a database constraint, that is stated explicitly and classified as an application-level limitation.

Every recommendation below is a **proposed technical recommendation** or an **unresolved Founder decision**. Nothing here is a Founder-approved decision, and nothing here authorizes Slice 2A or Slice 2B implementation.

### Universal invariants

These hold everywhere in this document. Later sections reference them by number instead of restating them.

| # | Invariant |
|---|---|
| **I1** | No allocation may cause the sum of allocations applied to an obligation to exceed that obligation's expected amount. |
| **I2** | No allocation may cause the sum of allocations drawn from a transaction to exceed that transaction's accepted amount. |
| **I3** | Monetary values are exact decimal values with explicit scale. No floating-point parsing, no lexicographic comparison, no implicit rounding or conversion. |
| **I4** | Observations, verification results, accepted transactions, conflicts, resolutions, supersessions, allocations, and audit rows are append-only. Corrections are new records; nothing is edited or deleted. |
| **I5** | Project ownership is derived server-side from a trusted registration or an authorized project resolution. A caller-supplied identifier is never proof of access and never a source of project ownership. |
| **I6** | Audit rows are identifier-only and are committed in the same database transaction as the material write they describe. |
| **I7** | At most one canonical transaction exists per underlying provider funds movement — across every registration, every ingestion channel, and every project. Ingestion-channel identity never defines funds identity. |
| **I8** | An accepted transaction is permanently bound to the immutable configuration version captured with the observation that established it. A later configuration version never reinterprets an earlier transaction. |

---

## 1. Executive Summary and Revision Scope

Payment Slice 2 is the design for what a project owes and what has been paid, built on the already-approved provider-neutral design in `docs/decisions/2026-10-12-payments-project-activation.md`. That design is Founder-approved; its implementation is not, except for one limited initial slice whose approval status is itself contested between the canonical decision and the Project Map (§3.3).

This revision keeps the two-slice split:

- **Slice 2A — Verified Payment Evidence and Canonical Transaction Foundation.** Trusted provider-account identity, source registrations, observations, verification results, acceptance records, canonical transactions, correlation, conflicts, supersession, exact decimal handling, project isolation, identifier-only audit. Synthetic/test data only. No allocation, no obligation satisfaction.
- **Slice 2B — Allocation and Derived Financial Position.** Allocation requests, allocations, transaction-level and obligation-level ceilings, derived balances, compensating corrections, and a serialized allocation write contract.

The substantive corrections in Revision 3:

1. **Canonical transaction identity is provider-scoped, not channel-scoped (§4.3).** A new `provider_transaction_identity` relation holds the natural key `(provider_key, provider_environment, provider_account_reference, provider_transaction_reference)` under one global `UNIQUE` constraint; `payment_transaction.identity_id` is `NOT NULL UNIQUE`. A registration identifies how an observation arrived and appears nowhere in the funds identity.
2. **Observations exist before correlation, and conflict membership is a relation (§4.4, §5.3).** `payment_observation` has no transaction foreign key at all; correlation lives in `payment_transaction_observation`; conflict participation lives in `reconciliation_conflict_observation` with a composite primary key. The `observation_ids` array is deleted.
3. **The verification/transaction cycle is removed by a separate acceptance record (§5.2, §6.2).** Verification results reference only their observation. A `payment_transaction_acceptance` row references the transaction, the verification, that verification's observation, and the correlation row proving the observation belongs to that transaction. Insertion order is linear and immediate enforcement suffices; no deferred constraint is used.
4. **Commercial baseline binding is explicit and immutable (§5.4).** An observation captures the configuration version in force at ingestion, or is stored as explicitly unbound; a transaction copies that version and is `NOT NULL` bound; currency is tied to that version by a composite foreign key; a later version never reinterprets an earlier transaction.
5. **Verifier and classification fields are defined in the schema (§9).** `verifier_kind`, `verified_by`, `verifier_reference`, `verified_at_source`, and `data_classification` are columns of `verification_result`; `data_classification` is additionally a column of observations, transactions, and acceptance records, with composite foreign keys forcing agreement so a synthetic verification cannot accept a live transaction.
6. **Registration, conflict, and supersession lifecycles are enforced, not asserted (§8.3–§8.5).** A current-registration projection supplies the "at most one current" guarantee; a deterministic conflict key plus a unique constraint supplies conflict idempotency; a unique successor key plus a carried-timestamp ordering check supplies acyclic, branching-free supersession.
7. **The amount grammar no longer contains the undefined `signed` production (§10.1)**, and the audit allowlist is aligned with the final model (§8.6), removing the stale `evidence_id`.

Sections 14–16 consolidate the decision register, the acceptance-test matrix rebuilt around the corrected schema, and the cumulative correction record.

---

## 2. Canonical Decision and Authority Boundaries

The governing document is `docs/decisions/2026-10-12-payments-project-activation.md`. The boundaries this proposal must respect:

- **Resolved Founder decisions:** J.1 and J.2 (Founder sets amount and currency per project; no public pricing catalogue or automatic pricing; three initial schedule structures — full upfront, deposit plus later payments, milestone-linked), recorded 2026-10-16. J.13 (one payment configuration uses exactly one currency; no mixed-currency obligations; no automatic conversion), recorded 2026-10-20.
- **Unresolved:** J.3–J.12. These must not be decided by a proposal or by an implementation agent.
- **Not canonical at all:** J.14. The canonical register currently ends at J.13. §13 of this proposal presents J.14 as a *proposed new decision requiring separate Founder consideration and approval* before it becomes canonical.
- **Design approval is not implementation approval.** No sliver of this document authorizes real payment processing, provider selection or activation, credential configuration, live customer data, deployment, or project activation.
- **J.3 blocks evidence work.** The canonical register states J.3 blocks the payment-evidence/state-machine slice. Slice 2A therefore cannot be implemented on the strength of this proposal alone, even as a synthetic foundation; it requires J.3 resolution first. This proposal does not treat its own framework as J.3's answer.
- **J.10 is required whenever manual payment-status determination is proposed**, independently of which allocation policy is chosen. Revision 1 wrongly tied J.10 to J.14 Option D only; §13.4 corrects that.
- **No customer write capability.** Customers may read payment status through existing project-access authorization. They may never write payment state, upload evidence, or allocate funds.

---

## 3. Repository History, Baseline, and Governance Reconciliation

### 3.1 Verified facts

Each row was verified against the live repository during this revision.

| Fact | Evidence |
|---|---|
| PR #54 was merged into `main` | GitHub: `merged: true`, `merged_at 2026-10-20T14:48:12Z`, merge commit `51a796a7949cb375f59edbac51170ed2de1c02f0`, 7 files changed, +2260 / −6. |
| PR #54 delivered the limited initial Payment Configuration + Obligations slice | PR #54 title/body: Founder-only configuration versions, obligations for the three approved structures, atomic identifier-only audit, single-currency enforcement. Synthetic/test data only. |
| The implementation was subsequently rolled back from `main` | Rollback commit `a2e7b01533b69d7c13a62379421052bfe3aa3181`, subject `revert: remove accidentally merged payment configuration slice from main`. |
| The rollback commit is an ancestor of current `main` | `git merge-base --is-ancestor a2e7b01 origin/main` → true. |
| Current `main` contains no payment source code | `git ls-tree -r origin/main` matches exactly one payment path: the canonical decision document. No payment implementation, no payment tests. |
| Current `main` head | `6f74476c29b4dc02c37aa4936a21f844ef3db234`. |
| Restoration work is **local and unmerged** | Commit `f079be7ba31242f51f35caa5c42ebc01a8017982` (`fix(payments): verify the whole payment schema and close on failed startup`) exists only in a local worktree; no remote ref contains it. |
| The remote "restoration" branches contain **patch artifacts, not source** | `review/payment-restoration-f079be7-2026-11-02` (`827ca28`), `review/payment-restoration-final-2026-11-02` (`7ab911a`), and `review/payment-restoration-patch-2026-11-02` (`1330ecd`) each contain only `review-artifacts/*.patch` alongside the decision document. They are review artifacts, not restored application branches. |
| The original PR #54 branch still exists remotely | `feat/payments-config-obligations` at `51a796a`. |
| The repository's storage engine is SQLite through Node's built-in driver | `website/lib/platform/sqlite-store.ts` imports `DatabaseSync` from `node:sqlite`, sets `PRAGMA foreign_keys = ON` at open, enables WAL, and wraps multi-statement writes in `BEGIN IMMEDIATE` inside a `transaction()` helper. |
| Slice 2A and Slice 2B have no implementation authorization | No implementation branch, no merge, no deployment exists for either. |

The `node:sqlite` fact matters for this revision: every constraint mechanism named below was chosen because SQLite enforces it (unique indexes, check constraints, composite foreign keys against a declared parent key, and immediate foreign-key enforcement), and no mechanism relies on a feature SQLite does not provide. The one rule that SQLite cannot express as a check constraint — cross-row ordering — is expressed instead by carrying the compared values into the child row, so a composite foreign key proves they are genuine and a check constraint compares them. That technique is used for the acyclicity rules in §8.3 and §8.5.

### 3.2 The distinction that must not be collapsed

Five different things are routinely confused and are kept apart here:

1. **Design approval** (2026-10-16) — approved the model.
2. **Initial synthetic/test-only implementation approval** — approved the limited Payment Configuration + Obligations slice.
3. **Actual merge history** — PR #54 merged into `main` at `51a796a`.
4. **Rollback** — `a2e7b01` removed that implementation from `main`.
5. **Current source state** — `main` at `6f74476` contains the decision document and no payment implementation.

Restoring the rolled-back implementation is a **separate act requiring separate Founder authorization**. Nothing in this proposal treats restoration as implied by the earlier approval, and nothing here authorizes it. The restoration patch artifacts in the working tree are review material, not authorization and not a branch.

### 3.3 Governance-document inconsistency (unresolved, requires separate correction)

The canonical decision records that the initial Payment Configuration + Obligations slice **received separate implementation approval and was delivered by PR #54**. The Project Map (`docs/project-map.md`, payments paragraph) states that **implementation remains separately unapproved** and that such a slice "may be considered for separate implementation approval using synthetic/test data only". The Project Map also does not record the rollback or the J.13 decision.

This revision **records the contradiction and does not resolve it**. Resolving an approval-status contradiction is Founder authority, not an agent's. Neither document is edited here. The correction required is a separate Founder-authorized governance task that decides, in one place, what the current approval status of the initial slice is.

Consequence for this proposal: whenever this document says the initial slice "was approved", it means *the canonical decision records that approval*; whenever it says implementation is "unapproved", it means *the Project Map and the absence of any restoration authorization on `main` support that reading*. Both statements are reported as evidence of an open inconsistency, never as a resolved fact.

A second consequence is technical. The configuration tables this document relies on (`payment_configuration_version`, `payment_obligation`) are not present in `main`; they exist only in the rolled-back slice and in the local, unmerged restoration work. This proposal therefore states the *contract* those tables must satisfy — a configuration version belongs to exactly one project, has exactly one currency, and references exact proposal and agreement versions — and names the columns it depends on using this document's existing terminology. Where a constraint below references such a column, the constraint is a requirement on the restored schema, to be verified against it at implementation, not a claim about code that is currently in `main`.

---

## 4. Transaction Identity, Provider Scope, and Correlation

### 4.1 Why Revision 2's canonical key was still unsafe

Revision 1 used a delivery-scoped tuple as a global payment identity, which Revision 2 correctly identified as permitting double acceptance across channels. Revision 2's replacement key was:

```
canonical_transaction_key = (source_registration_id, provider_transaction_reference)
```

That is still channel-scoped, because a source registration is scoped to one project, one provider account binding, and one ingestion channel. Three failures follow directly:

1. **Two registrations, one transaction.** A webhook registration and a reconciliation registration are separate rows. The same provider charge observed through both yields two different keys, therefore two transactions and twice the funds — the exact defect Revision 2 claimed to have fixed, moved one level down.
2. **Two projects, one provider account.** Each project registers the same merchant account under its own registration. The same charge therefore has two valid keys in two projects. The document's claim that "cross-project collisions are rejected" is unenforceable, because the key never contains anything global to collide.
3. **Registration lifecycle leaks into money.** Since a registration is replaced by a superseding registration (§8.3), a transaction accepted under a retired registration has a key that a new registration cannot reproduce. Identity becomes a function of configuration history, which is exactly the coupling this section removes.

### 4.2 Seven identities, kept distinct

| Identity | What it identifies | Key | Where it lives | Scope |
|---|---|---|---|---|
| **Provider account identity** | A merchant/provider account as this system is configured to trust it | `provider_account_id` | `payment_provider_account` | One project (the account registration belongs to a project) |
| **Provider environment / namespace** | Which provider universe a reference belongs to | `environment` ∈ {`test`, `live`} | `payment_provider_account`, mirrored into the identity registry | Global per account |
| **Provider transaction reference** | The provider's own identifier for the funds movement | `provider_transaction_reference` | `provider_transaction_identity` | Global per account + environment |
| **Source registration identity** | How an observation is allowed to enter the system | `source_registration_id` | `payment_source_registration` | One project + account + channel |
| **Observation identity** | One incoming delivery | `(source_registration_id, delivery_reference)` | `payment_observation` | One registration |
| **Canonical transaction identity** | One underlying funds movement | `(provider_key, provider_environment, provider_account_reference, provider_transaction_reference)` | `provider_transaction_identity`, referenced by `payment_transaction.identity_id` | **Global** |
| **Project association** | Which project owns accepted funds | `project_id` | `payment_transaction` | One project per transaction |

The decisive structural rule: **`source_registration_id` does not appear in the canonical transaction identity, and `payment_transaction` has no `source_registration_id` column.** Channel identity cannot define funds identity if it is not part of the key and cannot be part of the row.

### 4.3 The enforceable canonical uniqueness rule

`provider_transaction_identity` is a global registry of funds movements:

```sql
UNIQUE (provider_key, provider_environment, provider_account_reference, provider_transaction_reference)
```

and the transaction references it exactly once:

```sql
payment_transaction.identity_id TEXT NOT NULL UNIQUE
  REFERENCES provider_transaction_identity(identity_id)
```

Why each element is in the tuple, and why this is consistent with the provider-neutral assumption:

- **`provider_key`** is an opaque string naming the provider implementation (`'fake_provider'` in Slice 2A). No provider is selected, named, or integrated; the value exists so that two providers' reference spaces cannot collide. This is exactly the "opaque provider references, provider-neutral evidence model" posture of J.8, not a provider choice.
- **`provider_environment`** separates `test` from `live` reference spaces. Provider contracts routinely reuse identifiers across environments; collapsing them would create false collisions in test and, worse, false matches in live.
- **`provider_account_reference`** is the provider's own merchant/account identifier, taken from server-side registration configuration. Using the provider's account reference rather than this system's `provider_account_id` is what makes the key global: two projects that register the same underlying account produce two `payment_provider_account` rows but one `provider_account_reference`, so their keys still collide. Using `provider_account_id` here would silently reintroduce per-project identity.
- **`provider_transaction_reference`** is the provider's reference to the funds movement, supplied by the provider.

The rule is stronger than "unique per account per project": it is unique globally. One provider funds movement, one canonical transaction, in one project, for the life of the system.

`payment_transaction.project_id` records ownership. Ownership is decided by the first accepted transaction for that identity and never transfers. A second project attempting to accept the same identity is refused by the unique constraint on `payment_transaction.identity_id`; it does not merge, inherit, or duplicate.

### 4.4 Observations, unresolved states, and the absence of a transaction link

`payment_observation` carries **no** transaction column. Not a nullable one — none. This is the structural answer to Finding B:

- An observation can be stored, read, and audited while no canonical transaction exists for it.
- Correlation is a separate record (`payment_transaction_observation`), so "uncorrelated" is the absence of a row, not a null in a mandatory relationship and not a sentinel value.
- An uncorrelated observation therefore cannot violate a mandatory foreign key, cannot require an invented transaction, and cannot be mistaken for accepted funds.

Observation minimum required fields: `observation_id`, `project_id` (derived from the registration, never supplied), `source_registration_id`, `delivery_reference`, `amount_text`, `amount_normalized`, `amount_scale`, `currency`, `config_binding_state`, `data_classification`, `received_at`. `provider_transaction_reference` is nullable because a delivery may not carry one; when it is present and the observation is verified, it is the value used to resolve or create the identity registry row.

Observation ingestion states, all representable without a transaction:

| `config_binding_state` | Meaning | Consequence |
|---|---|---|
| `bound` | Exactly one configuration version could be determined for the project at ingestion, with `payment_config_version_id` recorded. | May be verified and accepted. |
| `unbound_no_configuration` | The project has no configuration version. | Evidence retained; cannot pass verification; no transaction. |
| `unbound_ambiguous` | More than one candidate version could not be ordered deterministically. | Evidence retained; cannot pass verification; no transaction. |

A single `CHECK` keeps the version column and the state column consistent:

```sql
CHECK ((config_binding_state = 'bound') = (payment_config_version_id IS NOT NULL))
```

### 4.5 The correlation relation

`payment_transaction_observation` is an append-only relation with composite primary key `(observation_id, payment_transaction_id)` and `correlation_basis` ∈ {`provider_shared_reference`, `verified_mapping`}. There is no `unresolved` value: unresolved is the *absence* of a correlation row plus an open `unresolved_correlation` conflict naming the observations. Revision 2's `unresolved` value was self-contradictory — it required a transaction to link to in order to say that no transaction could be determined.

Rules:

1. Only correlate observations across source kinds when a trusted provider contract or an approved J.3 mapping establishes that they refer to the same funds movement.
2. Never merge observations because amounts, currency, or timestamps look similar. Amount equality is not identity (I3, §4.7).
3. A correlated duplicate observation is recorded (it is evidence of what the provider reported) but contributes **no additional funds**. Available funds are a property of the canonical transaction, not of the observation count.
4. A correlation row is never edited or deleted. A later, better-founded correlation is a new row; if it contradicts an earlier one, the contradiction is a conflict, not an update.
5. Slice 2A ships the table with the domain restricted to `provider_shared_reference`. `verified_mapping` requires a J.3 decision defining the mapping's authority, and adding the value is a later migration, not a runtime flag.

### 4.6 Behaviour for the required cases

| Case | Outcome | Mechanism |
|---|---|---|
| Same transaction via webhook **and** reconciliation import | One canonical transaction; two observations; both correlated `provider_shared_reference`; funds counted once | Identity registry unique key; correlations are relations, not funds |
| Same transaction via **two registrations** (same account, same channel or different channels) | One canonical transaction; both observations retained and correlated | Registration id is absent from the identity key |
| Same provider account associated with **two projects** | Second project's acceptance is **refused**; `rejected` verification recorded; `cross_project_collision` conflict raised in the refusing project; owner unaffected | Global unique key + `UNIQUE(payment_transaction.identity_id)` |
| Same provider reference with **conflicting project associations** | Same as above. No merge, no ownership transfer, no silent second acceptance | Same; plus project consistency composite keys |
| Two observations that appear to represent the same transaction but **cannot be safely correlated** | Observations retained; neither contributes funds; `unresolved_correlation` conflict naming both observations; blocks until an approved rule resolves it | Absence of correlation row + conflict membership relation |

For a `cross_project_collision`, the refusing project's conflict row carries only the identity tuple and its own observations. It does **not** carry the owning project's identifier: exposing it would leak cross-project information to a project that has no access to it. The collision is additionally reported on the internal operational channel (identifier-only, §11.3) so that the contested identity is visible to the Founder/ops without widening either project's read scope.

Different accounts that legitimately reuse the same reference stay distinct: `provider_account_reference` is part of the key, so the same `provider_transaction_reference` under two accounts is two identities and two transactions. That is the model's deliberate behaviour and matches provider contracts in which a reference is unique only within an account. If a future provider contract guarantees globally unique references, the tuple can only be *narrowed* by an explicit, reviewed migration — never silently widened.

### 4.7 Reported versus accepted

Two questions have two different answers, and both are preserved:

| Question | Authoritative record |
|---|---|
| What did the provider report? | `payment_observation` (immutable, verbatim normalized facts) |
| What has this system accepted as funds? | `payment_transaction` (immutable, accepted amount and currency) |

A conflict between them is never resolved by overwriting either record.

---

## 5. Relational Model, Column Definitions, and the Commercial Baseline

### 5.1 Record map

`C` = configuration/obligation records described by the rolled-back initial slice (§3.3); `2A` and `2B` mark the slice that owns the record.

| Record | Primary key | Foreign keys | Project ownership | Baseline | Immutability | Uniqueness | Authority |
|---|---|---|---|---|---|---|---|
| `payment_provider_account` (2A) | `provider_account_id` | `project_id` → `projects` | **Declares** the account for its project | none | Append-only | `UNIQUE(project_id, provider_key, environment, account_reference)` | Authoritative trusted account |
| `payment_source_registration` (2A) | `source_registration_id` | `project_id`; `provider_account_id`; `supersedes_registration_id` (self) | **Defines** ingestion trust for its channel | none | Append-only | History only — no scope uniqueness; `UNIQUE(supersedes_registration_id)`. The "one current" rule lives on the projection (§8.3) | Authoritative ingestion trust |
| `payment_source_registration_current` (2A) | `(project_id, provider_account_id, source_kind, source_namespace)` | `source_registration_id` → registration | Derived from its key | none | **Mutable projection** (§8.3) | Primary key *is* the "one current" rule | Derived, rebuildable, non-authoritative |
| `provider_transaction_identity` (2A) | `identity_id` | none (global registry) | none — project ownership lives on the transaction | none | Append-only | `UNIQUE(provider_key, provider_environment, provider_account_reference, provider_transaction_reference)` | Authoritative funds identity |
| `payment_observation` (2A) | `observation_id` | `source_registration_id` → registration; `payment_config_version_id` → configuration version; **no transaction FK** | Derived from registration | Records the version captured at ingestion | Immutable | `UNIQUE(source_registration_id, delivery_reference)` | Authoritative for "what the provider reported" |
| `verification_result` (2A) | `verification_id` | `observation_id` → observation; **no transaction FK** | Derived from observation | Inherits the observation's captured version | Immutable | Parent keys in §5.3 | Authoritative verification outcome |
| `payment_transaction` (2A) | `payment_transaction_id` | `identity_id` → identity registry; `provider_account_id`; `source_observation_id` → observation; `payment_config_version_id` → configuration version | `project_id`, derived, decided at creation | **Bound immutably** (`NOT NULL`) | Immutable | `UNIQUE(identity_id)`, `UNIQUE(source_observation_id)` | Authoritative for "what the system accepted as funds" |
| `payment_transaction_acceptance` (2A) | `acceptance_id` | `payment_transaction_id`; `verification_id`; `observation_id`; `(observation_id, payment_transaction_id)` → correlation | Derived | Carries the same version as both parents | Immutable | `UNIQUE(payment_transaction_id)`, `UNIQUE(verification_id)` | Authoritative acceptance decision |
| `payment_transaction_observation` (2A) | `(observation_id, payment_transaction_id)` | both parents | Derived | none | Immutable | Natural key | Derived correlation record |
| `reconciliation_conflict` (2A) | `conflict_id` | `project_id`; optional `payment_transaction_id`; optional `trigger_observation_id` | `project_id` | none | Immutable | `UNIQUE(project_id, conflict_key)` | Authoritative that a conflict exists |
| `reconciliation_conflict_observation` (2A) | `(conflict_id, observation_id)` | both parents | Derived | none | Immutable | Natural key | Derived membership |
| `conflict_resolution` (2A) | `resolution_id` | `conflict_id` | Derived | none | Immutable | `UNIQUE(conflict_id)` | Authoritative resolution |
| `verification_supersession` (2A) | `supersession_id` | superseded and superseding verification ids | `project_id` | none | Immutable | `UNIQUE(superseded_verification_id)` | Authoritative precedence |
| `payment_configuration_version` (C) | `payment_config_version_id` | `project_id`, `proposal_version_id`, `agreement_version_id` | `project_id` | **Is** the baseline anchor | Immutable version | `UNIQUE(project_id, version_number)`, `UNIQUE(payment_config_version_id, currency)`, `UNIQUE(payment_config_version_id, project_id)` | Authoritative commercial baseline |
| `payment_obligation` (C) | `obligation_id` | `payment_config_version_id` | via configuration | Member of exactly one configuration version | Immutable after issuance | Deterministic ordering within version | Authoritative expected amount and currency |
| `allocation_request` (2B) | `allocation_request_id` | `project_id`, `payment_transaction_id` | `project_id` | none | Immutable payload and recorded outcome | `UNIQUE(project_id, idempotency_key)` | Authoritative idempotency record |
| `allocation` (2B) | `allocation_id` | `payment_transaction_id`, `obligation_id`, `allocation_request_id`, `compensates_allocation_id` (nullable) | `project_id` | via transaction and obligation | Immutable; corrections are new records | Exactly one allocation per accepted request | Authoritative applied allocation |
| `audit_event` (existing) | `audit_event_id` | none (identifier metadata only) | `project_id` column, identifier-only | none | Append-only | n/a | Authoritative audit trail |

Derived, never stored as authoritative columns: obligation remaining balance, transaction unapplied funds, whether an obligation is satisfied, aggregate financial position, whether a transaction is blocked, and an obligation's state beyond `proposed`. Every such value is computed from immutable rows; any materialized view of it is rebuildable and explicitly non-authoritative.

### 5.2 Insertion order (no cycle, no deferred constraint)

The order below is legal under immediate foreign-key enforcement, which is what `node:sqlite` provides with `PRAGMA foreign_keys = ON` (already the repository's setting). No `DEFERRABLE` clause is required, and the design does not depend on one.

```
1. payment_provider_account
2. payment_source_registration            (+ payment_source_registration_current upsert)
3. payment_observation
4. verification_result
5. provider_transaction_identity
6. payment_transaction                    (reads observation from step 3 and identity from step 5)
7. payment_transaction_observation        (correlates the verifying observation, and any others)
8. payment_transaction_acceptance         (reads transaction, verification, and correlation)
```

Every arrow points backwards in this list. Revision 2's cycle existed because `verification_result.payment_transaction_id` pointed forward to a transaction that pointed back to a verification. In Revision 3 neither table references the other; the acceptance record is the only row that knows about both, and it is written last, after the correlation row that proves the two belong together.

Consequences worth stating explicitly:

- A failed verification needs no transaction and creates none (step 4 only).
- A transaction can exist before acceptance, but it is not "accepted funds" until its acceptance row exists; acceptance is what the derived position reads.
- A correlation can be recorded before acceptance, so the "verification belongs to this transaction" proof is itself stored data rather than an application assumption.

### 5.3 Column definitions

Every column of every table touched by this revision, with the constraint that makes it meaningful. `PK` = primary key, `FK` = foreign key, `CK` = check constraint, `UQ` = unique constraint. "Immutable" means no `UPDATE`/`DELETE` path exists (I4); the mutable projection is marked as such and justified in §8.3.

**`payment_provider_account`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `provider_account_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | FK → `projects(id)`; part of parent key `UQ(provider_account_id, project_id)` | yes |
| `provider_key` | TEXT | no | opaque provider implementation name; no provider selected (J.8) | yes |
| `environment` | TEXT | no | CK ∈ {`test`, `live`} | yes |
| `account_reference` | TEXT | no | provider's own account identifier, server-side configuration only | yes |
| `created_at` | TEXT | no | ISO-8601 UTC | yes |

Table constraints: `UQ(project_id, provider_key, environment, account_reference)`, `UQ(provider_account_id, project_id)`.

**`payment_source_registration`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `source_registration_id` | TEXT | no | PK; part of parent key `UQ(source_registration_id, project_id)` | yes |
| `project_id` | TEXT | no | FK → `projects(id)` | yes |
| `provider_account_id` | TEXT | no | FK → `payment_provider_account`; composite FK `(provider_account_id, project_id)` → `payment_provider_account(provider_account_id, project_id)` | yes |
| `source_kind` | TEXT | no | CK ∈ {`provider_webhook`, `provider_api_reconciliation`} | yes |
| `source_namespace` | TEXT | no | server-side value; no customer-supplied route | yes |
| `supersedes_registration_id` | TEXT | yes | FK → self; `UQ` (at most one successor) | yes |
| `supersedes_created_at` | TEXT | yes | carried parent timestamp; composite FK `(supersedes_registration_id, supersedes_created_at)` → `payment_source_registration(source_registration_id, created_at)` | yes |
| `created_at` | TEXT | no | part of parent key `UQ(source_registration_id, created_at)`; CK `(supersedes_registration_id IS NULL) OR (created_at > supersedes_created_at)` | yes |

Table constraints: `UQ(source_registration_id, created_at)`. There is deliberately **no** scope-level uniqueness on this table: successive registrations legitimately share a scope, and the "at most one current" rule belongs to the projection below.

**`payment_source_registration_current`** — projection, §8.3

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `project_id` | TEXT | no | PK part; FK → `projects` | no — projection |
| `provider_account_id` | TEXT | no | PK part; FK → `payment_provider_account` | no — projection |
| `source_kind` | TEXT | no | PK part | no — projection |
| `source_namespace` | TEXT | no | PK part | no — projection |
| `source_registration_id` | TEXT | no | UQ; FK → `payment_source_registration` | no — projection |
| `replaced_at` | TEXT | yes | set when the row is superseded | no — projection |

The primary key is the enforcement: at most one row can exist per `(project_id, provider_account_id, source_kind, source_namespace)`, so at most one current registration per scope, without depending on a partial index over a derived status.

**`provider_transaction_identity`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `identity_id` | TEXT | no | PK | yes |
| `provider_key` | TEXT | no | part of the natural key | yes |
| `provider_environment` | TEXT | no | CK ∈ {`test`, `live`}; part of the natural key | yes |
| `provider_account_reference` | TEXT | no | provider account identifier; part of the natural key | yes |
| `provider_transaction_reference` | TEXT | no | provider funds reference; part of the natural key | yes |
| `first_observed_at` | TEXT | no | | yes |

Table constraint: `UQ(provider_key, provider_environment, provider_account_reference, provider_transaction_reference)` — the global canonical uniqueness rule of I7. No `project_id` column exists here by design: project ownership is a property of the accepted transaction, not of the funds movement's identity.

**`payment_observation`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `observation_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | derived from registration; composite FK `(source_registration_id, project_id)` → `payment_source_registration(source_registration_id, project_id)`; part of parent keys `UQ(observation_id, project_id)`, `UQ(observation_id, payment_config_version_id)`, `UQ(observation_id, config_binding_state)`, `UQ(observation_id, data_classification)` | yes |
| `source_registration_id` | TEXT | no | FK → `payment_source_registration` | yes |
| `delivery_reference` | TEXT | no | provider delivery/observation identifier; `CK(delivery_reference <> '')` | yes |
| `provider_transaction_reference` | TEXT | yes | provider funds reference when the delivery carries one | yes |
| `amount_text` | TEXT | no | verbatim; `CK(amount_text <> '')` | yes |
| `amount_normalized` | TEXT | no | canonical form (§10.3) | yes |
| `amount_scale` | INTEGER | no | CK `0 ≤ amount_scale ≤ 6` | yes |
| `currency` | TEXT | no | CK `currency = UPPER(currency)` and `length(currency) = 3` | yes |
| `payment_config_version_id` | TEXT | yes | FK → `payment_configuration_version`; composite FK `(payment_config_version_id, currency)` → `payment_configuration_version(payment_config_version_id, currency)`; composite FK `(payment_config_version_id, project_id)` → `payment_configuration_version(payment_config_version_id, project_id)` | yes |
| `config_binding_state` | TEXT | no | CK ∈ {`bound`, `unbound_no_configuration`, `unbound_ambiguous`} | yes |
| `data_classification` | TEXT | no | CK ∈ {`synthetic`, `live`} | yes |
| `received_at` | TEXT | no | | yes |

Table constraints: `UQ(source_registration_id, delivery_reference)`, `UQ(observation_id, project_id)`, `UQ(observation_id, payment_config_version_id)`, `UQ(observation_id, config_binding_state)`, `UQ(observation_id, data_classification)`, and `CK((config_binding_state = 'bound') = (payment_config_version_id IS NOT NULL))`.

The currency composite foreign key is J.13 expressed as a constraint: a bound observation cannot record a currency different from its configuration version's currency, because no such parent row exists. The project composite foreign key is I5 expressed as a constraint: an observation cannot borrow another project's configuration version.

There is **no** transaction column. An observation is storable, verifiable, and auditable without any canonical transaction existing.

**`verification_result`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `verification_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | composite FK `(observation_id, project_id)` → `payment_observation(observation_id, project_id)`; part of `UQ(verification_id, project_id)` | yes |
| `observation_id` | TEXT | no | FK → `payment_observation`; part of `UQ(verification_id, observation_id)` | yes |
| `payment_config_version_id` | TEXT | yes | composite FK `(observation_id, payment_config_version_id)` → `payment_observation(observation_id, payment_config_version_id)`; part of `UQ(verification_id, payment_config_version_id)` | yes |
| `config_binding_state` | TEXT | no | composite FK `(observation_id, config_binding_state)` → `payment_observation(observation_id, config_binding_state)` | yes |
| `outcome` | TEXT | no | CK ∈ {`passed`, `failed`, `rejected`}; part of `UQ(verification_id, outcome)` | yes |
| `reason_code` | TEXT | no | `CK(reason_code <> '')`; enumerated by the verification contract, not by a database enum | yes |
| `verifier_kind` | TEXT | no | CK ∈ {`automated`, `test_fake`} in Slice 2A; `human` is reserved and requires a later migration gated on J.10 | yes |
| `verified_by` | TEXT | yes | FK → `people(id)`; `CK(verified_by IS NULL OR verifier_kind = 'human')` — always NULL while `human` is outside the domain | yes |
| `verifier_reference` | TEXT | yes | identifier of the verifier configuration/version that ran | yes |
| `verified_at_source` | TEXT | no | CK ∈ {`system_clock`, `test_clock`} | yes |
| `data_classification` | TEXT | no | CK ∈ {`synthetic`, `live`}; part of `UQ(verification_id, data_classification)` | yes |
| `attempted_at` | TEXT | no | part of `UQ(verification_id, attempted_at)` | yes |

Table constraints: `UQ(verification_id, observation_id)`, `UQ(verification_id, outcome)`, `UQ(verification_id, data_classification)`, `UQ(verification_id, payment_config_version_id)`, `UQ(verification_id, project_id)`, `UQ(verification_id, attempted_at)`, and the checks:

```sql
CHECK (outcome <> 'passed' OR config_binding_state = 'bound')
CHECK (outcome <> 'passed' OR payment_config_version_id IS NOT NULL)
CHECK (verifier_kind <> 'test_fake' OR verified_by IS NULL)
CHECK (verifier_kind <> 'test_fake' OR verified_at_source = 'test_clock')
CHECK (verifier_kind <> 'test_fake' OR data_classification = 'synthetic')
CHECK (verifier_kind <> 'automated' OR verified_by IS NULL)
CHECK (verifier_kind <> 'automated' OR verifier_reference IS NOT NULL)
CHECK (verifier_kind <> 'automated' OR verified_at_source = 'system_clock')
CHECK (verifier_kind <> 'human')
```

`verification_result` has **no** `payment_transaction_id`. A verification result never claims a transaction; the acceptance record makes that claim, and only after the correlation exists.

**`payment_transaction`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `payment_transaction_id` | TEXT | no | PK; part of parent keys `UQ(payment_transaction_id, data_classification)`, `UQ(payment_transaction_id, project_id)`, `UQ(payment_transaction_id, payment_config_version_id)` | yes |
| `identity_id` | TEXT | no | FK → `provider_transaction_identity`; **UQ** (I7) | yes |
| `project_id` | TEXT | no | FK → `projects`; composite FK `(provider_account_id, project_id)` → `payment_provider_account(provider_account_id, project_id)` | yes |
| `provider_account_id` | TEXT | no | FK → `payment_provider_account` | yes |
| `source_observation_id` | TEXT | no | **UQ**; composite FK `(source_observation_id, data_classification)` → `payment_observation(observation_id, data_classification)`; composite FK `(source_observation_id, payment_config_version_id)` → `payment_observation(observation_id, payment_config_version_id)` | yes |
| `payment_config_version_id` | TEXT | no | FK → `payment_configuration_version`; the immutable baseline (I8) | yes |
| `accepted_amount_normalized` | TEXT | no | canonical form (§10.3); `CK(accepted_amount_normalized <> '0')` | yes |
| `accepted_amount_scale` | INTEGER | no | CK `0 ≤ accepted_amount_scale ≤ 6` | yes |
| `accepted_currency` | TEXT | no | composite FK `(payment_config_version_id, accepted_currency)` → `payment_configuration_version(payment_config_version_id, currency)` | yes |
| `data_classification` | TEXT | no | CK ∈ {`synthetic`, `live`} | yes |
| `accepted_at` | TEXT | no | | yes |

Table constraints: `UQ(identity_id)`, `UQ(source_observation_id)`, `UQ(payment_transaction_id, data_classification)`, `UQ(payment_transaction_id, project_id)`, `UQ(payment_transaction_id, payment_config_version_id)`.

Three inheritance rules are structural rather than trust-based: the transaction's data classification must equal its establishing observation's, its configuration version must equal that observation's captured version, and its accepted currency must be its configuration version's currency. Each is a composite foreign key to a declared parent key, so a violation cannot be inserted at all.

**`payment_transaction_acceptance`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `acceptance_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | composite FK `(payment_transaction_id, project_id)` → `payment_transaction(payment_transaction_id, project_id)`; composite FK `(verification_id, project_id)` → `verification_result(verification_id, project_id)` | yes |
| `payment_transaction_id` | TEXT | no | FK → `payment_transaction`; **UQ** (one acceptance per transaction) | yes |
| `verification_id` | TEXT | no | FK → `verification_result`; **UQ** (one acceptance per verification) | yes |
| `observation_id` | TEXT | no | composite FK `(verification_id, observation_id)` → `verification_result(verification_id, observation_id)`; composite FK `(observation_id, payment_transaction_id)` → `payment_transaction_observation(observation_id, payment_transaction_id)` | yes |
| `payment_config_version_id` | TEXT | no | composite FK `(payment_transaction_id, payment_config_version_id)` → `payment_transaction(payment_transaction_id, payment_config_version_id)`; composite FK `(verification_id, payment_config_version_id)` → `verification_result(verification_id, payment_config_version_id)` | yes |
| `verification_outcome` | TEXT | no | CK `verification_outcome = 'passed'`; composite FK `(verification_id, verification_outcome)` → `verification_result(verification_id, outcome)` | yes |
| `data_classification` | TEXT | no | composite FK `(verification_id, data_classification)` → `verification_result(verification_id, data_classification)`; composite FK `(payment_transaction_id, data_classification)` → `payment_transaction(payment_transaction_id, data_classification)` | yes |
| `accepted_at` | TEXT | no | | yes |

Table constraints: `UQ(payment_transaction_id)`, `UQ(verification_id)`.

Four invariants are enforced by this table alone:

1. **Belonging.** The `(observation_id, payment_transaction_id)` foreign key means an acceptance cannot exist unless that observation is correlated to that transaction in `payment_transaction_observation`. "This verification belongs to this transaction" is stored data proven by a key, not an application assumption.
2. **Eligibility.** The `(verification_id, verification_outcome)` composite key with `verification_outcome = 'passed'` means a `failed` or `rejected` verification cannot be accepted even if the caller asserts otherwise.
3. **Single acceptance.** `UQ(payment_transaction_id)` and `UQ(verification_id)` mean one accepted verification per transaction and one transaction per accepted verification. Competing acceptances fail on the unique index, not on a racy read.
4. **Classification agreement.** The two classification composite keys force the transaction and the verification to share one classification, so a synthetic verification cannot accept a live transaction and a live verification cannot launder a synthetic one.

**`payment_transaction_observation`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `observation_id` | TEXT | no | PK part; FK → `payment_observation` | yes |
| `payment_transaction_id` | TEXT | no | PK part; FK → `payment_transaction` | yes |
| `project_id` | TEXT | no | composite FK `(observation_id, project_id)` → `payment_observation(observation_id, project_id)`; composite FK `(payment_transaction_id, project_id)` → `payment_transaction(payment_transaction_id, project_id)` | yes |
| `correlation_basis` | TEXT | no | CK ∈ {`provider_shared_reference`, `verified_mapping`} (2A ships `provider_shared_reference` only) | yes |
| `correlated_at` | TEXT | no | | yes |

The composite primary key rejects duplicate correlation membership; the two project composite keys reject cross-project correlation.

**`reconciliation_conflict`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `conflict_id` | TEXT | no | PK; part of parent key `UQ(conflict_id, project_id)` | yes |
| `project_id` | TEXT | no | FK → `projects` | yes |
| `conflict_key` | TEXT | no | deterministic digest (§8.4); `UQ(project_id, conflict_key)` | yes |
| `conflict_kind` | TEXT | no | CK ∈ {`duplicate_content_mismatch`, `cross_source_conflict`, `unresolved_correlation`, `cross_project_collision`} | yes |
| `payment_transaction_id` | TEXT | yes | composite FK `(payment_transaction_id, project_id)` → `payment_transaction(payment_transaction_id, project_id)` | yes |
| `trigger_observation_id` | TEXT | yes | composite FK `(trigger_observation_id, project_id)` → `payment_observation(observation_id, project_id)` | yes |
| `detected_at` | TEXT | no | | yes |
| `detection_source` | TEXT | no | identifier of the check that raised it | yes |

There is no `status` column and no `blocks_use` column. Both are derived (§6.4), because a stored status would be a mutable field in an append-only table and a stored `blocks_use` could disagree with the resolution history.

**`reconciliation_conflict_observation`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `conflict_id` | TEXT | no | PK part; FK → `reconciliation_conflict` | yes |
| `observation_id` | TEXT | no | PK part; FK → `payment_observation` | yes |
| `project_id` | TEXT | no | composite FK `(conflict_id, project_id)` → `reconciliation_conflict(conflict_id, project_id)`; composite FK `(observation_id, project_id)` → `payment_observation(observation_id, project_id)` | yes |

The composite primary key makes duplicate membership impossible and replaces Revision 2's `observation_ids` array.

**`conflict_resolution`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `resolution_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | composite FK `(conflict_id, project_id)` → `reconciliation_conflict(conflict_id, project_id)` | yes |
| `conflict_id` | TEXT | no | FK → `reconciliation_conflict`; **UQ** (one terminal resolution per conflict) | yes |
| `resolution_kind` | TEXT | no | CK ∈ {`duplicate_confirmed`, `distinct_confirmed`, `quarantined`} | yes |
| `decided_by_kind` | TEXT | no | CK ∈ {`automated`, `human`}; `human` requires J.10 and is outside Slice 2A | yes |
| `decided_by_reference` | TEXT | yes | rule or decision identifier; `CK(decided_by_kind <> 'human' OR decided_by_reference IS NOT NULL)` | yes |
| `decided_at` | TEXT | no | | yes |
| `rationale_code` | TEXT | no | `CK(rationale_code <> '')` | yes |

**`verification_supersession`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `supersession_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | composite FK `(superseded_verification_id, project_id)` → `verification_result(verification_id, project_id)`; composite FK `(superseding_verification_id, project_id)` → `verification_result(verification_id, project_id)` | yes |
| `superseded_verification_id` | TEXT | no | FK → `verification_result`; **UQ** (at most one successor, no branching) | yes |
| `superseding_verification_id` | TEXT | no | FK → `verification_result` | yes |
| `superseded_created_at` | TEXT | no | carried; composite FK `(superseded_verification_id, superseded_created_at)` → `verification_result(verification_id, attempted_at)` | yes |
| `superseding_created_at` | TEXT | no | carried; composite FK `(superseding_verification_id, superseding_created_at)` → `verification_result(verification_id, attempted_at)` | yes |
| `reason_code` | TEXT | no | `CK(reason_code <> '')` | yes |
| `authority_kind` | TEXT | no | CK ∈ {`automated`} in Slice 2A; `human` requires J.3/J.10 authority | yes |
| `decided_at` | TEXT | no | | yes |

Table constraints: `UQ(superseded_verification_id)`, `CK(superseding_verification_id <> superseded_verification_id)`, `CK(superseding_created_at > superseded_created_at)`.

### 5.4 Commercial baseline binding (Finding D)

The baseline question has four parts, and each is answered by a specific column plus a specific key.

**Configuration identity versus configuration version identity.** A configuration is the project's commercial instrument; a configuration version is one immutable state of it. Only versions are referenced by evidence. `payment_config_version_id` is the version identity; `version_number` is ordering metadata within a project and is never used as a foreign key.

**Which version governs a transaction.** The one captured with the observation that established the transaction, at ingestion time. Ingestion resolves the project's effective version — the one referenced by the exact current accepted proposal version and exact current applicable signed-agreement version, per canonical decision §B.1 — and records it on the observation. If resolution is impossible, the observation is stored unbound (§4.4) and can never establish a transaction, because `payment_transaction` requires both `payment_config_version_id` and a `source_observation_id` whose composite key proves a non-null version.

**Currency and other terms.** Currency is tied to the version by composite foreign key on both the observation and the transaction, so neither can be inserted with a currency its version does not use (J.13 at schema level). Amount ceilings are not evaluated in Slice 2A: there is no obligation comparison and no allocation. In Slice 2B, I1 evaluates an obligation's expected amount, and obligations are members of a configuration version, so the ceiling is always read from an immutable version rather than from current commercial terms.

**Proposal and agreement references.** Captured on the configuration version itself (`proposal_version_id`, `agreement_version_id`) at version creation, per §B.1. Evidence does not duplicate them; it references the version, and the version's references are immutable by construction. Staleness is therefore a derived comparison — the version's referenced proposal/agreement versions against the project's current ones — never a stored flag.

**After a configuration change.** Nothing already accepted changes. A later observation binds the then-current version; the earlier transaction keeps its own. Because the binding is a `NOT NULL` foreign key with no update path (I4, I8), "reinterpreting" a historical transaction would require a new row, which the uniqueness rule on the identity forbids for the same funds movement. This is the structural guarantee that Revision 2 lacked entirely.

**When the bound version is stale at acceptance time.** The canonical decision states that a stale configuration cannot satisfy the activation gate (§B.1) but does not say what happens to funds received against a stale baseline. Slice 2A takes the fail-safe reading and does not invent a commercial rule: verification returns `failed` with `reason_code = config_baseline_stale`, no transaction is created, and the observation remains retained evidence. Whether funds received against a superseded commercial baseline may later be accepted — and against which baseline — is a Founder decision. It is listed as an open dependency in §16.4 and is not resolved here.

### 5.5 The Slice 2A / 2B boundary, precisely

**Slice 2A may establish:** trusted provider accounts, registrations, observations, verification results, acceptance records, canonical accepted transactions, correlation, conflicts, resolutions, supersession, and audit — a *synthetic verified-payment-transaction foundation*, subject to J.3 approval.

**Slice 2A must not establish or imply:**

- that an obligation is paid, satisfied, or partially satisfied;
- any obligation-specific allocation check (no allocation subsystem exists in 2A);
- any `obligation_id` association on evidence or transactions invented to make an acceptance test pass;
- any obligation state other than `proposed` (configuration membership);
- any inference from "funds accepted" to "obligation settled".

Verification in 2A compares an observation against the **configuration version it captured** and the verification contract. It does not compare against an obligation's expected amount; that comparison is a 2B allocation-time determination and requires J.14.

**Checks that belong to 2A:** registration trust; delivery uniqueness; provider reference presence; global identity uniqueness; currency agreement with the bound configuration version; exact decimal validity; project consistency; correlation recording; conflict detection and membership; resolution recording; supersession recording; atomic audit.

**Checks that belong to 2B:** request idempotency; per-transaction available funds (I2); per-obligation remaining balance (I1); currency equality across transaction, obligation, and allocation; serialized write; obligation satisfaction under the selected J.14 option; compensating corrections.

**Slice 2A does not weaken the activation predicate.** The canonical predicate requires each required obligation to be individually satisfied against its own expected amount and currency (§F.2). A 2A foundation has no allocation and therefore cannot satisfy that predicate.

---

## 6. Verification, Acceptance, Conflicts, and Supersession

### 6.1 Verification outcome — semantics fixed

`verification_result.outcome` is exactly one of:

| Outcome | Meaning | Persistence consequence |
|---|---|---|
| `passed` | The observation satisfied the approved verification contract and its facts were accepted as evidence. | The result is eligible for acceptance. By itself it creates no transaction and accepts no funds. |
| `failed` | A verification attempt could not reach a conclusion for a technical or transient reason (observation arrived before its registration was active, required provider reference absent, bound baseline stale). | No acceptance. Retry permitted as a new attempt with its own record. |
| `rejected` | The observation is definitively inadmissible: malformed amount, currency mismatch with the bound configuration version, untrusted or unknown registration, unbound baseline, or a cross-project identity collision. | No acceptance. A new *corrected* observation is a new delivery, not a retry of this one. |

A conflict is **not** an outcome. It is a separate record (§6.3).

### 6.2 Acceptance — the record that replaces the circular pointer

Revision 2 answered "who accepted what" with two columns pointing at each other. Revision 3 stores the decision once, in `payment_transaction_acceptance`, which is written after both parents and after the correlation that proves they belong together (§5.2).

Acceptance is the only record that says "these funds are accepted on the strength of this verification". Its constraints (§5.3) make four claims structural:

- **It belongs.** The `(observation_id, payment_transaction_id)` key requires an existing correlation row for that exact pair.
- **It is eligible.** `verification_outcome = 'passed'` plus the composite key to `verification_result(verification_id, outcome)` means a failed or rejected result cannot be accepted.
- **It is unique.** `UQ(payment_transaction_id)` and `UQ(verification_id)` mean exactly one accepted verification per transaction, and one acceptance per verification.
- **It is classification-consistent.** The two classification composite keys force transaction and verification to agree.

**Multiple attempts** are represented by multiple `verification_result` rows for the same observation — each with its own `verification_id`, `attempted_at`, and `outcome`. Exactly one of them (or none) can be accepted, and the others remain auditable as attempts. **Failed and rejected attempts** are fully auditable precisely because they have no acceptance row: their absence from `payment_transaction_acceptance` is meaningful data, not a gap.

**No deferred constraint is used.** SQLite supports `DEFERRABLE INITIALLY DEFERRED` foreign keys, but this design does not need them: every foreign key is satisfiable at insert time in the order of §5.2. Stating this matters, because a design that *required* deferral would also require the write layer to guarantee that no other reader observes the intermediate state, which is a much weaker guarantee than an immediate constraint.

### 6.3 Reconciliation conflicts — kinds and membership

`reconciliation_conflict` records, immutably, that a detected condition exists. Its kinds:

| Kind | Raised when |
|---|---|
| `duplicate_content_mismatch` | A second observation resolves to an already-accepted identity but reports a different amount, currency, or classification. |
| `cross_source_conflict` | Two correlated observations disagree on facts in a way the contract cannot adjudicate. |
| `unresolved_correlation` | Two or more observations appear related but no trusted reference establishes it. |
| `cross_project_collision` | An identity already owned by another project is claimed again (§4.6). |

Membership is the relation `reconciliation_conflict_observation`, with composite primary key `(conflict_id, observation_id)`: every participating observation is a foreign key, duplicate membership is rejected by the key, and no array exists anywhere in the model. A conflict may additionally name a `payment_transaction_id` when a specific accepted transaction is affected, and a `trigger_observation_id` naming the delivery whose arrival raised it.

### 6.4 Blocking is derived, never stored

Whether a transaction or observation is blocked is a query over immutable rows:

```
open_conflict          := reconciliation_conflict with no conflict_resolution row
blocked_transaction(t) := exists open conflict with t.payment_transaction_id = t
                          or exists open conflict whose membership includes an
                             observation correlated to t
blocked_observation(o) := exists open conflict whose membership includes o
```

Both are views. There is no `blocks_use` column and no `status` column, because either would be a mutable field in an append-only table and could drift from the resolution history. Blocking constrains *use* (derived financial position, and the 2B allocation precondition in §12.3), never *existence*: the records remain recorded and auditable.

### 6.5 Supersession — explicit precedence, never "latest wins"

A later verification may supersede an earlier conclusion only by writing a `verification_supersession` record. Rules:

1. **No implicit precedence.** The current position is not "the latest verification row". Selecting the latest row would let a later `failed` observation silently invalidate an earlier accepted transaction — the failure mode the canonical decision forbids (§D.6, §E.2).
2. **A `failed` or `rejected` result never by itself revokes acceptance.** It records an attempt outcome.
3. **Revocation requires a supersession record** naming the superseded verification, the superseding verification, a `reason_code`, and the authority that produced it. In Slice 2A only approved J.3 rules may create one; no human override exists in 2A.
4. **Supersession is linear and terminal per record:** each verification has at most one successor (`UQ(superseded_verification_id)`), a supersession cannot be undone, and the successor may itself be superseded later.
5. **The derived position walks the supersession chain** from the accepted verification to its head, and applies open conflicts as blocks.
6. **A supersession never deletes or mutates** the superseded result, the transaction, or the observations.

### 6.6 Immutability of accepted funds

Once a `payment_transaction` and its acceptance exist, their identity, accepted amount, accepted currency, classification, and baseline are immutable. Later information cannot rewrite them, and later information cannot create a second transaction for the same identity (I7). This is what prevents a later failed observation from silently erasing earlier accepted funds while also preventing a replay from doubling them.

A failed verification never pretends an accepted payment exists, and never requires one to exist: `verification_result` references only its observation, and the observation exists independently of any transaction.

---

## 7. Trust Boundaries, Project Isolation, and Security

All rules below reuse the canonical decision's existing security contract (§G.2, §G.3, §H). No new customer capability is introduced.

### 7.1 How trusted provider/account identity is established

By a `payment_provider_account` row plus a `payment_source_registration` row, both created by the Founder/internal capability on the internal surface. The `provider_key`, `environment`, `account_reference`, and `source_namespace` values come from server-side configuration, never from a request body. A syntactically valid namespace supplied by an untrusted caller is **not** trusted: matching a string is not authentication. Unregistered namespaces produce `rejected` verification results and no records.

### 7.2 How external observations become associated with a project

The observation's `project_id` is derived from `source_registration_id` and is enforced by the composite foreign key `(source_registration_id, project_id)` — a caller cannot supply a project that its registration does not belong to, because no such parent row exists. If a request carries a project reference, that reference is resolved within the caller's organization and compared against the registration's project; mismatch is rejected and recorded as `cross_project_collision`.

### 7.3 How project ownership is derived rather than trusted

The existing pattern is mandatory: resolve the caller-supplied reference inside the caller's organization, then re-check authorization server-side on every read and every write. Internal payment operations require the internal capability attached to a Person and never run on a customer route with hidden controls.

### 7.4 How configuration and baseline identities are checked

A transaction or allocation may reference only a configuration version belonging to the same project, enforced in 2A by the composite key `(payment_config_version_id, project_id)` and its use on both `payment_observation` and `payment_transaction`. The configuration's `proposal_version_id` and `agreement_version_id` are captured immutably at version creation; staleness is derived by comparing them with the project's current versions, and a stale version is not silently used (canonical decision §B.1). Obligations must be members of the configuration version being evaluated.

### 7.5 How cross-project collisions are rejected

Canonical identity is global (§4.3). If a provider reference resolves to an existing identity whose transaction is owned by a different project, the write is refused by `UNIQUE(payment_transaction.identity_id)`, a `rejected` verification result is recorded, and a `cross_project_collision` conflict is raised in the refusing project. A second project never inherits, duplicates, or sees another project's transaction, and the owning project's records are untouched by the attempt.

### 7.6 How customer access stays read-only

Customer surfaces expose derived status only, under existing project-access checks. There is no customer route that writes payment state, submits evidence, or allocates funds — in this design or any later one implied here.

### 7.7 How automated provider authentication differs from human authorization

Automated verification is `verifier_kind = automated` with `verified_by IS NULL` (a checked constraint) and `verifier_reference` naming the verifier configuration that ran. It authenticates a *channel*, not a person. Human determination is `verifier_kind = human` with `verified_by` set, requires the internal capability and a J.10 decision, and is outside Slice 2A: the value is not in the column's check domain, so a migration is required before it can appear at all. An automated pass can never produce a human determination, and vice versa.

### 7.8 How audit records stay identifier-only

`audit_event.metadata` is restricted to an allowlist of identifier keys (§8.6). No amounts, currencies, payloads, credentials, or provider secrets. Enforcement is by allowlist rejection at write plus a test that rejects forbidden key patterns — not by searching for one sample amount string.

---

## 8. Slice 2A Schema, Constraints, and Lifecycles

### 8.1 Scope

Slice 2A is the synthetic, provider-neutral foundation: provider accounts, registrations, observations, verification results, acceptance records, canonical transactions, correlation, conflicts, resolutions, supersession, exact decimals, currency agreement, project isolation, identifier-only audit. Synthetic/test data only. It requires J.3 resolution before implementation.

### 8.2 Constraint inventory

Each rule below is a rule this proposal *depends on*, the mechanism that enforces it, and what it prevents. A rule enforced only in application code is marked as such and justified.

| Invariant | Mechanism | Prevents |
|---|---|---|
| I7: one transaction per funds movement | `UQ(provider_key, provider_environment, provider_account_reference, provider_transaction_reference)` on `provider_transaction_identity`; `UQ(identity_id)` on `payment_transaction` | Double acceptance across channels, registrations, or projects |
| Registration never defines funds identity | No `source_registration_id` column on `payment_transaction`; registration id absent from the identity key | Channel-scoped identity drift; identity changing when a registration is replaced |
| Unresolved observations exist without a transaction | `payment_observation` has no transaction column; correlation lives in `payment_transaction_observation` | Phantom transactions invented to satisfy a mandatory FK |
| Conflict membership is relational | PK `(conflict_id, observation_id)` on `reconciliation_conflict_observation` | ID arrays, dangling references, duplicate membership |
| Exactly one acceptance per transaction | `UQ(payment_transaction_id)` on `payment_transaction_acceptance` | Competing or repeated acceptances |
| Exactly one transaction per accepted verification | `UQ(verification_id)` on `payment_transaction_acceptance` | Reusing one pass to accept two funds movements |
| Only `passed` can be accepted | `CK(verification_outcome = 'passed')` + composite FK `(verification_id, verification_outcome)` → `verification_result(verification_id, outcome)` | Accepting failed or rejected attempts |
| Acceptance requires proven belonging | Composite FK `(observation_id, payment_transaction_id)` → `payment_transaction_observation` | Accepting a verification of an unrelated observation |
| Acceptance cannot cross projects | `project_id` on acceptance with composite FKs to both parents' project keys | Cross-project acceptance |
| Synthetic ≠ live | `data_classification` on observation, verification, transaction, acceptance, with composite FKs forcing agreement | Test data laundering into real evidence |
| Unbound observation never accepted | `CK(outcome <> 'passed' OR config_binding_state = 'bound')`; transaction requires a bound source observation | Silent acceptance without a commercial baseline |
| Baseline is immutable | `payment_transaction.payment_config_version_id NOT NULL` + no update path | Retroactive reinterpretation |
| Currency matches the baseline | Composite FK `(payment_config_version_id, accepted_currency)` → `payment_configuration_version(payment_config_version_id, currency)` | Mixed-currency acceptance |
| One current registration per scope | PK `(project_id, provider_account_id, source_kind, source_namespace)` on `payment_source_registration_current` + compare-and-swap (§8.3) | Concurrent replacement producing two currents |
| Registration history is append-only | `payment_source_registration` has no update path; successor recorded via `supersedes_registration_id` | Lost or rewritten registration history |
| No supersession branching or duplicate successor | `UQ(superseded_verification_id)`; `UQ(supersedes_registration_id)` | Two successors of one record |
| No supersession cycles | Carried timestamps + composite FKs to the parents' `attempted_at`/`created_at` + `CK(superseding_created_at > superseded_created_at)` | Cyclic or self-referential chains |
| Supersession stays in one project | `project_id` with composite FKs to both verifications' `(verification_id, project_id)` | Cross-project supersession |
| One open conflict per detected condition | Deterministic `conflict_key` + `UQ(project_id, conflict_key)` (§8.4) | Duplicate open conflicts |
| Conflict resolution is terminal and auditable | `UQ(conflict_id)` on `conflict_resolution` | Re-resolution rewriting history |
| Every row has an identity | Every table declares a primary key (§5.3) | Unaddressable records |
| Audit is identifier-only | Allowlist at write (§8.6) + forbidden-pattern test | Amount, credential, or payload leakage |
| Amounts are exact | Grammar and normalization (§10) | Float, lexicographic, or scale-based money errors |

Two rules remain **application-level** and are labelled as limitations rather than enforcement:

- *Which* observation first creates an identity row, and therefore which project owns it, is decided by the accepting write path; the database enforces that only one such row can exist, not which one wins.
- Verification *content* (that an amount is plausible for the contract) is application logic; the database enforces the structural consequences of the decision, not the decision's quality.

### 8.3 Source registration lifecycle

**History versus current.** `payment_source_registration` is the authoritative, append-only history. `payment_source_registration_current` is a **projection**: one row per scope, pointing at the registration that is currently in force. It is explicitly mutable, explicitly non-authoritative, and fully rebuildable by walking `supersedes_registration_id` chains from the earliest registration in each scope.

**The "at most one current" rule.** It is the projection's primary key:

```sql
PRIMARY KEY (project_id, provider_account_id, source_kind, source_namespace)
```

No partial index over a derived status is used, and no `is_active` flag is trusted. A stale `is_active` flag can disagree with reality and cannot be constrained; a primary key cannot.

**Replacement procedure**, inside one `BEGIN IMMEDIATE` transaction (the repository's existing write pattern, §3.1):

1. Insert the new registration with `supersedes_registration_id` = the current registration's id and `supersedes_created_at` = that registration's `created_at`. `UQ(supersedes_registration_id)` means a registration can have at most one successor, and the ordering check means the successor must be newer.
2. Compare-and-swap the projection:

   ```sql
   UPDATE payment_source_registration_current
      SET source_registration_id = :new, replaced_at = :now
    WHERE project_id = :project AND provider_account_id = :account
      AND source_kind = :kind AND source_namespace = :namespace
      AND source_registration_id = :expected_current;
   ```

3. Require exactly one row changed. Zero rows means another writer already replaced it, or the caller's expectation was stale: roll back the whole transaction, including the new registration insert, and report a distinct `registration_superseded_concurrently` failure rather than retrying silently.
4. Insert the identifier-only audit row and commit.

**Why concurrency is safe.** `BEGIN IMMEDIATE` takes the write lock before the first read, so two replacements cannot interleave their read-compare-write sequences: the second sees the first's committed pointer, its `WHERE` no longer matches `:expected_current`, and it aborts. This is a compare-and-swap on a single row, not a read-then-write with a window between them. It is the same discipline §12.3 applies to allocation, and it depends on the same repository-level guarantee rather than on new machinery.

**Relationship to identity.** A registration change never changes any existing transaction, because no transaction references a registration (§4.3). An observation ingested under a registration that is later replaced keeps its own `source_registration_id` forever; that is historical provenance, not identity.

### 8.4 Conflict lifecycle

**Deterministic conflict key.** A conflict is identified by a digest over exactly the facts that define the condition:

```
conflict_key = SHA-256(
    "conflict/v1"  || 0x1F ||
    project_id     || 0x1F ||
    conflict_kind  || 0x1F ||
    sorted(participating observation ids, ascending, 0x1E-separated) || 0x1F ||
    sorted(participating transaction ids, ascending, 0x1E-separated) || 0x1F ||
    trigger_record_id
)
```

Properties this gives:

- **Re-detection converges.** The same condition observed again with the same participants and the same trigger produces a byte-identical key. `UQ(project_id, conflict_key)` rejects the second insert, and the write path reads the existing row and returns it as the conflict id. Convergence is a constraint outcome, not a de-duplication heuristic.
- **A genuinely new episode is representable.** A new delivery that raises the same *kind* of disagreement is a different trigger over a different participant set, so its key differs and a new conflict row is legal. This is what makes "a distinct conflict episode can be represented" true rather than aspirational.
- **The key is reproducible.** It contains no timestamps, no random salt, no ordering ambiguity, and no mutable state, so an auditor can recompute it from the stored rows.

**Resolution.** `conflict_resolution` is append-only with `UQ(conflict_id)`: exactly one terminal resolution may exist per conflict. A conflict is never edited to look resolved, and a resolution is never deleted. "Open" is derived (§6.4), so the history of a resolved conflict — the conflict row, its membership, its resolution — remains complete and readable.

**Duplicate resolution attempts** are rejected by `UQ(conflict_id)`. A later disagreement, even about the same records, is a new conflict with a new key, which is why the terminal rule does not become a dead end.

### 8.5 Supersession lifecycle

The same shape is used for verifications (§5.3) and for registrations (§8.3):

| Property | Mechanism | What it prevents |
|---|---|---|
| Chains permitted | A superseding record may itself be superseded later; `superseded_verification_id` is unique only among *superseded* rows | A record being wrongly treated as terminal after one link |
| Terminality | Once a row appears as `superseded_verification_id`, it can never point to a successor again; the chain head is the unique record with no supersession row naming it | Re-animation of a closed conclusion |
| Duplicate successor | `UQ(superseded_verification_id)` | Two records both claiming to supersede the same one |
| Branching | Same constraint: a branch *is* a second successor, so it is the same violation | Two divergent "current" positions |
| Cycles | `superseded_created_at` and `superseding_created_at` are carried and proven genuine by composite foreign keys to `verification_result(verification_id, attempted_at)`; `CK(superseding_created_at > superseded_created_at)` | A→B→A, or any cycle: strict increase along every edge makes a return to an earlier record impossible |
| Self-supersession | `CK(superseding_verification_id <> superseded_verification_id)` | A one-row cycle |
| Scope consistency | `project_id` with composite foreign keys to both verifications' `(verification_id, project_id)` | Superseding across projects |
| Concurrent attempts | `UQ(superseded_verification_id)` plus the serialized write transaction | Two racing supersessions both committing |

The cycle rule deserves a note on why the check constraint is legitimate rather than a "database can't do it" hand-wave. SQLite evaluates `CHECK` on one row and cannot join, so ordering is enforced by making the compared values *part of the row* and proving they are genuine with foreign keys: `superseded_created_at` must equal the parent's `attempted_at` (composite FK), `superseding_created_at` likewise, and then the check compares two local columns. Because every edge strictly increases `attempted_at`, a cycle would require a strictly increasing sequence returning to its start — impossible. The constraint is local; the guarantee is global.

### 8.6 Audit allowlist

Permitted `audit_event.metadata` keys: `observation_id`, `verification_id`, `acceptance_id`, `payment_transaction_id`, `identity_id`, `conflict_id`, `resolution_id`, `supersession_id`, `source_registration_id`, `provider_account_id`, `paymentConfigVersionId`, `proposalVersionId`, `agreementVersionId`, `obligation_id`, `allocation_id`, `allocation_request_id`, `versionNumber`.

Rejected patterns at write time: any key matching `/amount|currency|due|scope|credential|secret|payload|token|reference|signature|email|name/i`.

Revision 2's `evidence_id` is removed: no such column, table, or identifier exists in Revision 3, and an allowlist entry for a non-existent field is exactly the kind of drift this pass is meant to eliminate. `provider_transaction_reference` is deliberately **not** on the allowlist — it is an external identifier, and internal tracing is satisfied by `payment_transaction_id`.

This allowlist check is the primary control. A substring search for a literal sample amount is retained only as a regression assertion, never as the proof of privacy.

### 8.7 What Slice 2A explicitly does not contain

No `allocation`; no `allocation_request`; no obligation linkage on evidence or transactions; no obligation state beyond `proposed`; no payment-attempt, retry, dunning, or notification subsystem; no manual determination; no customer upload; no activation predicate or event; no provider integration; no refund, reversal, or chargeback handling; no production data.

---

## 9. Synthetic Fixtures, Test Verification, and Field Semantics

Four different things must never be confused. Revision 1 blurred them by having `fake_verifier(event)` return `"passed"` with `verified_by = founder_person_id`, which fabricated Founder approval.

| # | Thing | Where it may exist | What it may assert |
|---|---|---|---|
| 1 | **Synthetic fixture creation** | Test code only | An observation *would* look like this. Carries `data_classification = synthetic`. |
| 2 | **Test-only fake verification** | Test infrastructure, injected | A synthetic observation satisfies the verification contract. Never real funds. |
| 3 | **Future production verification** | Does not exist; requires J.3, J.8 | Nothing is asserted today. |
| 4 | **Human/internal payment-status determination** | Does not exist; requires J.10 | Nothing is asserted today. |

### 9.1 Fake verifier contract

- Injected only by explicit dependency injection from test setup; the module is test-environment gated and cannot be constructed in a production build.
- Never a production fallback: with no production verifier configured, the system **fails closed** (`failed` result, no acceptance), and never falls back to the fake.
- Unreachable from any customer-controlled input: there is no route, flag, header, or payload field that selects a verifier.
- Emits `verifier_kind = 'test_fake'`, `verified_by = NULL`, `verified_at_source = 'test_clock'`, `data_classification = 'synthetic'`. The four checks in §5.3 reject any other combination, so the fake verifier cannot emit a Founder identifier even if a caller tries to pass one.
- Records it produces are `synthetic`; the acceptance composite keys prevent a synthetic verification from accepting a live transaction.

### 9.2 Field semantics, table ownership, and lifetime

Every field named by a constraint in this document, defined once. Table ownership is the table in §5.3 that declares the column; the constraints listed there are the complete set.

| Field | Owner table | Type / domain | Null | Default | Key role | Constraint | Immutable | Lifetime |
|---|---|---|---|---|---|---|---|---|
| `verifier_kind` | `verification_result` | TEXT, ∈ {`automated`, `test_fake`} in 2A; `human` reserved | no | none | none | CK on domain; drives the verifier checks below | yes | `test_fake` is production-forbidden; `automated` is permitted in a later production model only after J.3/J.8 |
| `verified_by` | `verification_result` | TEXT, FK → `people(id)` | yes | none | FK | `CK(verified_by IS NULL OR verifier_kind = 'human')`; always NULL while `human` is outside the domain | yes | Human-only, gated on J.10; NULL for every automated and test row |
| `verifier_reference` | `verification_result` | TEXT (identifier of the verifier configuration/version) | yes | none | none | `CK(verifier_kind <> 'automated' OR verifier_reference IS NOT NULL)` | yes | Permitted in production; identifiers only, never secrets |
| `verified_at_source` | `verification_result` | TEXT, ∈ {`system_clock`, `test_clock`} | no | none | none | `CK(verifier_kind <> 'test_fake' OR verified_at_source = 'test_clock')`; `CK(verifier_kind <> 'automated' OR verified_at_source = 'system_clock')` | yes | `test_clock` is test-only and structurally tied to `test_fake` |
| `data_classification` | `payment_observation`, `verification_result`, `payment_transaction`, `payment_transaction_acceptance` | TEXT, ∈ {`synthetic`, `live`} | no | none | Part of parent keys `UQ(observation_id, data_classification)`, `UQ(verification_id, data_classification)`, `UQ(payment_transaction_id, data_classification)` | Propagation: transaction equals its source observation's classification; acceptance equals both parents' (§5.3 composite FKs) | yes | `synthetic` only in test/dev environments; `live` requires J.3/J.8 and is not produced by any code in 2A |

**Where classification belongs, and why more than one table.** Classification is not a single flag on "the payment"; it is a property of each record that can be read as evidence. It appears on the observation (what the provider reported), the verification (what a verifier concluded), the transaction (what was accepted), and the acceptance (the decision). Keeping it on all four is what makes propagation enforceable: a single flag on the transaction could be flipped without touching the verification, whereas four columns tied by composite foreign keys cannot disagree. The cost is one extra column per table; the benefit is that "synthetic became real" is not representable as a one-field edit.

**Why each verifier constraint is a check and not a comment.** The four combinations a test run must never produce are: `test_fake` with a person, `test_fake` with a system clock, `test_fake` with `live` classification, and `automated` with a person. Each is a `CHECK` in §5.3, so each is rejected at insert regardless of which code path attempts it.

### 9.3 What the fake verifier may not do

It may not create a `payment_transaction` or an acceptance. Those are written by the acceptance write path, which requires a `passed` verification, a bound baseline, a resolved identity, an existing correlation, and a classification agreement. A test can drive that path to completion — that is the point of a synthetic foundation — but the result is `synthetic` end to end, and no combination of field edits converts it, because the conversion would have to change classification on four tables whose foreign keys demand agreement.

Manual determination stays governed by J.10 and is out of scope. No production payment processing, provider selection, provider integration, or credentials are authorized by this proposal.

---

## 10. Decimal, Currency, and Exact Arithmetic Contract

I3 governs. Revision 1 preserved decimal *strings* but never specified what "exact" required.

### 10.1 Accepted grammar

```
amount   := integer ( "." fraction )?
integer  := "0" | nonzero digit*
nonzero  := [1-9]
digit    := [0-9]
fraction := digit{1,6}
```

- There is **no sign production**. Revision 2's `signed` alternative was undefined and contradicted the unsigned-only policy, which rejects zero and negative payment amounts. A leading `+` or `-` is a grammar violation, not a value.
- Maximum 18 digits in the integer part and at most 6 fractional digits (scale ≤ 6). The `integer` production forbids leading zeros by construction.
- `"."` is the only decimal separator. Exponent notation, thousands separators, whitespace, and `,` decimals are rejected.
- Zero amounts are rejected for payment observations and allocations.
- Direction, where a direction exists at all, is expressed by `effect_sign` on a compensating allocation record (§12.1) and never by a negative amount. Refunds, reversals, and adjustments are not represented by negating a payment amount; they are separate events governed by J.5 and J.6 and are not designed here.

### 10.2 Preservation of original text

`amount_text` stores the exact text the provider or operator supplied, unmodified. Normalization produces a separate `amount_normalized` value plus `amount_scale`; the original is never overwritten, so evidence remains verbatim.

### 10.3 Canonical normalization

1. Parse into `(integer_digits, fraction_digits)` — there is no sign to parse.
2. Strip trailing zeros from `fraction_digits`.
3. Drop an empty fraction.
4. Result is `integer_digits` or `integer_digits + "." + fraction_digits`.

Therefore `1500`, `1500.00`, and `1500.000` all normalize to `1500` with scale 0 and are the same value.

### 10.4 Exact comparison

- Compare **values**, never text. Lexicographic comparison is forbidden: it would rank `"900"` above `"1500"`.
- Compare `(integer_digits, fraction_digits)` after normalization, or compare integer-scaled representations at a common scale.
- Equality of `1500` and `1500.00` is **true**; equality of `1500` and `1500.01` is false.

### 10.5 Exact addition and subtraction

- Represent values as arbitrary-precision integers (`BigInt` or an equivalent decimal library) scaled to a common exponent.
- Addition and subtraction are performed on those integers; no intermediate rounding exists.
- Sums used for ceilings (I1, I2) are exact sums of exact values, computed inside the write transaction (§12.3).
- Because amounts are non-negative, a compensating effect is applied by `effect_sign`, not by subtracting a signed amount; the arithmetic stays in unsigned space and the sign is a separate, checked column.

### 10.6 Currency

- Normalize by trimming and ASCII-uppercasing; valid form is `^[A-Z]{3}$`.
- A three-letter string does **not** prove a currency is real. This proposal introduces no currency table and makes no ISO-4217 claim.
- The operative rule is J.13: the code must equal the currency of the configuration version the record is bound to. Anything else is `rejected`, and in the case of a bound observation or an accepted transaction the mismatched row cannot be inserted at all, because the composite foreign key to `payment_configuration_version(payment_config_version_id, currency)` has no parent. No conversion, rounding, or re-scaling exists, and no exchange rate is introduced.
- Transaction, obligation, and allocation currency must be identical at allocation time (§12.3).

### 10.7 Failure handling

| Condition | Result |
|---|---|
| Malformed grammar (including any sign character) | `rejected`; no record written; validation error returned. |
| More than 18 integer digits or scale > 6 | `rejected`. |
| Zero amount | `rejected`. |
| Sum overflow beyond 18 integer digits | Operation refused; no partial write. |
| Currency mismatch with the bound configuration version | `rejected`; the row is also unrepresentable when the version is bound. |
| Currency mismatch at allocation time | Allocation refused; nothing persisted. |

No financial amount is ever parsed into a JavaScript floating-point number, at any layer, including tests.

---

## 11. SQLite Transactionality, Concurrency, and Failure Reporting

### 11.1 Failure classes are distinct

Revision 1 claimed that after three failed lock retries a `payment_evidence.write_failure` audit row is appended. That is not always possible: if the database is locked, the audit insert can fail for the same reason.

| Class | Detection | Handling |
|---|---|---|
| **Uniqueness conflict** | `SQLITE_CONSTRAINT_UNIQUE` / primary-key violation | Not an error. Resolve to the replay path: read the existing row, compare normalized content, return the original outcome (§4.3, §5.2, §12.2). |
| **`SQLITE_BUSY`** | Contention; database reachable | Bounded retry of the whole transaction (see 11.2). |
| **`SQLITE_LOCKED`** | Lock held, typically shared-cache or schema lock | Same bounded retry, distinct metric; not treated as busy. |
| **Stale compare-and-swap** | Projection `UPDATE` affected zero rows (§8.3) | Roll back; report `registration_superseded_concurrently`; do not silently retry. |
| **Other persistence failure** | I/O, disk, corruption | Fail the operation; no retry loop. |
| **Verification rejection** | Business outcome | Not an error: a `rejected` verification result is committed. |
| **Reconciliation conflict** | Detected inconsistency | Not an error: a conflict record is committed, or convergence returns the existing one. |

### 11.2 Bounded retry — a recommendation, not a guarantee

Proposed: retry the entire transaction up to 5 attempts with exponential backoff and jitter (base ~50 ms, cap ~1 s). This is a **technical recommendation to be validated during implementation**, not a guarantee that a write eventually succeeds. The whole transaction is retried, never a partially applied one; rollback precedes retry. A stale compare-and-swap is not retried automatically, because the correct response is to re-read the registration state and surface the conflict to the caller.

### 11.3 Audit integrity on failure

- When a write **succeeds**, the material records and their identifier-only audit rows commit in one transaction (I6). Either both exist or neither does.
- When a write **fails**, no audit row can be claimed. The failure is reported through an out-of-band operational channel (structured application log or metric) containing only: operation type, project identifier, record identifier if one was assigned before the failure, identity tuple digest where applicable, failure class, attempt count, and timestamp. No amounts, no currency, no provider payload, no credentials, no customer-sensitive content.
- The proposal explicitly does **not** claim a committed audit record for a failed write. Reporting a write failure as an "audit event" in the same database would be a false statement about durability.

### 11.4 No isolation claim

SQLite is not claimed to provide snapshot isolation. The guarantees relied on are: uniqueness constraints enforced by the database, `BEGIN IMMEDIATE` serialization of writers (§8.3, §12.3), and atomic commit. Readers may observe pre-commit state; nothing here depends on repeatable reads.

---

## 12. Slice 2B Allocation Model, Idempotency, and Concurrency

Slice 2B requires J.14 resolution before design approval and implementation authorization.

### 12.1 Allocation record

| Field | Requirement |
|---|---|
| `allocation_id` | Primary identity. |
| `allocation_request_id` | NOT NULL FK to `allocation_request`; one allocation per accepted request. |
| `payment_transaction_id` | NOT NULL FK to a canonical accepted transaction. |
| `obligation_id` | NOT NULL FK to an obligation of the same project. |
| `project_id` | NOT NULL; must equal both parents' project. |
| `allocated_amount`, `allocated_currency` | Exact decimal (§10) and the single currency of the configuration (J.13). |
| `effect_sign` | `+1` for an allocation, `-1` for a compensating record. |
| `compensates_allocation_id` | Nullable self-FK; required when `effect_sign = -1`. |
| `created_at` | Immutable timestamp. |

No `UPDATE` or `DELETE` path exists. Corrections are new rows.

The allocation's baseline is inherited, not chosen: the transaction carries its own bound configuration version (I8), the obligation carries the version it was issued under, and the allocation reads both immutably. Allocation requires **currency** identity across the three (§12.3 step 7) and does **not** require configuration-version equality. That distinction is deliberate: a payment observed under one version may legitimately fund an obligation issued under a later version when the currency is unchanged, but whether cross-version application is commercially permitted is a policy question that belongs to J.14 and is not decided here.

### 12.2 Mandatory, stable allocation-request idempotency

Revision 1 made `allocation_request` optional and fell back to `(transaction_id, obligation_id, allocated_amount, allocated_currency)`. That fallback is unsafe: two genuinely distinct allocation requests with identical values are indistinguishable, so a legitimate second request is discarded as a duplicate — or, worse, a replay is created because the values differ in scale.

Revision 2 removed the fallback entirely, and Revision 3 retains that:

- `UNIQUE(project_id, idempotency_key)`, where `idempotency_key` is an opaque caller-supplied request identifier.
- `payload_digest` records a canonical digest of the normalized request payload (transaction, obligation, exact normalized amount, currency).
- **Same key + same digest** → return the original recorded outcome; no second allocation, no state change.
- **Same key + different digest** → reject as an idempotency conflict (`409` semantics); nothing written.
- **Different keys** → distinct requests, even when monetary values are identical; each may succeed subject to I1 and I2.
- The request row, its recorded outcome, the allocation, and the audit row commit in one transaction. A replay reads the committed outcome and never re-executes.
- The database constraints — not application memory — enforce the contract.

### 12.3 Transactional allocation contract

Revision 1 relied on an application-level precheck executed outside the write transaction. Two concurrent requests can both pass it and both write, over-allocating.

Corrected contract — every allocation performs, in this order, inside one serialized write transaction:

1. `BEGIN IMMEDIATE` **before** reading any ceiling.
2. Resolve the request by `(project_id, idempotency_key)`; on replay with matching digest, return the recorded outcome and commit nothing new.
3. Re-read the canonical transaction: accepted amount and currency, its bound configuration version, and require that no open conflict blocks it (§6.4). Recompute `SUM(allocated_amount * effect_sign)` for that transaction **inside** the transaction.
4. Enforce I2: `existing_total + requested ≤ accepted_amount`. Compare exact decimals (§10).
5. Re-read the obligation: expected amount, currency, and project. Recompute `SUM(allocated_amount * effect_sign)` for that obligation **inside the same transaction**.
6. Enforce I1: `existing_total + requested ≤ expected_amount`.
7. Enforce currency identity across transaction, obligation, and allocation (J.13), and project identity across all three.
8. Apply the option-specific rule from §13 (for example Option C's single-obligation constraint, or Option D's required operator directive).
9. Insert `allocation_request` outcome, `allocation`, and the identifier-only audit row.
10. `COMMIT`.

**Concurrency prevention versus retry behavior are different concerns:** prevention is the serialized write plus inside-transaction recheck; retry is only a response to `SQLITE_BUSY`/`SQLITE_LOCKED` (§11.2) and always restarts the whole transaction. Neither substitutes for the other, and no application-level precheck outside the transaction is relied upon.

### 12.4 Unapplied funds

Because I1 and I2 are absolute, an accepted transaction may exceed what its obligations can absorb. The difference is **unapplied funds**: derived as `accepted_amount − Σ allocated`, never stored authoritatively, never auto-allocated, never auto-refunded (refund authority is J.6).

### 12.5 Allocation correction

- Corrections append a compensating record (`effect_sign = -1`, `compensates_allocation_id` set) with its own `allocation_request`.
- A compensating record may not exceed the allocation it compensates, and may not be created twice for the same allocation.
- Original allocations are never edited or deleted; history remains complete and balances are recomputed from the full ledger.
- **Conditions for creation:** an internal, authorized correction of an allocation entry error. That is all this proposal defines. Reversal of *received funds* (chargeback, refund, dispute) belongs to J.5 and J.6 and is **not** invented here; no reversal, refund, or chargeback behavior is specified.

---

## 13. Proposed Founder Decision J.14 and J.10 Separation

### 13.1 Status

> **Proposed new Founder decision J.14 — not yet approved and not yet part of the canonical decision register.**

The canonical register in `docs/decisions/2026-10-12-payments-project-activation.md` currently contains J.1 through J.13. J.14 exists only as a proposal. It becomes canonical only through separate Founder consideration and approval, recorded by the Founder in the canonical document. This proposal does not modify that document, does not assume approval, and recommends no default.

### 13.2 Why a decision is needed

The canonical design deliberately leaves partial-payment behavior open (§B.2, §D.4) and states that the impact of partial payments on obligation satisfaction depends on an explicit Founder-approved policy. J.4 (failure/retry), J.5 (reversals/disputes), and J.6 (refunds) do not cover allocation, ceilings, or partial satisfaction. Without J.14, Slice 2B has no defined satisfaction rule.

### 13.3 Eleven independent policy dimensions

Revision 1's four options were not independent: Option C largely repeated ceilings that every option already enforces, and Option D described *who* allocates rather than *what policy* applies. Revision 2 separated the decision into dimensions and requires each option to answer all eleven.

| # | Dimension | Question |
|---|---|---|
| D1 | Partial funds vs partial satisfaction | Are partial allocations recorded, and do they ever count toward satisfaction? |
| D2 | Multiple transactions → one obligation | Permitted? |
| D3 | One transaction → multiple obligations | Permitted? |
| D4 | Per-transaction ceiling | Is I2 absolute? (Proposed: yes, in every option.) |
| D5 | Per-obligation ceiling | Is I1 absolute? (Proposed: yes, in every option.) |
| D6 | Overpayments | What happens to accepted funds that no obligation can absorb? |
| D7 | Unapplied funds | Are they tracked, and may they be applied later? |
| D8 | Refund dependency | Which refund questions are deferred to J.6? |
| D9 | Correction and reversal | How are allocation errors corrected; what is deferred to J.5/J.6? |
| D10 | Duplicate request handling | Mandatory request identity and replay semantics (§12.2). |
| D11 | Allocation concurrency | Serialized write contract (§12.3). |

Revision 3 adds one cross-cutting note that does not create a twelfth dimension: whether funds observed under one configuration version may be applied to an obligation issued under another is part of D1–D3 as selected, and it is not assumed by the technical model (§12.1).

### 13.4 J.10 is not an allocation option

J.10 asks **who may make or override a manual payment-status determination**. It is required whenever that capability is proposed — regardless of which allocation option is selected. Revision 1 wrongly presented J.10 as relevant only under Option D.

The distinction:

- **Founder-directed allocation** is the act of deciding *which verified funds are applied to which obligation*. It assumes funds already verified (J.3) and moves no money.
- **Manual payment-status determination** is the act of asserting or overriding *whether an obligation is paid*, potentially against the verification record.

These are different capabilities with different misuse risk. The second is the highest-risk path in the design, remains governed by J.10, and is not authorized by any option in §13.5. If a future slice proposes it, J.10 must be resolved first, whichever allocation option is in force.

### 13.5 Options

All four options apply I1–I8, D4, D5, D8, D10, and D11 identically. They differ only where the matrix shows.

**Option A — All-or-nothing satisfaction.** Partial funds are accepted and recorded as allocations up to the remaining balance, and accumulate across transactions. An obligation is satisfied **only** when the sum of allocations equals its expected amount exactly. A partially funded obligation is never reported as partially paid; it is reported as not satisfied, with its remaining balance. Funds beyond what obligations can absorb stay unapplied. Rationale: simplest satisfaction rule, no partial-satisfaction commercial meaning.

**Option B — Partial satisfaction permitted.** An obligation with `0 < Σ allocated < expected` is `partially_paid`; it is satisfied at exact equality. Allocations accumulate across transactions; one transaction may be split across obligations. Funds beyond capacity stay unapplied. Rationale: partial payment carries commercial meaning and is visible as such.

**Option C — Single-obligation transactions.** Satisfying D3 = **No**: a transaction's funds may be applied to at most one obligation (at most one positive allocation per transaction, enforced by a partial unique index). Partial satisfaction is permitted as in B; multiple transactions may still fund one obligation. Consequence, stated as a policy cost: a transaction larger than its single obligation's need leaves the surplus permanently unapplied unless a later correction or J.6 refund addresses it. Rationale: simplest reconciliation — one payment, one obligation.

**Option D — Operator-directed allocation only.** No automatic allocation exists: every allocation requires a recorded internal operator directive (internal capability, audited, identifier-only). D1 follows the directive; D2 and D3 are permitted per directive; partial satisfaction permitted as directed. Funds beyond capacity stay unapplied. J.10 is **not** thereby satisfied: the operator directs verified funds, which is not a manual payment-status determination. Rationale: maximum commercial control, at the cost of throughput and operator dependency.

### 13.6 Comparison matrix

| Dimension | Option A | Option B | Option C | Option D |
|---|---|---|---|---|
| **D1** Partial allocation recorded | Yes | Yes | Yes | Yes, per directive |
| **D1** Partial obligation satisfaction | **No** — satisfied only at exact equality | **Yes** — `partially_paid` | **Yes** — `partially_paid` | **Yes** — as directed |
| **D2** Multiple transactions → one obligation | Yes | Yes | Yes | Yes, per directive |
| **D3** One transaction → multiple obligations | Yes | Yes | **No** — single obligation only | Yes, per directive |
| **D4** Per-transaction ceiling (I2) | Absolute | Absolute | Absolute | Absolute |
| **D5** Per-obligation ceiling (I1) | Absolute | Absolute | Absolute | Absolute |
| **D6** Overpayment handling | Excess stays unapplied | Excess stays unapplied | Excess stays unapplied; cannot move to another obligation | Excess stays unapplied |
| **D7** Unapplied funds tracked | Derived, non-authoritative | Derived | Derived | Derived |
| **D8** Refund dependency | J.6 (not invented here) | J.6 | J.6 | J.6 |
| **D9** Correction | Compensating append | Compensating append | Compensating append | Compensating append, directive required |
| **D9** Reversal of received funds | J.5/J.6 | J.5/J.6 | J.5/J.6 | J.5/J.6 |
| **D10** Request idempotency | Mandatory (§12.2) | Mandatory | Mandatory | Mandatory |
| **D11** Concurrency | Serialized (§12.3) | Serialized | Serialized | Serialized |

**No default is recommended.** Selecting an option is Founder authority, and the selection becomes canonical only when recorded in the canonical decision document.

### 13.7 What remains blocked per option

For every option: the satisfaction rule cannot be implemented, the obligation-state computation beyond `proposed` cannot be implemented, and the derived financial position cannot claim satisfaction. Option C additionally requires the single-obligation constraint. Option D additionally requires an internal directive mechanism and its authorization model. All options remain blocked on J.3 (evidence authority) and on separate Founder authorization.

---

## 14. Founder Decision Register

The canonical register contains J.1–J.13. This table reproduces its status accurately and adds the proposed J.14, which is not canonical.

| Decision | Subject | Status |
|---|---|---|
| **J.1** | Pricing and commercial authority | **Resolved** — Founder approval 2026-10-16: Founder sets amount and currency per project; no public pricing catalogue or automatic pricing. |
| **J.2** | Payment schedule and permitted arrangements | **Resolved** — 2026-10-16: full upfront; deposit plus later payments; milestone-linked. Additional structures require separate approval. |
| **J.3** | Authoritative payment evidence and its verification | **Unresolved.** Blocks the payment-evidence/state-machine slice. Not decided by this proposal. |
| **J.4** | Failed payments, retry policy, retry limits, dunning, notifications | **Unresolved.** No attempt/retry subsystem is designed here. |
| **J.5** | Reversals, chargebacks, and disputes | **Unresolved.** No reversal behavior is invented here. |
| **J.6** | Full and partial refunds — authority, policy, historical treatment | **Unresolved.** Refund authority and policy are not designed here. |
| **J.7** | Tax treatment and responsibilities | **Unresolved.** No tax logic is designed here; amounts remain Founder-defined. |
| **J.8** | Payment-provider selection and activation | **Unresolved.** Design stays provider-neutral with opaque references. |
| **J.9** | Exact project-activation conditions and trigger | **Unresolved.** The four-condition predicate remains a candidate. |
| **J.10** | Who may make or override a manual payment-status determination | **Unresolved.** Required whenever manual determination is proposed, under any J.14 option. |
| **J.11** | Retention and treatment of payment evidence | **Unresolved.** No retention period is invented. |
| **J.12** | Policy for payment events after activation | **Unresolved.** No deactivation path is designed. |
| **J.13** | Currency consistency within a configuration | **Resolved** — Founder approval 2026-10-20: one configuration, one currency; no mixed-currency obligations; no conversion. |
| **J.14** | Allocation, partial-payment, and overpayment policy | **NOT CANONICAL. Proposed only** — not approved, not in the canonical register. Eleven dimensions, four options (§13). |

**Unresolved decisions must never be converted into approved ones by a proposal, a test, or an implementation.** Where this document depends on an unresolved decision, it says so at the point of dependence.

---

## 15. Acceptance Tests, Threat Analysis, and Evidence-Quality Claims

No tests were executed during this documentation revision. Everything in §15 is a **proposed acceptance criterion**, not a reported result. Each criterion names the constraint, relation, or mechanism it exercises, so that a later implementation cannot pass it by application-level mimicry.

### 15.1 Transaction identity and correlation (2A)

| # | Test | Expected |
|---|---|---|
| 1 | Trusted registration accepted | Observation from a registered namespace verifies; `passed`. |
| 2 | Unregistered namespace | `rejected`; no observation accepted as evidence. |
| 3 | Delivery identity | Same `(source_registration_id, delivery_reference)` twice → one observation; second returns the original. |
| 4 | Same transaction via webhook **and** reconciliation import | One `provider_transaction_identity` row, one transaction, two observations, both correlated `provider_shared_reference`, funds counted once. |
| 5 | Same transaction via **two different registrations** (same account) | One identity, one transaction; both observations correlated; `UNIQUE(identity_id)` is what rejects the second transaction. |
| 6 | Cross-project identity collision | Second project's acceptance refused by `UNIQUE(identity_id)`; `rejected` verification; `cross_project_collision` conflict in the refusing project; owning project untouched; no counterparty identifier disclosed. |
| 7 | Different accounts, same provider reference | Two identities, two transactions — permitted where the tuple distinguishes them; asserted explicitly so the behaviour is not mistaken for a bug. |
| 8 | Unresolved observation exists without a transaction | Observation row present with no `payment_transaction_id` anywhere and no transaction row; query for accepted funds returns nothing. |
| 9 | Later correlation recorded without overwriting evidence | New `payment_transaction_observation` row; original observation columns unchanged; a contradicting correlation produces a conflict, not an update. |
| 10 | Conflict membership is relational | `reconciliation_conflict_observation` rows carry every participant; inserting the same `(conflict_id, observation_id)` twice fails on the primary key; no array column exists. |
| 11 | Observation cannot borrow a project | Insert with a `project_id` differing from its registration's fails on the composite foreign key. |

### 15.2 Verification and acceptance (2A)

| # | Test | Expected |
|---|---|---|
| 1 | Documented insertion order succeeds | Observation → verification → identity → transaction → correlation → acceptance commits without any deferred constraint. |
| 2 | Out-of-order insertion fails immediately | Acceptance before correlation is rejected by `(observation_id, payment_transaction_id)`; transaction before identity is rejected by its FK. |
| 3 | Verification of another transaction cannot be accepted | Acceptance whose `observation_id` is not correlated to that `payment_transaction_id` fails the composite FK to `payment_transaction_observation`. |
| 4 | Failed verification cannot be accepted | Insert with `verification_outcome = 'failed'` fails the check; attempting to assert `'passed'` while the parent row is `failed` fails the composite FK to `verification_result(verification_id, outcome)`. |
| 5 | Repeated attempts remain auditable | Three attempts for one observation produce three `verification_result` rows; failed ones keep their rows and gain no acceptance. |
| 6 | Only one accepted verification | A second acceptance for the same transaction, or for the same verification, fails `UQ(payment_transaction_id)` / `UQ(verification_id)`. |
| 7 | Concurrent acceptance attempts | Two racing acceptances: exactly one commits; the other fails on the unique index, not on a racy read. |
| 8 | Synthetic verification cannot be accepted as live | Acceptance whose verification is `synthetic` and whose transaction is `live` fails the classification composite FK; flipping one field is not sufficient because four tables must agree. |
| 9 | Unbound observation cannot pass | Verification of an observation with `config_binding_state <> 'bound'` cannot reach `passed` (check constraint). |

### 15.3 Configuration baseline (2A)

| # | Test | Expected |
|---|---|---|
| 1 | Transaction bound to its own version | `payment_transaction.payment_config_version_id` equals the establishing observation's captured version, enforced by composite FK; no code path can supply a different one. |
| 2 | Later version does not reinterpret history | Accepting under version *n+1* leaves the existing transaction's version, amount, and currency byte-identical; a second transaction for the same identity is refused. |
| 3 | Currency mismatch rejected | Observation or transaction with a currency different from its bound version's cannot be inserted (composite FK to `payment_configuration_version(payment_config_version_id, currency)`). |
| 4 | Missing baseline never silently accepted | Observation with `unbound_no_configuration` retains evidence, produces no transaction, and yields no accepted funds. |
| 5 | Ambiguous baseline never silently resolved | `unbound_ambiguous` behaves as (4); no "pick the latest version" fallback exists. |
| 6 | Stale baseline fails closed | Bound version whose proposal/agreement references are no longer current yields `failed` / `config_baseline_stale`; evidence retained; no acceptance. |
| 7 | Cross-project version rejected | Observation referencing another project's configuration version fails the composite project key. |

### 15.4 Registration lifecycle (2A)

| # | Test | Expected |
|---|---|---|
| 1 | One current registration per scope | Second current row for the same `(project_id, provider_account_id, source_kind, source_namespace)` fails the projection primary key. |
| 2 | Concurrent replacement | Two simultaneous replacements: exactly one compare-and-swap matches; the loser rolls back and reports `registration_superseded_concurrently`; the projection never holds two currents. |
| 3 | Valid successive chain | R1 → R2 → R3 permitted; history intact; projection points at R3. |
| 4 | Duplicate successor rejected | Two registrations both naming R1 as `supersedes_registration_id` fail `UQ(supersedes_registration_id)`. |
| 5 | Cycle and backdating rejected | A successor whose `created_at` is not strictly greater than its parent's fails the check constraint; a self-supersession fails the self-reference check. |
| 6 | Registration never defines funds identity | Replacing the registration does not change any existing transaction's identity or ownership; no transaction references a registration. |

### 15.5 Conflict lifecycle (2A)

| # | Test | Expected |
|---|---|---|
| 1 | Duplicate open conflict converges | The same condition detected twice with the same participants and trigger produces the same `conflict_key`; the second insert fails `UQ(project_id, conflict_key)` and the write path returns the existing conflict id. |
| 2 | New episode representable | A new triggering delivery over a different participant set produces a different key and a new conflict row, legally, while the earlier conflict stays resolved. |
| 3 | Resolution is auditable | `conflict_resolution` row carries kind, deciding actor, timestamp, and rationale code; the conflict row is untouched. |
| 4 | Resolved conflict retains history | After resolution, the conflict, its membership, and its resolution all remain queryable; "open" is false only because a resolution row exists. |
| 5 | Double resolution rejected | A second resolution for the same conflict fails `UQ(conflict_id)`. |
| 6 | Conflict membership cannot cross projects | A membership row pairing a conflict and an observation from different projects fails the composite project keys. |

### 15.6 Supersession lifecycle (2A)

| # | Test | Expected |
|---|---|---|
| 1 | Valid successive supersession | V1 superseded by V2, V2 by V3: chain resolves to V3; each row immutable. |
| 2 | Branching rejected | V1 superseded by V2 and by V3 fails `UQ(superseded_verification_id)`. |
| 3 | Duplicate successor rejected | Two rows naming the same successor for the same predecessor fail the same constraint. |
| 4 | Cycle rejected | V2→V1 after V1→V2 fails the strict-ordering check; a self-supersession fails the self-reference check. |
| 5 | Cross-project supersession rejected | Superseding a verification owned by another project fails the composite project key. |
| 6 | Automated revocation only | Slice 2A refuses `authority_kind = 'human'`; revocation requires an approved J.3 rule, and a later `failed` attempt alone changes nothing. |

### 15.7 Schema and integrity (2A)

| # | Test | Expected |
|---|---|---|
| 1 | Every foreign key has a legal insertion sequence | A generated schema-path test inserts one row per table in the §5.2 order and commits; no deferred constraint is needed. |
| 2 | No undefined column or constraint | Schema introspection confirms every column named in §5.3 exists, and every check references only columns of its own table. |
| 3 | No uniqueness rule depends on a derived state | Every unique constraint is either a natural key or a primary key; no `is_active`/`status` column is referenced by any index. |
| 4 | Every table has a primary key | Introspection: zero tables without one. |
| 5 | Append-only enforced | No update/delete path for observations, verifications, transactions, acceptances, correlations, conflicts, memberships, resolutions, or supersessions; the single mutable projection is the registration pointer. |
| 6 | Audit uses only current identifiers | Writing `evidence_id` is rejected; every accepted key appears in §8.6; forbidden patterns (`amount`, `currency`, `reference`, `signature`, `secret`, `token`, `payload`) are rejected. |

### 15.8 Decimal, currency, and classification (2A)

| # | Test | Expected |
|---|---|---|
| 1 | Grammar | `1500`, `1500.00`, `1500.000` normalize identically; `+1500`, `-1500`, `1e3`, `1,500`, ` 1500` rejected; 19 integer digits and scale 7 rejected. |
| 2 | Zero rejected | `0` and `0.00` rejected for observations and allocations. |
| 3 | Exact comparison | `1500` = `1500.00`; `1500` ≠ `1500.01`; `"900"` not ranked above `"1500"`; no float parsing at any layer. |
| 4 | Currency normalization | Case-insensitive normalization only; matching is exact against the bound version; no conversion, no exchange rate. |
| 5 | Classification propagation | Transaction classification must equal its establishing observation's; acceptance must equal both parents'; a mismatch fails a composite foreign key. |
| 6 | Verifier field combinations | `test_fake` + `verified_by` set rejected; `test_fake` + `system_clock` rejected; `test_fake` + `live` rejected; `automated` + `verified_by` set rejected; `automated` without `verifier_reference` rejected. |

### 15.9 Slice 2B acceptance criteria

| # | Test | Expected |
|---|---|---|
| 1 | Mandatory request idempotency | Allocation without an idempotency key is refused by schema. |
| 2 | Same request replay | Returns the recorded outcome; no second allocation. |
| 3 | Same key, different payload | Idempotency conflict; nothing written. |
| 4 | Two legitimate identical-value requests | Different keys → two allocations permitted, subject to I1/I2. |
| 5 | Transaction ceiling (I2) | Allocation exceeding accepted amount refused; nothing written. |
| 6 | Obligation ceiling (I1) | Allocation exceeding expected amount refused; nothing written. |
| 7 | Concurrent allocation requests | Two racing requests cannot both pass; serialized write + inside-transaction recheck admits exactly one. |
| 8 | Atomic allocation + audit | Both or neither. |
| 9 | Correction without mutation | Compensating record appended; original intact; balance recomputed; double compensation refused. |
| 10 | Cross-project allocation | Transaction, obligation, and allocation project mismatch refused. |
| 11 | Currency mismatch | Transaction/obligation/allocation currency disagreement refused. |
| 12 | Overpayment and unapplied funds | Per selected option: excess remains unapplied and is never auto-allocated or auto-refunded. |
| 13 | Blocked transaction cannot fund | A transaction with an open conflict cannot be allocated from (§6.4), even if it has accepted funds. |
| 14 | Baseline is inherited, not chosen | Allocation writes no configuration version of its own; it reads the transaction's and obligation's immutable versions. |

Slice 2B tests are not Slice 2A acceptance criteria.

### 15.10 Threat analysis (Slice 2A)

| Threat | Defense |
|---|---|
| Double-counting across channels, registrations, or projects | Global identity registry + `UNIQUE(identity_id)` (I7, §4.3); correlation recorded (§4.5); unresolved conflicts block use (§6.4). |
| Duplicate delivery | Delivery uniqueness; replay returns the original record. |
| Forged or untrusted namespace | Registration-based trust; matching a string is not authentication (§7.1). |
| Cross-project access or collision | Server-side project resolution; project composite keys; collision refusal (§7.5). |
| Phantom payment invented to satisfy a foreign key | Observation has no transaction column; acceptance requires a correlation row (§5.2). |
| Evidence fabricated as live payment | Four-table classification with propagation keys; verifier field checks (§9.2). |
| Silent revocation of accepted funds | Supersession requires an explicit record with unique successors and acyclic ordering (§8.5). |
| Retroactive re-pricing of historical funds | Immutable `NOT NULL` baseline binding (I8, §5.4). |
| Audit leakage | Identifier allowlist enforced at write (§8.6). |
| Funding double-count via allocation | Out of 2A; prevented in 2B by I1/I2 inside a serialized transaction (§12.3). |
| Float or lexicographic money errors | Exact decimal contract (§10). |

### 15.11 Test-count and evidence-quality accuracy

- Revision 1 claimed "328 tests pass" and reused that number as evidence for unchanged behavior. **No fresh evidence supports 328.**
- The recorded result for PR #54 at head `51a796a` is: **321 passed** (implementation-agent-reported), plus typecheck and build passing, plus fresh GitHub checks (Website CI, Dependency Review, CodeQL, Snyk) reported as successful on that head.
- Those are **historical, agent-reported** results for a rolled-back slice. They are not current, not independently reproduced here, and not evidence about code that is not in `main`.
- No test was executed during Revision 3. Reported results, independently verified results, and proposed acceptance criteria are labelled separately and never merged.

---

## 16. Exclusions, Readiness Verdict, and Correction Record

### 16.1 Explicit exclusions

Excluded from Slice 2A: allocations; allocation requests; obligation linkage on evidence; obligation states beyond `proposed`; payment attempts, retries, dunning, notifications; manual determination; customer upload or any customer write; activation predicate or event; provider integration, webhook receiver, credentials; production or live customer data; mutable `status` columns; mutable `blocks_use` columns; ID arrays in any record; caller-controlled trust; snapshot-isolation claims; audit events for failed writes; fabricated test-pass claims.

Excluded from Slice 2B as of this revision: any satisfaction rule before J.14; refund, reversal, chargeback behavior (J.5/J.6); activation integration (J.9); provider integration (J.8).

Excluded from this task entirely: application source, tests, schemas, migrations, dependencies, workflows, governance documents, and any additional repository change — including separate audit reports, scratch files, diagrams, executable tests, or schema files.

### 16.2 Readiness verdict

| Slice | Verdict | Reason |
|---|---|---|
| **Slice 2A** | Design proposal only — **not authorized for implementation** | Requires J.3 resolution before any evidence implementation, per the canonical register. Synthetic only. No obligation satisfaction. |
| **Slice 2B** | Design proposal only — **not authorized for implementation** | Requires J.14 resolution, J.3 resolution, and separate Founder authorization. |

Neither slice is authorized. No provider is selected. No payment was processed. No project was activated. No deployment occurred.

### 16.3 Correction record

**Revision 1 corrections (retained):**

| Issue | Correction |
|---|---|
| A — Append-only contradiction | Mutable evidence status removed; verification results are separate append-only records. |
| B — Out-of-scope source kinds | `customer_upload` and `manual_determination` excluded from Slice 2A. |
| C — Source identity | Delivery-scoped identity introduced (superseded twice: by Revision 2 §4, then by Revision 3 §4.3). |
| D — J.14 rewrite | Rewritten as options (superseded by Revision 2 §13, which made the options independent). |
| E — Allocation model | Normalized allocation records; no arrays of allocation IDs. |
| F — Attempts, states, SQLite | Attempts excluded; no `failed` obligation state; snapshot isolation not claimed. |

**Revision 2 corrections (retained):**

| Finding | Original problem | Correction | Section |
|---|---|---|---|
| **A** | One provider transaction could be accepted twice through different channels. | Three identities — delivery, canonical transaction, allocation — with uniqueness, correlation basis, and blocking of unresolved correlations. | §4 |
| **B** | No defined evidence → transaction → configuration → obligation relationship. | Full record model with identities, FKs, ownership, baseline, immutability, idempotency, authority. | §5 |
| **C** | `reconciliation_conflict` used as an outcome while absent from the enum. | Outcome enum fixed; conflicts became a separate record; supersession made explicit. | §6 |
| **D** | `fake_verifier` returned passed with a Founder identity. | Test-only verifier, fail-closed production path, `verified_by = NULL`, explicit `verified_by` semantics. | §9 |
| **E** | J.14 non-canonical status unclear; options not independent; J.10 tied to Option D. | J.14 labelled proposed; eleven dimensions; four options; comparison matrix; J.10 separated. | §13 |
| **F** | Allocation relied on a check-then-write precheck. | Serialized write, inside-transaction rechecks, atomic writes, defined busy/rollback/replay behavior. | §12 |
| **Finding 9** | Strings preserved but arithmetic undefined. | Grammar, precision limits, normalization, exact comparison and arithmetic, overflow, no floats. | §10 |
| **Finding 10** | Claimed an audit row after failed lock retries. | Failure classes separated; audit guaranteed only for successful writes. | §11 |
| **Finding 11** | Trust boundary under-specified. | Eight explicit rules. | §7 |
| **Finding 12** | Governance reconciliation handled loosely. | Verified facts table; five-way distinction; explicit unresolved inconsistency. | §3 |
| **Finding 13** | J.7 missing. | Full J.1–J.13 register plus proposed J.14. | §14 |
| **Finding 14** | Schema/test mismatch; unsupported count claim. | Test matrix rebuilt; count claim corrected. | §15 |
| **Finding 15** | Misnumbered sections, duplicated content. | Numbering normalized; duplicate removed; 16 sections. | Whole document |

**Revision 3 corrections:**

| Finding | Original problem | Correction | Mechanism | Section |
|---|---|---|---|---|
| **A** | Canonical key `(source_registration_id, provider_transaction_reference)` was channel- and project-scoped, so the same funds movement could be accepted twice across registrations or projects. | Identity moved into a global `provider_transaction_identity` registry keyed on provider account reference, environment, provider key, and provider transaction reference; the transaction references it once; the registration id was removed from the key and from the transaction row. | `UNIQUE(provider_key, provider_environment, provider_account_reference, provider_transaction_reference)`; `UNIQUE(payment_transaction.identity_id)` | §4.2–§4.6, §5.3 |
| **B** | Unresolved observations were said to exist without a transaction while the schema required one; conflicts used an `observation_ids` array; `correlation_basis = 'unresolved'` needed a transaction in order to say there was none. | Observation has no transaction column at all; correlation is a relation; unresolved is the absence of a correlation row plus an open conflict; conflict membership is a relation. | Absence of FK; PK `(observation_id, payment_transaction_id)`; PK `(conflict_id, observation_id)` | §4.4, §4.5, §6.3, §5.3 |
| **C** | `verification_result.payment_transaction_id` ↔ `payment_transaction.accepted_verification_id` formed a circular FK dependency under immediate enforcement, and no insertion order existed. | Verification references only its observation. A new `payment_transaction_acceptance` record references transaction, verification, that verification's observation, and the correlation row proving belonging. Insertion order is linear; no deferred constraint. | `UQ(payment_transaction_id)`, `UQ(verification_id)`, composite FK `(observation_id, payment_transaction_id)` → correlation, composite FK `(verification_id, verification_outcome)` → `(verification_id, outcome)` with `CK(verification_outcome = 'passed')` | §5.2, §6.2, §5.3 |
| **D** | The transaction's baseline was "none" in the record model while other sections assumed a configuration version; no rule governed a later configuration change. | Observation captures the configuration version in force at ingestion or is stored explicitly unbound; transaction copies it and is `NOT NULL`; currency is tied to the version; later versions never reinterpret earlier transactions; stale baseline fails closed. | `NOT NULL` FK; composite FK `(payment_config_version_id, currency)`; `CK((config_binding_state = 'bound') = (payment_config_version_id IS NOT NULL))`; composite FK from transaction to its source observation's version | §5.4, §4.4, §15.3 |
| **E** | `verifier_kind`, `verified_by`, `verifier_reference`, `verified_at_source`, `data_classification` were referenced by constraints but defined in no table. | Complete column catalogue for every 2A table; verifier fields defined once with owner, domain, nullability, default, key role, checks, immutability, and lifetime; classification placed on four tables with propagation keys. | Nine check constraints on `verification_result`; classification composite FKs across observation, verification, transaction, acceptance | §5.3, §9.2 |
| **F** | "One active registration", "one open conflict", and "terminal supersession" were asserted with no stored state, key, or concurrency rule; a partial unique index over a derived status cannot be enforced. | Current-registration projection with a primary key plus compare-and-swap inside `BEGIN IMMEDIATE`; deterministic conflict key with a unique constraint; unique successor plus carried-timestamp ordering for acyclic, terminal, non-branching supersession. | PK `(project_id, provider_account_id, source_kind, source_namespace)`; `UQ(project_id, conflict_key)`; `UQ(superseded_verification_id)` + `CK(superseding_created_at > superseded_created_at)` | §8.3, §8.4, §8.5 |
| **Decimal grammar** | The grammar permitted an undefined `signed` production while the policy rejected negative amounts. | `signed` deleted; grammar defined over unsigned integers and fractions only; direction expressed by `effect_sign`, never by a negative amount. | Grammar in §10.1; zero rejected; sign characters rejected | §10.1, §10.3, §10.5, §10.7 |
| **Audit allowlist** | The allowlist named `evidence_id`, which exists in no table, and omitted identifiers the corrected model actually produces. | Allowlist aligned with the final model: `evidence_id` removed; `acceptance_id`, `identity_id`, `resolution_id`, `supersession_id`, `provider_account_id` added; forbidden patterns widened. | Allowlist rejection at write plus a forbidden-pattern test | §8.6, §15.7 |

### 16.4 Open dependencies this revision does not resolve

Technical dependencies (all documented, none hidden):

1. **Acceptance of funds received against a stale commercial baseline.** Slice 2A fails closed (`config_baseline_stale`) because the canonical decision governs the activation gate, not retrospective evidence handling. Whether such funds may later be accepted, and against which baseline, is undecided (§5.4).
2. **Cross-version allocation.** Whether funds bound to one configuration version may fund an obligation issued under another is left to J.14 as selected; the technical model requires currency identity only (§12.1).
3. **Configured naming of the C-slice columns.** `payment_configuration_version(project_id, currency, proposal_version_id, agreement_version_id)` is stated against a table that is not in `main`; the names must be confirmed against the restored schema at implementation (§3.3).
4. **Ownership arbitration for a contested identity.** The database guarantees that only one transaction can exist per identity; which project wins is decided by which write commits first. Any rule beyond first-writer-wins — for example a Founder-directed assignment — does not exist and is not assumed (§8.2).

Founder decisions (unchanged and unresolved):

- J.3 (authoritative evidence and verification) blocks Slice 2A entirely; it also governs `verified_mapping` correlation, supersession authority, and the resolution rules that may close conflicts.
- J.10 governs any manual determination; `verifier_kind = 'human'` and human-authored resolutions are outside Slice 2A by construction.
- J.4, J.5, J.6, J.7, J.8, J.9, J.11, J.12 remain unresolved and are not decided here.
- J.14 remains proposed and non-canonical; Slice 2B is blocked on it.

Governance dependencies (unchanged):

- The canonical-decision/Project-Map approval contradiction (§3.3) remains open and requires a separate Founder-authorized correction.
- Restoration of the rolled-back initial slice remains a separate act requiring separate authorization; nothing here implies it.

---

## Final Statement

This document is a **documentation-only revision**, containing 16 numbered sections. It changes exactly one file: `review-artifacts/payment-slice-2-revised-proposal.md`, published to `review/payment-slice-2-proposal-clean` and reflected in the existing Draft pull request #68 against `main`.

It does not modify application code, tests, schemas, migrations, dependencies, workflows, or governance documents. It does not restore rolled-back implementation, select a provider, add credentials, process payments, activate a project, or deploy anything. It does not merge, close, or promote PR #68.

No Founder decision is resolved by this document. J.14 remains proposed and non-canonical. The canonical-decision/Project-Map approval contradiction remains open and requires separate Founder-authorized correction. Slice 2A and Slice 2B remain unauthorized for implementation.

Revision 3 is offered for independent architectural review of the corrected model, and for nothing further.
