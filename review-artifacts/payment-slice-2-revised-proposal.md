# Payment Slice 2 — Revised Proposal, Revision 5 (Documentation-Only)

## Revision Scope and Authority Statement

This document is the fifth corrective revision of the Payment Slice 2 proposal. Its **content** is documentation only: it modifies no application source, no tests, no migrations or schemas, no dependencies, no workflows, and no governance documents (`docs/decisions/2026-10-12-payments-project-activation.md`, `docs/project-map.md`, `CONSTITUTION.md`).

Its **publication** is a separate fact that must be stated rather than elided: this revision is published by committing this one Markdown file to branch `review/payment-slice-2-proposal-clean` and updating the existing Draft pull request #68. That publication created a commit and updated a pull request. It created no implementation, no schema, no provider integration, and no deployment. Publishing documentation is not implementation authorization.

Revisions 1–3 corrected architectural, data-integrity, concurrency, security, and governance defects. Revision 4 corrected seven **relational-integrity** defects, in which a record was linked to its parent by a foreign key that proved *a row existed* but not that the row was *the right one* — the correct project, provider account, observation, configuration version, or lifecycle scope. Those seven corrections are retained unchanged.

Revision 5 addresses four findings from independent review of Revision 4, plus one identity-lifecycle limitation that review surfaced alongside them. Three findings are **evidence-integrity** defects: Revision 4 proved that linked records shared a *scope* while leaving the *content* they jointly assert — a provider reference, an accepted amount, a participant set — unproven or unfixed. The fourth is a **validation** defect: a `LIKE` shape check was credited with digit checking that SQLite does not perform. The fifth is a **lifecycle asymmetry**: Revision 4 named a transaction without an acceptance but not an identity without a transaction.

- **1** — the transaction proved that its identity, its project binding, and its establishing observation belonged to the same global account and project, but not that the provider transaction *reference* on the observation equalled the one inside the identity. Account agreement was proven; funds-movement agreement was asserted.
- **2** — the transaction carried an accepted amount with no structural relationship to the amount its establishing observation reported, so evidence for one amount could support accepted funds of another.
- **3** — the conflict digest hashed the participant set, but membership stayed open after the digest was written, so the stored key could stop matching the rows it was computed from.
- **4** — the canonical-timestamp check used `LIKE '____-…'`, where `_` matches *any* character, so a timestamp whose digit positions held letters satisfied the constraint.
- **5 (limitation)** — a `provider_transaction_identity` row can exist without a `payment_transaction`, because SQLite cannot enforce a mandatory child. Revision 4 named the converse; the orphan-identity direction was unnamed, and an unnamed orphan is one an untrusted claimant could attempt to absorb.

Revision 5 closes the first four with a composite key, an immutable seal, or a trigger, and the fifth with an explicitly fail-closed handling rule that is labelled as an application-level guarantee. Where a guarantee cannot be expressed as a SQLite constraint, the document says so at the point of the claim and never relabels the claim as enforced.

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
| **I9** | A foreign key is necessary but not sufficient. Every reference that carries a scope (project, provider account, global account identity, observation, configuration version, classification, lifecycle) must be proven by a composite key, not asserted by application code or by column naming. |
| **I10** | Ordering between two lifecycle records is proven by an integer sequence allocated inside the serialized write transaction and carried into the child row by a composite key. Clock text is descriptive only; it never decides precedence. |
| **I11** | One observation correlates to at most one canonical transaction. One transaction may have many observations. One transaction is accepted by at most one verification. |
| **I12** | No failed or rolled-back write leaves a durable reservation of a global provider transaction identity. |
| **I13** | The provider transaction reference a transaction records is equal to the reference held by its global identity and to the reference carried by its establishing observation; every observation correlated to that transaction carries the same global account identity and the same non-empty reference. |
| **I14** | A transaction's accepted amount and scale are exactly those of the establishing observation, with no fee, deduction, refund, reversal, or conversion applied in Slice 2A. |
| **I15** | A conflict becomes authoritative only when its participant set is sealed; membership is immutable from that point, and a later disagreement is a new conflict, never an addition to a sealed one. |

---

## 1. Executive Summary and Revision Scope

Payment Slice 2 is the design for what a project owes and what has been paid, built on the already-approved provider-neutral design in `docs/decisions/2026-10-12-payments-project-activation.md`. That design is Founder-approved; its implementation is not, except for one limited initial slice whose approval status is itself contested between the canonical decision and the Project Map (§3.3).

This revision keeps the two-slice split:

- **Slice 2A — Verified Payment Evidence and Canonical Transaction Foundation.** Trusted provider-account identity, source registrations, observations, verification results, acceptance records, canonical transactions, correlation, conflicts, supersession, exact decimal handling, project isolation, identifier-only audit. Synthetic/test data only. No allocation, no obligation satisfaction.
- **Slice 2B — Allocation and Derived Financial Position.** Allocation requests, allocations, transaction-level and obligation-level ceilings, derived balances, compensating corrections, and a serialized allocation write contract.

The substantive corrections in Revision 5:

1. **The provider transaction reference is equal on the identity, on the establishing observation, and on every correlated observation (§4.4, §5.3).** The observation records its global account identity and, when it carries one, its provider reference; the transaction stores the reference and proves it equal to both parents by composite key; the correlation relation repeats identity and reference and references both parents' keys. Scope agreement is joined by funds-movement agreement.
2. **A missing reference cannot enter the evidence chain (§4.7, §6.2).** Correlation requires a non-empty reference, so an observation without a trustworthy reference can never be correlated and therefore never accepted. No protection depends on a NULL surviving a `MATCH SIMPLE` composite key.
3. **The accepted amount is the establishing observation's amount, structurally (§5.3, §10.4).** `(source_observation_id, accepted_amount_normalized, accepted_amount_scale)` references an observation parent key, and both amount columns carry a canonicality check, so an accepted amount that contradicts its evidence cannot be inserted (I14).
4. **Conflict membership is sealed and immutable (§6.4, §8.4).** A seal relation and three triggers fix the participant set at the moment the conflict becomes authoritative, reject membership inserted after sealing, and reject any update or delete of sealed membership (I15).
5. **Timestamp validation checks digits, not only separators (§8.5).** `GLOB '[0-9]…'` replaces the `LIKE` pattern; field ranges that are decidable as fixed-width text are checked, and month-length and leap-year validity are stated as application-validated rather than implied.
6. **An orphan identity fails closed (§6.3, §8.2).** An identity with no transaction is an integrity anomaly, not a free slot: never auto-assigned, never duplicated, never used to disclose an owner, and never cleared without an authorized internal recovery procedure.

Revision 4's seven corrections, and Revisions 1–3 before them, are retained in full; §16.3 records all five revisions. Sections 14–16 consolidate the decision register, the acceptance matrix rebuilt around the corrected schema, and the cumulative correction record.

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

The `node:sqlite` fact matters for this revision: every constraint mechanism named below was chosen because SQLite enforces it (unique indexes, check constraints, composite foreign keys against a declared parent key, and immediate foreign-key enforcement), and no mechanism relies on a feature SQLite does not provide. Two of the rules below are naturally cross-row, and both are expressed structurally rather than assumed. **Ordering** is an integer sequence scoped to its parent and carried into the child row, so a composite foreign key proves the carried value is the parent's real sequence and a local check compares two columns of the same row (§8.5). **Scope** is expressed by repeating the scope columns in the child and referencing a composite parent key, so "same project", "same account", "same observation", and "same baseline" are key matches rather than assertions (§4.4). Where neither technique is available, the document says so explicitly instead of describing an application rule as a constraint — §8.2 ends with that list, and §16.4 repeats it.

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

### 4.1 What Revision 4 still left unproven

Revision 3 removed the registration from the canonical key, which was necessary. Revision 4 then proved that the identity, the project binding, and the establishing observation described the same account and the same project. It did not prove that they described the same **funds movement**.

The remaining gap was a reference, not a scope. After Revision 4 the following insert was legal:

```text
observation:  provider_account_id = ACCOUNT_A
              provider_transaction_reference = CHARGE_100
transaction:  provider_account_identity_id = ACCOUNT_A_GLOBAL
              identity_id = IDENTITY_FOR_CHARGE_200
              source_observation_id = OBSERVATION_FOR_CHARGE_100
```

Every composite key in Revision 4 is satisfied: the identity belongs to account A, the binding belongs to account A, the observation belongs to account A and to the project, and the baseline, currency, and classification agree. The transaction nevertheless records the acceptance of charge 200 on the strength of evidence about charge 100. Account agreement had been made structural; funds-movement agreement was still asserted by whichever code wrote the row.

Two further content-level gaps had the same shape:

- **Amount.** The transaction carried `accepted_amount_normalized` / `accepted_amount_scale` with no relationship to the observation's `amount_normalized` / `amount_scale`. A ₹10,000 observation could support a ₹1,000 accepted transaction while every scope key passed.
- **Correlation basis.** `correlation_basis = 'provider_shared_reference'` described *how* a second observation was joined, but nothing forced the joined observation to carry the same account identity and the same reference as the transaction. The basis was a label, not a constraint.

Revision 5 answers all three the same way Revision 4 answered scope: **carry the value into the child row and prove it against a composite parent key**, so equality is part of the key match rather than a promise made by the writer.

### 4.2 Identity levels: global account versus project binding

A provider account is a real thing at the provider. A project's use of that account is a separate, project-scoped fact. Revision 3 collapsed both into `payment_provider_account`, whose `account_reference` was unique only within a project (`UNIQUE(project_id, provider_key, environment, account_reference)`). That made the global transaction key correct only by accident: the global tuple repeated the account *string* rather than referencing an account *record*.

Revision 4 separated the two levels, and Revision 5 adds the funds-movement reference as a first-class part of the chain:

| Identity | What it identifies | Record | Key | Scope |
|---|---|---|---|---|
| **Global provider account identity** | The real merchant/provider account | `provider_account_identity` | `UQ(provider_key, provider_environment, provider_account_reference)` | **Global** — one row however many projects use it |
| **Project account binding** | One project's authorized use of that account | `payment_provider_account` | `provider_account_id`; `UQ(project_id, provider_account_identity_id)` | One project |
| **Provider transaction identity** | One funds movement at the provider | `provider_transaction_identity` | `UQ(provider_account_identity_id, provider_transaction_reference)` | Global within the account |
| **Source registration** | How an observation may enter the system | `payment_source_registration` | `source_registration_id`; versioned by `revision_seq` | One project + binding + channel + namespace |
| **Observation** | One incoming delivery | `payment_observation` | `observation_id`; `UQ(source_registration_id, delivery_reference)` | One registration; carries its global account identity and, when present, the provider reference |
| **Canonical transaction** | What this system accepted as funds | `payment_transaction` | `payment_transaction_id`; `UQ(identity_id)` | One project; carries the identity's reference and the evidence's amount |
| **Project association** | Which project owns the accepted funds | `payment_transaction.project_id` | `(payment_transaction_id, project_id)` | One project per transaction |

Three structural consequences follow:

1. **Environment lives on the global account identity only.** `provider_environment` is not repeated on the transaction identity or the transaction. A test account and a live account with the same provider reference are two global account identities, therefore two transaction identities, therefore two funds movements. The separation is a consequence of the foreign key, not of remembering to compare a string.
2. **The observation carries `provider_account_identity_id`.** It is derivable from its binding, but *derivable is not enforced*: the value is stored and then proven equal to the binding's identity by a composite key (§4.4). Without it, a transaction could cite an observation from a binding that had since been rebound to a different global account, and only the binding — not the observation — would be checked.
3. **The transaction carries `provider_transaction_reference`.** It is derivable from `identity_id`, but a `CHECK` cannot join, so the value is stored and proven equal to the identity's reference *and* to the observation's reference by two separate composite keys. This is the technique the design already uses for ordering (§8.5) and classification (§9.2): put the compared value on the row, then prove it genuine with a key.

### 4.3 The enforceable canonical uniqueness rule

```sql
-- global account identity
CREATE TABLE provider_account_identity (
  provider_account_identity_id TEXT PRIMARY KEY,
  provider_key                 TEXT NOT NULL,
  provider_environment         TEXT NOT NULL CHECK (provider_environment IN ('test','live')),
  provider_account_reference   TEXT NOT NULL,
  first_registered_at          TEXT NOT NULL,
  UNIQUE (provider_key, provider_environment, provider_account_reference)
);

-- one funds movement, globally, inside that account
CREATE TABLE provider_transaction_identity (
  identity_id                 TEXT PRIMARY KEY,
  provider_account_identity_id TEXT NOT NULL
    REFERENCES provider_account_identity(provider_account_identity_id),
  provider_transaction_reference TEXT NOT NULL,
  first_observed_at           TEXT NOT NULL,
  UNIQUE (provider_account_identity_id, provider_transaction_reference),
  UNIQUE (identity_id, provider_account_identity_id),
  UNIQUE (identity_id, provider_account_identity_id, provider_transaction_reference)
);
```

The global uniqueness key is therefore `(provider_key, provider_environment, provider_account_reference)` for the account, and `(provider_account_identity_id, provider_transaction_reference)` for the funds movement. The second key is global because the account identity is global: two projects that bind the same merchant account reference the *same* `provider_account_identity_id`, so their transaction keys collide by construction rather than by string comparison.

The third key is new in Revision 5 and exists only to be a parent. It lets a child prove three things at once — *this identity*, *this global account*, *this reference* — in a single key match. Without it, a child can prove the identity belongs to the account (two columns) and must then trust that the identity's reference is whatever the child wrote.

`provider_key` and `provider_account_reference` remain opaque strings naming a provider implementation and an account. No provider is selected, named, or integrated; `'fake_provider'` is the only value Slice 2A produces, and this is the provider-neutral posture of J.8, not a provider choice.

### 4.4 How a transaction proves its identity, account, reference, amount, and observation

The transaction stores eight scope-bearing columns: `identity_id`, `provider_account_identity_id`, `provider_transaction_reference`, `provider_account_id`, `project_id`, `source_observation_id`, `accepted_amount_normalized`, `accepted_amount_scale`. Ten composite keys bind them to their evidence, and two further keys bind the commercial baseline and its currency:

| Claim the design must prove | Constraint | What a weaker key would have allowed |
|---|---|---|
| The identity is that exact funds movement in that exact global account | FK `(identity_id, provider_account_identity_id, provider_transaction_reference)` → `provider_transaction_identity(identity_id, provider_account_identity_id, provider_transaction_reference)` | Citing account A's identity for charge 200 while recording charge 100 (Revision 4's gap) |
| The establishing observation carries that same reference | FK `(source_observation_id, provider_account_identity_id, provider_transaction_reference)` → `payment_observation(observation_id, provider_account_identity_id, provider_transaction_reference)` | A transaction whose evidence is about a different funds movement |
| The establishing observation came through that same global account | FK `(source_observation_id, provider_account_identity_id)` → `payment_observation(observation_id, provider_account_identity_id)` | An observation whose binding was later rebound to another account |
| The accepted amount is the evidence's amount | FK `(source_observation_id, accepted_amount_normalized, accepted_amount_scale)` → `payment_observation(observation_id, amount_normalized, amount_scale)` | Accepting ₹1,000 on ₹10,000 of evidence (Revision 4's gap) |
| The project binding is for that same global account | FK `(provider_account_id, provider_account_identity_id)` → `payment_provider_account(provider_account_id, provider_account_identity_id)` | Binding project B's account to account A's identity |
| The binding belongs to the transaction's project | FK `(provider_account_id, project_id)` → `payment_provider_account(provider_account_id, project_id)` | Accepting account A's funds as project B's |
| The establishing observation belongs to the same project | FK `(source_observation_id, project_id)` → `payment_observation(observation_id, project_id)` | Borrowing another project's observation |
| The establishing observation arrived under the same account binding | FK `(source_observation_id, provider_account_id)` → `payment_observation(observation_id, provider_account_id)` | Citing an observation from a different account |
| The establishing observation carries the same baseline | FK `(source_observation_id, payment_config_version_id)` → `payment_observation(observation_id, payment_config_version_id)` | Choosing a baseline independently of the evidence |
| The establishing observation carries the same classification | FK `(source_observation_id, data_classification)` → `payment_observation(observation_id, data_classification)` | Labelling borrowed evidence as live |
| The baseline belongs to the project | FK `(payment_config_version_id, project_id)` → `payment_configuration_version(payment_config_version_id, project_id)` | Adopting another project's commercial terms |
| The accepted currency is the baseline's currency | FK `(payment_config_version_id, accepted_currency)` → `payment_configuration_version(payment_config_version_id, currency)` | Mixed-currency acceptance |

Each referenced parent key is declared in §5.3 as a `UNIQUE` constraint on exactly those columns, in that order. SQLite requires a composite foreign key's parent key to be covered by a `UNIQUE` index over the referenced columns, so each of these is a parent key and not an arbitrary column list.

**Why the reference chain cannot be short-circuited (I13).** The transaction's reference is proven equal to the identity's (first key) and to the establishing observation's (second key). Equality is transitive, so identity and observation necessarily agree — without either of them being compared to the other by application code. Remove either key and the chain breaks: with only the identity key, a transaction can record charge 200's identity against charge 100's evidence; with only the observation key, it can record an identity from another movement in the same account.

**Why NULL cannot bypass this.** SQLite's `MATCH SIMPLE` rule skips a composite foreign key only when a **child** column is NULL. `payment_transaction.provider_transaction_reference`, `provider_account_identity_id`, `accepted_amount_normalized`, and `accepted_amount_scale` are all `NOT NULL`, so no transaction row can skip these checks. On the **parent** side, a NULL never matches a non-NULL child value, so an observation with `provider_transaction_reference IS NULL` cannot be the establishing observation of any transaction: the lookup finds no row. The observation's nullable reference therefore remains a legal record of an unusable delivery (§4.7) while being structurally unusable as acceptance evidence. Revision 4 could not rely on this because its key did not include the reference at all.

**The observation proves its own chain.** `(source_registration_id, provider_account_id, project_id)` → registration proves the observation came through that registration's binding and project; `(provider_account_id, provider_account_identity_id)` → binding proves which global account that binding is. The chain is complete — observation → registration → binding → global account — and the transaction sits on it at four points simultaneously.

**One consequence worth stating plainly:** a transaction whose `provider_account_identity_id`, `provider_account_id`, `source_observation_id`, `provider_transaction_reference`, or accepted amount disagree with the evidence cannot be inserted at all. It is not "rejected by the verifier" or "checked by the write path"; there is no parent row to satisfy the key.

### 4.5 Behaviour for the required cases

| # | Case | Outcome | Mechanism |
|---|---|---|---|
| 1 | Same underlying provider account registered by **two projects** | One `provider_account_identity`; two `payment_provider_account` bindings; identity rows shared | `UQ(project_id, provider_account_identity_id)` per binding; global account key |
| 2 | Same transaction reference through **different channels** (webhook vs reconciliation) | One transaction; two observations; both correlated; funds counted once | Registration absent from the funds key; correlation cardinality (§4.6) |
| 3 | Same reference through **different registrations** (same account) | One transaction; both observations retained and correlated | Same as (2); the registration id appears nowhere in the transaction |
| 4 | Observation reference and identity reference **differ** | Insert fails | FK `(identity_id, provider_account_identity_id, provider_transaction_reference)` → identity, and FK to the observation's three-column key |
| 5 | Establishing observation belongs to **another provider account** | Insert fails | FK `(source_observation_id, provider_account_identity_id)` → observation |
| 6 | Transaction identity paired with the **wrong project binding** | Insert fails | FK `(provider_account_id, provider_account_identity_id)` → binding |
| 7 | Transaction identity paired with an **observation from another account** | Insert fails | FK `(source_observation_id, provider_account_id)` → observation |
| 8 | **Second** observation on the same reference, correlated | Correlation row carries the identity tuple; both references must match the transaction's | Two three-column keys on `payment_transaction_observation` (§4.6) |
| 9 | **Second** observation on the same account but a different reference, correlated | Insert fails | Same two keys: its reference has no matching transaction parent row |
| 10 | Correlation naming a transaction **from another global account** | Insert fails | `(payment_transaction_id, provider_account_identity_id, provider_transaction_reference)` → transaction |
| 11 | Accepted amount differs from the establishing observation | Insert fails | FK `(source_observation_id, accepted_amount_normalized, accepted_amount_scale)` → observation |
| 12 | Same reference under **two different provider accounts** | Two identities, two transactions — permitted | `provider_account_identity_id` is part of the funds key |
| 13 | Same reference in **test and live** environments | Two account identities, two transactions — permitted | `provider_environment` is part of the account key and inherited, never duplicated |
| 14 | **Cross-project identity collision** (both projects bound to the same global account) | Second acceptance refused; `rejected` verification; `cross_project_collision` conflict in the refusing project; owner untouched and not identified | `UQ(payment_transaction.identity_id)` |
| 15 | Duplicate observations for one identity with **inconsistent amount or currency** | Second observation correlated and recorded, contributes no funds; `duplicate_content_mismatch` conflict; accepted amount unchanged | One transaction per identity; conflict membership relation (§6.4) |
| 16 | Observation with **no trustworthy provider reference** | Evidence retained; correlation impossible, therefore no transaction; `rejected` (2A) with `reason_code = provider_reference_absent` | Correlation's reference column is `NOT NULL` and non-empty by check (§4.6, §4.7) |
| 17 | Same funds movement observed twice, **second delivery arriving after acceptance** | New observation + new correlation row; no second transaction, no second acceptance, no amount change | `UQ(identity_id)` on transaction; `UQ(payment_transaction_id)` on acceptance |

For case (14), the refusing project's conflict row carries only the identity's opaque tuple and its own observations. It does **not** carry the owning project's identifier — exposing it would disclose cross-project information to a party with no access to it. The collision is additionally reported on the internal operational channel (identifier-only, §11.3) so that the contested identity is visible to the Founder/ops without widening either project's read scope.

Case (16) is deliberate and is a Slice 2A limitation rather than a design goal: a delivery without a provider transaction reference could only be correlated by `verified_mapping`, which requires the J.3 mapping authority that does not exist yet. In 2A such a delivery is `rejected` with `reason_code = provider_reference_absent`, and the refusal is no longer a statement about what the verifier chose to do — no correlation row can exist for it, so no acceptance can cite it.

### 4.6 Correlation cardinality and reference agreement

Revision 3's correlation table had primary key `(observation_id, payment_transaction_id)`, which rejected duplicate *pairs* while permitting one observation to sit in two pairs — two transactions. Revision 4 corrected that. Revision 5 keeps the corrected cardinality and adds the content check: a correlated observation must carry the same global account identity and the same provider reference as the transaction it is correlated to.

The intended cardinalities are three different things and must not be conflated:

| Relationship | Permitted? | Mechanism |
|---|---|---|
| Many observations → one transaction | **Yes** | `payment_transaction_observation.payment_transaction_id` is not unique; the primary key is `observation_id` |
| Many verification attempts → one observation | **Yes** | `verification_result` has `UQ(observation_id, attempt_seq)`; attempts have distinct sequences |
| Many transactions → one observation | **No** | `payment_transaction_observation` primary key is `observation_id` |
| One verification accepted twice | **No** | `UQ(verification_id)` on `payment_transaction_acceptance` |
| One transaction accepted twice | **No** | `UQ(payment_transaction_id)` on `payment_transaction_acceptance` |
| A correlated observation with a different reference or account identity | **No** | The two three-column composite keys below |
| A correlated observation with no reference | **No** | `provider_transaction_reference` is `NOT NULL` with `CK(<> '')` on the correlation |

`payment_transaction_observation` therefore has:

```sql
PRIMARY KEY (observation_id),
UNIQUE (observation_id, payment_transaction_id),   -- parent key for acceptance

CHECK (correlation_basis = 'provider_shared_reference')  -- the only basis Slice 2A writes
CHECK (provider_transaction_reference <> '')

FOREIGN KEY (observation_id, provider_account_identity_id, provider_transaction_reference)
  REFERENCES payment_observation
             (observation_id, provider_account_identity_id, provider_transaction_reference)
FOREIGN KEY (payment_transaction_id, provider_account_identity_id, provider_transaction_reference)
  REFERENCES payment_transaction
             (payment_transaction_id, provider_account_identity_id, provider_transaction_reference)
```

The three-column keys are what make `correlation_basis = 'provider_shared_reference'` a fact rather than a label. A correlation row that names a transaction from account A and an observation from account B has no parent row on at least one side. A correlation row whose observation carries charge 100 while its transaction carries charge 200 fails the transaction-side key. Because the columns are `NOT NULL`, neither key can be skipped by `MATCH SIMPLE`.

The second key (`UNIQUE(observation_id, payment_transaction_id)`) exists solely to be a composite parent for `payment_transaction_acceptance`, whose `(observation_id, payment_transaction_id)` foreign key then proves that the accepting observation is correlated to *that* transaction. Because the primary key already forbids an observation from having a second transaction, an acceptance can never be supported by an observation that is correlated elsewhere.

`payment_transaction_observation` remains append-only, and after Revision 5 its content is fixed by keys rather than by discipline: an observation can be correlated to one transaction, and that transaction's identity tuple is the only tuple the row may carry.

### 4.7 Observations, unresolved states, and the absence of a transaction link

`payment_observation` carries **no** transaction column. Not a nullable one — none:

- An observation can be stored, read, and audited while no canonical transaction exists for it.
- Correlation is a separate record, so "uncorrelated" is the absence of a row, not a null in a mandatory relationship and not a sentinel value.
- An uncorrelated observation therefore cannot violate a mandatory foreign key, cannot require an invented transaction, and cannot be mistaken for accepted funds.

Observation required fields: `observation_id`, `project_id` (derived from the registration, never supplied), `source_registration_id`, `provider_account_id` (proven equal to the registration's binding), `provider_account_identity_id` (proven equal to the binding's global account), `delivery_reference`, `amount_text`, `amount_normalized`, `amount_scale`, `currency`, `config_binding_state`, `data_classification`, `received_at`. `provider_transaction_reference` is **nullable**, because a delivery may not carry one — and that nullability is now load-bearing rather than incidental:

| Observation state | Can be the establishing observation? | Can be correlated? | Mechanism |
|---|---|---|---|
| Reference present, non-empty, bound baseline | Yes | Yes | Three-column parent keys match; correlation carries the same tuple |
| Reference present, unbound baseline | No | No | No baseline key; no `passed` verification is possible (table below) |
| Reference `NULL` | **No** | **No** | A NULL parent value never matches a `NOT NULL` child value; correlation's own column is `NOT NULL` |
| Reference `''` | **No** | **No** | `CK(provider_transaction_reference <> '')` on the observation |

The empty-string case is worth stating because it is the one a caller can attempt: an empty reference is a *present* value that a composite key would happily match if an identity existed with an empty reference. Both tables therefore reject it by check, and the identity table rejects it too, so `''` cannot become a shared identity by accident.

Ingestion states, all representable without a transaction:

| `config_binding_state` | Meaning | Consequence |
|---|---|---|
| `bound` | Exactly one configuration version could be determined for the project at ingestion, with `payment_config_version_id` recorded | May be verified and accepted |
| `unbound_no_configuration` | The project has no configuration version | Evidence retained; cannot pass verification; no transaction |
| `unbound_ambiguous` | More than one candidate version could not be ordered deterministically | Evidence retained; cannot pass verification; no transaction |

```sql
CHECK ((config_binding_state = 'bound') = (payment_config_version_id IS NOT NULL))
```

A delivery with no reference is retained under the same rule: it is evidence the provider sent something, and Slice 2A does not delete evidence it cannot interpret. What it cannot be is the parent of an acceptance.

### 4.8 Reported versus accepted

| Question | Authoritative record |
|---|---|
| What did the provider report? | `payment_observation` (immutable, verbatim normalized facts) |
| What has this system accepted as funds? | `payment_transaction` (immutable, accepted amount and currency) |

A conflict between them is never resolved by overwriting either record. Since Revision 5, the *accepted* side can no longer disagree with the *reported* side at the level of amount or funds movement: the accepted amount is the evidence's amount by key, and the accepted identity is the evidence's reference by key. What can still disagree is the interpretation — whether the reported facts satisfy the verification contract — and that is a conflict record, not an edit.

---
## 5. Relational Model, Column Definitions, and the Commercial Baseline

### 5.1 Record map

`C` = configuration/obligation records described by the rolled-back initial slice (§3.3); `2A` and `2B` mark the slice that owns the record. "Composite" means the reference is a composite foreign key to a declared parent key, not a single-column pointer.

| Record | Primary key | Scoped references | Ownership | Baseline | Immutability | Uniqueness |
|---|---|---|---|---|---|---|
| `provider_account_identity` (2A) | `provider_account_identity_id` | none (global) | none — global by design | none | Append-only | `UQ(provider_key, provider_environment, provider_account_reference)` |
| `payment_provider_account` (2A) | `provider_account_id` | `project_id` → `projects`; `provider_account_identity_id` → global identity | **Declares** one project's binding | none | Append-only | `UQ(project_id, provider_account_identity_id)` |
| `payment_source_registration` (2A) | `source_registration_id` | composite `(provider_account_id, project_id)`; self composite for predecessor | **Defines** ingestion trust | none | Append-only | `UQ(project_id, provider_account_id, source_kind, source_namespace, revision_seq)`; `UQ(supersedes_registration_id)` |
| `payment_source_registration_current` (2A) | `(project_id, provider_account_id, source_kind, source_namespace)` | composite five-column to registration | Derived from its key | none | **Mutable projection** (§8.3) | Primary key *is* the "one current" rule |
| `provider_transaction_identity` (2A) | `identity_id` | `provider_account_identity_id` | none — ownership lives on the transaction | none | Append-only | `UQ(provider_account_identity_id, provider_transaction_reference)`; parent key `UQ(identity_id, provider_account_identity_id, provider_transaction_reference)` |
| `payment_observation` (2A) | `observation_id` | composite `(source_registration_id, provider_account_id, project_id)`; composite to its binding's identity; composite to configuration version; **no transaction FK** | Derived from registration | Records the version captured at ingestion | Immutable | `UQ(source_registration_id, delivery_reference)` + eight parent keys, including `(observation_id, provider_account_identity_id, provider_transaction_reference)` and `(observation_id, amount_normalized, amount_scale)` |
| `verification_result` (2A) | `verification_id` | composite `(observation_id, project_id)` and three more to the observation; **no transaction FK** | Derived from observation | Inherits the observation's captured version | Immutable | `UQ(observation_id, attempt_seq)` + parent keys (§5.3) |
| `payment_transaction` (2A) | `payment_transaction_id` | composite to identity (with reference), binding, observation (with reference and amount), and configuration version | `project_id`, decided at creation | **Bound immutably** (`NOT NULL`) | Immutable | `UQ(identity_id)`, `UQ(source_observation_id)`, `UQ(payment_transaction_id, provider_account_identity_id, provider_transaction_reference)` |
| `payment_transaction_observation` (2A) | `observation_id` | composite `(observation_id, project_id)`, `(payment_transaction_id, project_id)`, and two three-column identity/reference keys | Derived | none | Immutable; content fixed by key | PK is the one-transaction-per-observation rule; `UQ(observation_id, payment_transaction_id)` is the acceptance parent |
| `payment_transaction_acceptance` (2A) | `acceptance_id` | composite to transaction, verification, observation, and correlation | Derived | Carries both parents' version | Immutable | `UQ(payment_transaction_id)`, `UQ(verification_id)` |
| `reconciliation_conflict` (2A) | `conflict_id` | composite `(payment_transaction_id, project_id)`, `(trigger_observation_id, project_id)` | `project_id` | none | Immutable | `UQ(project_id, conflict_key)`; parent key `UQ(conflict_id, project_id, conflict_key)` |
| `reconciliation_conflict_observation` (2A) | `(conflict_id, observation_id)` | composite to both parents | Derived | none | Immutable; frozen by seal trigger (§8.4) | Natural key |
| `reconciliation_conflict_seal` (2A) | `seal_id` | composite `(conflict_id, project_id)` and `(conflict_id, project_id, conflict_key)` | Derived from conflict | none | Immutable; one per conflict | `UQ(conflict_id)`; count must equal membership (§8.4) |
| `conflict_resolution` (2A) | `resolution_id` | composite `(conflict_id, project_id)` | Derived | none | Immutable | `UQ(conflict_id)` |
| `verification_supersession` (2A) | `supersession_id` | composite to both verifications **sharing one `observation_id`** | `project_id` | none | Immutable | `UQ(superseded_verification_id)`, `UQ(superseding_verification_id)` |
| `payment_configuration_version` (C) | `payment_config_version_id` | `project_id`, `proposal_version_id`, `agreement_version_id` | `project_id` | **Is** the baseline anchor | Immutable version | `UQ(project_id, version_number)`, `UQ(payment_config_version_id, currency)`, `UQ(payment_config_version_id, project_id)` |
| `payment_obligation` (C) | `obligation_id` | `payment_config_version_id` | via configuration | Member of exactly one version | Immutable after issuance | Deterministic ordering within version |
| `allocation_request` (2B) | `allocation_request_id` | `project_id`, `payment_transaction_id` | `project_id` | none | Immutable payload and outcome | `UQ(project_id, idempotency_key)` |
| `allocation` (2B) | `allocation_id` | transaction, obligation, request, self (compensation) | `project_id` | via transaction and obligation | Immutable; corrections are new rows | One allocation per accepted request |
| `audit_event` (existing) | `audit_event_id` | none (identifier metadata only) | `project_id` column | none | Append-only | n/a |

Derived, never stored as authoritative columns: obligation remaining balance, transaction unapplied funds, whether an obligation is satisfied, aggregate financial position, whether a transaction is blocked, and an obligation's state beyond `proposed`.

### 5.2 Insertion order (linear; one atomic group for acceptance)

The order below is legal under immediate foreign-key enforcement, which is what `node:sqlite` provides with `PRAGMA foreign_keys = ON` (the repository's existing setting). No `DEFERRABLE` clause is required, and the design does not depend on one.

```
1. provider_account_identity            (global; created once per real account)
2. payment_provider_account             (project binding of that account)
3. payment_source_registration          (+ payment_source_registration_current insert/CAS)
4. payment_observation                  (carries its global account identity and reference)
5. verification_result                  (attempt_seq = MAX+1 for that observation, inside BEGIN IMMEDIATE)
6. provider_transaction_identity        (first acceptance only)
7. payment_transaction                  (reference + accepted amount proven against the observation)
8. payment_transaction_observation      (the establishing observation, plus any earlier ones)
9. payment_transaction_acceptance
10. audit_event
```

Steps 6–10 for a first acceptance are **one database transaction** (§6.3). Steps 1–5 are prerequisites that may already exist, and steps 1–4 may legitimately exist with no transaction at all.

Conflicts follow the same shape: header, membership, seal, audit in one transaction (step 11 below).

```
11. reconciliation_conflict → reconciliation_conflict_observation → reconciliation_conflict_seal → audit_event
```

Every arrow points backwards in this list. Revision 3 removed the verification/transaction cycle, Revision 4 added no forward reference, and Revision 5 adds none either: the seal is written after the membership it counts, so the conflict group is linear too.

Consequences worth stating explicitly:

- A failed verification needs no transaction and creates none (step 5 only).
- A transaction row is not "accepted funds" until its acceptance row exists; the derived position reads acceptance, not existence.
- A correlation row can only be written after its transaction, so the "this observation belongs to this transaction" proof is stored data rather than an application assumption.
- An identity row exists only because some acceptance committed with it (§6.3); there is no path that creates one "in advance".

---

### 5.3 Column definitions

Every column of every table this design depends on, with the constraint that makes it meaningful. `PK` = primary key, `FK` = foreign key, `CK` = check constraint, `UQ` = unique constraint or unique index. "Immutable" means no `UPDATE`/`DELETE` path exists (I4); the one mutable projection is marked and justified in §8.3.

Two SQLite facts govern the table below and are stated once rather than repeated per row:

- **A composite foreign key requires a parent key.** SQLite accepts a composite `REFERENCES parent(a, b, c)` only when the parent's `(a, b, c)` is covered by a `UNIQUE` constraint or unique index. Every composite key used below is therefore declared on the parent, and the child's column order matches the parent key's order.
- **A composite foreign key with a NULL child column is not checked.** SQLite applies `MATCH SIMPLE` semantics: if *any* child column in the key is NULL, the constraint is satisfied without a lookup. This is why every optional column that participates in a scope key is also tied to a `CHECK` (for example `(config_binding_state = 'bound') = (payment_config_version_id IS NOT NULL)`), so "NULL means unbound" is itself enforced rather than merely permitted.

**`provider_account_identity`** — global, one row per real provider account

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `provider_account_identity_id` | TEXT | no | PK | yes |
| `provider_key` | TEXT | no | opaque provider implementation name; no provider selected (J.8) | yes |
| `provider_environment` | TEXT | no | CK ∈ {`test`, `live`}; part of the global key | yes |
| `provider_account_reference` | TEXT | no | provider's own account identifier; server-side configuration only; `CK(provider_account_reference <> '')` | yes |
| `first_registered_at` | TEXT | no | canonical timestamp (§8.5) | yes |

Table constraint: `UQ(provider_key, provider_environment, provider_account_reference)` — the global account key.

**`payment_provider_account`** — one project's binding of one global account

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `provider_account_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | FK → `projects(id)` | yes |
| `provider_account_identity_id` | TEXT | no | FK → `provider_account_identity` | yes |
| `registered_at` | TEXT | no | canonical timestamp | yes |

Table constraints: `UQ(project_id, provider_account_identity_id)` (a project binds a given real account once), and the parent keys `UQ(provider_account_id, project_id)`, `UQ(provider_account_id, provider_account_identity_id)`.

**`payment_source_registration`** — append-only ingestion trust history

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `source_registration_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | FK → `projects(id)` | yes |
| `provider_account_id` | TEXT | no | composite FK `(provider_account_id, project_id)` → `payment_provider_account(provider_account_id, project_id)` | yes |
| `source_kind` | TEXT | no | CK ∈ {`provider_webhook`, `provider_api_reconciliation`} | yes |
| `source_namespace` | TEXT | no | server-side value; no customer-supplied route | yes |
| `revision_seq` | INTEGER | no | CK `revision_seq >= 1`; scope-ordered (§8.3) | yes |
| `supersedes_registration_id` | TEXT | yes | `UQ` (at most one successor); composite self-FK below | yes |
| `supersedes_revision_seq` | INTEGER | yes | carried parent sequence; `CK` equivalence with the id | yes |
| `created_at` | TEXT | no | canonical timestamp; descriptive only | yes |

Table constraints:

```sql
UNIQUE (project_id, provider_account_id, source_kind, source_namespace, revision_seq)
UNIQUE (source_registration_id, project_id)
UNIQUE (source_registration_id, provider_account_id, project_id)
UNIQUE (source_registration_id, project_id, provider_account_id, source_kind, source_namespace)
UNIQUE (source_registration_id, project_id, provider_account_id,
        source_kind, source_namespace, revision_seq)
UNIQUE (supersedes_registration_id)

FOREIGN KEY (supersedes_registration_id, project_id, provider_account_id,
             source_kind, source_namespace, supersedes_revision_seq)
  REFERENCES payment_source_registration
             (source_registration_id, project_id, provider_account_id,
              source_kind, source_namespace, revision_seq)

CHECK ((supersedes_registration_id IS NULL) = (supersedes_revision_seq IS NULL))
CHECK (supersedes_registration_id IS NOT NULL OR revision_seq = 1)
CHECK (supersedes_registration_id IS NULL OR revision_seq > supersedes_revision_seq)
CHECK (supersedes_registration_id IS NULL
       OR supersedes_registration_id <> source_registration_id)
```

The self-referential composite key is the whole of Finding 4A: because the child repeats its own `project_id`, `provider_account_id`, `source_kind`, and `source_namespace` in the key, a predecessor from a different project, account, channel, or namespace has no matching parent row. A cross-scope chain cannot be inserted.

**`payment_source_registration_current`** — projection, §8.3

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `project_id` | TEXT | no | PK part; FK → `projects(id)` | no — projection |
| `provider_account_id` | TEXT | no | PK part; composite FK `(provider_account_id, project_id)` → binding | no — projection |
| `source_kind` | TEXT | no | PK part | no — projection |
| `source_namespace` | TEXT | no | PK part | no — projection |
| `source_registration_id` | TEXT | no | **UQ**; composite FK over all five scope columns → registration | no — projection |
| `current_since` | TEXT | no | canonical timestamp; when this registration became current at this scope | no — projection |

Table constraints:

```sql
PRIMARY KEY (project_id, provider_account_id, source_kind, source_namespace)
UNIQUE (source_registration_id)
FOREIGN KEY (source_registration_id, project_id, provider_account_id,
             source_kind, source_namespace)
  REFERENCES payment_source_registration
             (source_registration_id, project_id, provider_account_id,
              source_kind, source_namespace)
```

`replaced_at` is gone. It described a *past* event on a row whose whole meaning is "what is current now", so after a replacement the field contradicted the row it sat on. `current_since` describes the only thing the projection is entitled to say, and its update rule is stated in §8.3.

**`provider_transaction_identity`** — global funds-movement registry

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `identity_id` | TEXT | no | PK | yes |
| `provider_account_identity_id` | TEXT | no | FK → `provider_account_identity`; part of the natural key | yes |
| `provider_transaction_reference` | TEXT | no | provider funds reference; `CK(provider_transaction_reference <> '')`; part of the natural key | yes |
| `first_observed_at` | TEXT | no | canonical timestamp | yes |

Table constraints: `UQ(provider_account_identity_id, provider_transaction_reference)` — the global canonical uniqueness rule of I7 — and two parent keys, `UQ(identity_id, provider_account_identity_id)` for the older two-column reference and `UQ(identity_id, provider_account_identity_id, provider_transaction_reference)` for the Revision 5 reference-equality key.

There is deliberately **no** `project_id` column: project ownership is a property of the accepted transaction, not of the funds movement's identity.

**`payment_observation`** — immutable record of one delivery

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `observation_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | derived from registration; part of the observation's parent keys | yes |
| `source_registration_id` | TEXT | no | composite FK `(source_registration_id, provider_account_id, project_id)` → registration | yes |
| `provider_account_id` | TEXT | no | part of the same composite key; composite FK to its binding's global account | yes |
| `provider_account_identity_id` | TEXT | no | composite FK `(provider_account_id, provider_account_identity_id)` → `payment_provider_account`; part of three parent keys | yes |
| `delivery_reference` | TEXT | no | `CK(delivery_reference <> '')` | yes |
| `provider_transaction_reference` | TEXT | **yes** | provider funds reference when the delivery carries one; `CK` non-empty when present; nullable ⇒ unusable as acceptance evidence (§4.7) | yes |
| `amount_text` | TEXT | no | verbatim; `CK(amount_text <> '')` | yes |
| `amount_normalized` | TEXT | no | canonical form (§10.3); `CK(amount_normalized <> '0')`; canonicality checks below | yes |
| `amount_scale` | INTEGER | no | CK `0 ≤ amount_scale ≤ 6`; must equal the fraction length | yes |
| `currency` | TEXT | no | CK `currency = UPPER(currency)` and `length(currency) = 3` | yes |
| `payment_config_version_id` | TEXT | yes | composite FK `(payment_config_version_id, currency)` and `(payment_config_version_id, project_id)` → configuration version | yes |
| `config_binding_state` | TEXT | no | CK ∈ {`bound`, `unbound_no_configuration`, `unbound_ambiguous`} | yes |
| `data_classification` | TEXT | no | CK ∈ {`synthetic`, `live`} | yes |
| `received_at` | TEXT | no | canonical timestamp (§8.5); descriptive only | yes |

Table constraints:

```sql
UNIQUE (source_registration_id, delivery_reference)
UNIQUE (observation_id, project_id)
UNIQUE (observation_id, provider_account_id)
UNIQUE (observation_id, provider_account_identity_id)
UNIQUE (observation_id, provider_account_identity_id, provider_transaction_reference)
UNIQUE (observation_id, payment_config_version_id)
UNIQUE (observation_id, config_binding_state)
UNIQUE (observation_id, data_classification)
UNIQUE (observation_id, amount_normalized, amount_scale)

FOREIGN KEY (provider_account_id, provider_account_identity_id)
  REFERENCES payment_provider_account(provider_account_id, provider_account_identity_id)

CHECK ((config_binding_state = 'bound') = (payment_config_version_id IS NOT NULL))
CHECK (provider_transaction_reference IS NULL OR provider_transaction_reference <> '')
CHECK (amount_normalized <> '0')
CHECK (
  (instr(amount_normalized, '.') = 0 AND amount_scale = 0)
  OR (instr(amount_normalized, '.') > 0
      AND amount_scale = length(amount_normalized) - instr(amount_normalized, '.'))
)
CHECK (instr(amount_normalized, '.') = 0 OR substr(amount_normalized, -1) <> '0')
```

The `observation_id`-prefixed keys are not redundancy for its own sake: each is the parent key for at least one child constraint elsewhere (`payment_transaction`, `verification_result`, `payment_transaction_observation`), so a child cannot borrow an observation's project, account, global account identity, reference, baseline, state, classification, or amount by supplying a different value.

Three of those parent keys are new in Revision 5: the account identity (so a transaction cannot cite evidence from a binding that has been rebound), the reference (so a transaction cannot accept one funds movement on evidence of another), and the amount pair (so the accepted amount cannot differ from the evidence). The reference key is declared over a **nullable** column on purpose: because every child column that references it is `NOT NULL`, a NULL never matches, and the parent key therefore does not weaken but *restricts* — it can only ever be satisfied by an observation that actually carries a reference.

The two amount checks make the stored "normalized" value mean what §10.3 says it means: the scale equals the number of fractional digits, and a fraction never ends in a zero. Without them, `1500.00` with scale 2 would be a storable value that compares unequal to `1500` under the equality key while being numerically identical — the exact drift the normalization contract exists to prevent. The checks constrain *shape*; they do not prove that the original text parsed correctly, which remains application validation (§10.7).

The currency composite key is J.13 expressed as a constraint: a bound observation cannot record a currency its configuration version does not use, because no such parent row exists. The project composite key is I5 expressed as a constraint.

There is **no** transaction column. An observation is storable, verifiable, and auditable with no canonical transaction in existence.
**`verification_result`** — immutable attempt outcome

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `verification_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | composite FK `(observation_id, project_id)` → observation | yes |
| `observation_id` | TEXT | no | part of that key and of four more | yes |
| `attempt_seq` | INTEGER | no | CK `attempt_seq >= 1`; `UQ(observation_id, attempt_seq)`; allocated inside `BEGIN IMMEDIATE` (§8.5) | yes |
| `payment_config_version_id` | TEXT | yes | composite FK `(observation_id, payment_config_version_id)` → observation | yes |
| `config_binding_state` | TEXT | no | composite FK `(observation_id, config_binding_state)` → observation | yes |
| `outcome` | TEXT | no | CK ∈ {`passed`, `failed`, `rejected`}; part of `UQ(verification_id, outcome)` | yes |
| `reason_code` | TEXT | no | `CK(reason_code <> '')`; enumerated by the verification contract, not by a database enum | yes |
| `verifier_kind` | TEXT | no | CK ∈ {`automated`, `test_fake`} in 2A; `human` reserved and gated on J.10 | yes |
| `verified_by` | TEXT | yes | FK → `people(id)`; `CK(verified_by IS NULL OR verifier_kind = 'human')` | yes |
| `verifier_reference` | TEXT | yes | identifier of the verifier configuration/version that ran | yes |
| `verified_at_source` | TEXT | no | CK ∈ {`system_clock`, `test_clock`} | yes |
| `data_classification` | TEXT | no | composite FK `(observation_id, data_classification)` → observation | yes |
| `attempted_at` | TEXT | no | canonical timestamp; descriptive only, never used for ordering | yes |

Table constraints:

```sql
UNIQUE (observation_id, attempt_seq)
UNIQUE (verification_id, project_id)
UNIQUE (verification_id, observation_id, project_id)
UNIQUE (verification_id, observation_id, project_id, attempt_seq)
UNIQUE (verification_id, outcome)
UNIQUE (verification_id, data_classification)
UNIQUE (verification_id, payment_config_version_id)
```

and the checks:

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

`verification_result` has **no** `payment_transaction_id`. The acceptance record makes that claim, and only after the correlation exists.

---

**`payment_transaction`** — immutable canonical accepted funds movement

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `payment_transaction_id` | TEXT | no | PK; part of four parent keys below | yes |
| `identity_id` | TEXT | no | **UQ** (I7); part of the three-column identity key | yes |
| `provider_account_identity_id` | TEXT | no | proven equal to the identity's *and* to the observation's by two composite keys | yes |
| `provider_transaction_reference` | TEXT | no | `CK(<> '')`; proven equal to the identity's reference and to the evidence's reference | yes |
| `provider_account_id` | TEXT | no | the project binding actually used | yes |
| `project_id` | TEXT | no | FK → `projects(id)`; ownership decided at creation | yes |
| `source_observation_id` | TEXT | no | **UQ**; the observation that established the transaction | yes |
| `payment_config_version_id` | TEXT | no | FK → `payment_configuration_version`; the immutable baseline (I8) | yes |
| `accepted_amount_normalized` | TEXT | no | canonical form (§10.3); `CK(<> '0')`; proven equal to the evidence's | yes |
| `accepted_amount_scale` | INTEGER | no | CK `0 ≤ accepted_amount_scale ≤ 6`; must equal the fraction length; proven equal to the evidence's | yes |
| `accepted_currency` | TEXT | no | composite FK to the configuration version's currency | yes |
| `data_classification` | TEXT | no | CK ∈ {`synthetic`, `live`} | yes |
| `accepted_at` | TEXT | no | canonical timestamp; descriptive only | yes |

Table constraints — this is the table Findings 1, 2, and 5 are about, so every key is spelled out:

```sql
UNIQUE (identity_id)                 -- I7: one transaction per funds movement
UNIQUE (source_observation_id)       -- one transaction per establishing observation
UNIQUE (payment_transaction_id, project_id)
UNIQUE (payment_transaction_id, data_classification)
UNIQUE (payment_transaction_id, payment_config_version_id)
UNIQUE (payment_transaction_id, provider_account_identity_id, provider_transaction_reference)

FOREIGN KEY (identity_id, provider_account_identity_id, provider_transaction_reference)
  REFERENCES provider_transaction_identity
             (identity_id, provider_account_identity_id, provider_transaction_reference)
FOREIGN KEY (source_observation_id, provider_account_identity_id, provider_transaction_reference)
  REFERENCES payment_observation
             (observation_id, provider_account_identity_id, provider_transaction_reference)
FOREIGN KEY (source_observation_id, accepted_amount_normalized, accepted_amount_scale)
  REFERENCES payment_observation(observation_id, amount_normalized, amount_scale)
FOREIGN KEY (source_observation_id, provider_account_identity_id)
  REFERENCES payment_observation(observation_id, provider_account_identity_id)
FOREIGN KEY (provider_account_id, provider_account_identity_id)
  REFERENCES payment_provider_account(provider_account_id, provider_account_identity_id)
FOREIGN KEY (provider_account_id, project_id)
  REFERENCES payment_provider_account(provider_account_id, project_id)
FOREIGN KEY (source_observation_id, project_id)
  REFERENCES payment_observation(observation_id, project_id)
FOREIGN KEY (source_observation_id, provider_account_id)
  REFERENCES payment_observation(observation_id, provider_account_id)
FOREIGN KEY (source_observation_id, payment_config_version_id)
  REFERENCES payment_observation(observation_id, payment_config_version_id)
FOREIGN KEY (source_observation_id, data_classification)
  REFERENCES payment_observation(observation_id, data_classification)
FOREIGN KEY (payment_config_version_id, project_id)
  REFERENCES payment_configuration_version(payment_config_version_id, project_id)
FOREIGN KEY (payment_config_version_id, accepted_currency)
  REFERENCES payment_configuration_version(payment_config_version_id, currency)

CHECK (provider_transaction_reference <> '')
CHECK (accepted_amount_normalized <> '0')
CHECK (
  (instr(accepted_amount_normalized, '.') = 0 AND accepted_amount_scale = 0)
  OR (instr(accepted_amount_normalized, '.') > 0
      AND accepted_amount_scale =
          length(accepted_amount_normalized) - instr(accepted_amount_normalized, '.'))
)
CHECK (instr(accepted_amount_normalized, '.') = 0
       OR substr(accepted_amount_normalized, -1) <> '0')
```

**Twelve composite keys now bind this row**, and each answers a different question rather than repeating one:

| Group | Keys | What they prove |
|---|---|---|
| Funds movement | 3-column key to the identity; 3-column key to the observation; 3-column key to the observation's identity | The transaction's reference equals the identity's reference *and* the evidence's reference, in one global account |
| Amount | 3-column key to `(observation_id, amount_normalized, amount_scale)` | The accepted amount and scale are the evidence's amount and scale |
| Account and project | Two keys to the binding; three to the observation (project, account, classification) | The identity, binding, observation, and project describe one account and one project |
| Baseline | Two keys to the configuration version | The baseline is the evidence's captured version, belongs to the project, and its currency is the accepted currency |

The first two keys are the constraints that refuse a second acceptance; the rest are the constraints that make the row internally coherent **at insert time**, rather than coherent only once an acceptance row exists. A transaction whose project, account, observation, reference, amount, baseline, currency, or classification disagree with one another has no legal parent combination and cannot be written.

**What the amount key does and does not claim.** It claims that the two stored normalized forms and scales are identical, and the checks make each of those forms canonical. It does not claim that the provider's original text was parsed correctly — that is application validation before insert (§10.7), and no database can re-parse an integer decimal from a string it never saw. What it removes is the possibility of an accepted amount that is *internally* plausible and *externally* different from the evidence.
**`payment_transaction_observation`** — correlation relation (append-only, content fixed by key)

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `observation_id` | TEXT | no | **PK** — one observation correlates to at most one transaction (I11) | yes |
| `payment_transaction_id` | TEXT | no | FK → `payment_transaction`; indexed, not unique | yes |
| `project_id` | TEXT | no | composite FK `(observation_id, project_id)` → observation; `(payment_transaction_id, project_id)` → transaction | yes |
| `provider_account_identity_id` | TEXT | no | **the shared global account** — both three-column keys below require it | yes |
| `provider_transaction_reference` | TEXT | no | **the shared funds reference**; `CK(<> '')` | yes |
| `correlation_basis` | TEXT | no | CK `= 'provider_shared_reference'` in Slice 2A; `verified_mapping` is excluded and requires J.3 (§16.1) | yes |
| `correlated_at` | TEXT | no | canonical timestamp | yes |

Table constraints:

```sql
PRIMARY KEY (observation_id)
UNIQUE (observation_id, payment_transaction_id)        -- the parent key used by acceptance

FOREIGN KEY (observation_id, project_id)
  REFERENCES payment_observation(observation_id, project_id)
FOREIGN KEY (payment_transaction_id, project_id)
  REFERENCES payment_transaction(payment_transaction_id, project_id)
FOREIGN KEY (observation_id, provider_account_identity_id, provider_transaction_reference)
  REFERENCES payment_observation
             (observation_id, provider_account_identity_id, provider_transaction_reference)
FOREIGN KEY (payment_transaction_id, provider_account_identity_id, provider_transaction_reference)
  REFERENCES payment_transaction
             (payment_transaction_id, provider_account_identity_id, provider_transaction_reference)

CHECK (correlation_basis = 'provider_shared_reference')
CHECK (provider_transaction_reference <> '')
```

Both three-column keys share one `provider_account_identity_id` column and one `provider_transaction_reference` column, so an observation can be correlated to a transaction only if the two describe the same global account **and** the same funds movement. That is the constraint Revision 4 lacked: it proved that a correlated observation was in the same project, and left the reference to the verifier's judgement.

The `CHECK (correlation_basis = 'provider_shared_reference')` is deliberately a one-value domain rather than a comment. Slice 2A has exactly one correlation basis, and the value is now a constraint that fails closed. Adding `verified_mapping` requires a different row shape — a mapping decision has no provider reference to carry — so it requires a schema change and the J.3 authority that does not exist yet; a caller cannot select it by passing a string, because the string is not in the domain.
**`payment_transaction_acceptance`** — the decision record

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `acceptance_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | composite FK `(payment_transaction_id, project_id)` → transaction; `(verification_id, observation_id, project_id)` → verification | yes |
| `payment_transaction_id` | TEXT | no | **UQ** (one acceptance per transaction) | yes |
| `verification_id` | TEXT | no | **UQ** (one acceptance per verification) | yes |
| `observation_id` | TEXT | no | composite FK `(observation_id, payment_transaction_id)` → correlation | yes |
| `payment_config_version_id` | TEXT | no | composite FK to both parents' version keys | yes |
| `verification_outcome` | TEXT | no | CK `verification_outcome = 'passed'` | yes |
| `data_classification` | TEXT | no | composite FK to both parents' classification keys | yes |
| `accepted_at` | TEXT | no | canonical timestamp | yes |

Table constraints:

```sql
UNIQUE (payment_transaction_id)
UNIQUE (verification_id)

FOREIGN KEY (payment_transaction_id, project_id)
  REFERENCES payment_transaction(payment_transaction_id, project_id)
FOREIGN KEY (verification_id, observation_id, project_id)
  REFERENCES verification_result(verification_id, observation_id, project_id)
FOREIGN KEY (observation_id, payment_transaction_id)
  REFERENCES payment_transaction_observation(observation_id, payment_transaction_id)
FOREIGN KEY (payment_transaction_id, payment_config_version_id)
  REFERENCES payment_transaction(payment_transaction_id, payment_config_version_id)
FOREIGN KEY (verification_id, payment_config_version_id)
  REFERENCES verification_result(verification_id, payment_config_version_id)
FOREIGN KEY (verification_id, verification_outcome)
  REFERENCES verification_result(verification_id, outcome)
FOREIGN KEY (verification_id, data_classification)
  REFERENCES verification_result(verification_id, data_classification)
FOREIGN KEY (payment_transaction_id, data_classification)
  REFERENCES payment_transaction(payment_transaction_id, data_classification)
```

Five invariants are enforced by this table alone:

1. **Belonging.** The `(observation_id, payment_transaction_id)` key requires an existing correlation row for that exact pair. "This verification's observation belongs to this transaction" is stored data proven by a key.
2. **Eligibility.** `verification_outcome = 'passed'` plus the composite key to `(verification_id, outcome)` means a `failed` or `rejected` result cannot be accepted even if a caller asserts otherwise.
3. **Singularity.** `UQ(payment_transaction_id)` and `UQ(verification_id)` mean one accepted verification per transaction and one transaction per accepted verification. Combined with the one-observation rule (§4.6), two verification attempts for one observation cannot yield two accepted transactions: both attempts share the observation, the observation has one correlation, and the second acceptance would collide on `UQ(payment_transaction_id)`.
4. **Classification agreement.** The two classification composite keys force transaction and verification to share one classification, so a synthetic verification cannot accept a live transaction.
5. **Baseline agreement.** The two version composite keys force the acceptance to carry a version that both parents actually hold. Because a `NULL` version makes the composite key unmatched rather than skipped on the child side, an unbound verification cannot support an acceptance.

**`reconciliation_conflict`** — immutable statement that a conflict exists

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `conflict_id` | TEXT | no | PK; part of parent key `UQ(conflict_id, project_id)` | yes |
| `project_id` | TEXT | no | FK → `projects(id)` | yes |
| `conflict_key` | TEXT | no | deterministic digest over persisted fields only (§8.4); `UQ(project_id, conflict_key)` | yes |
| `conflict_kind` | TEXT | no | CK ∈ {`duplicate_content_mismatch`, `cross_source_conflict`, `unresolved_correlation`, `cross_project_collision`} | yes |
| `payment_transaction_id` | TEXT | yes | composite FK `(payment_transaction_id, project_id)` → transaction | yes |
| `trigger_observation_id` | TEXT | yes | composite FK `(trigger_observation_id, project_id)` → observation | yes |
| `detected_at` | TEXT | no | canonical timestamp | yes |
| `detection_source` | TEXT | no | identifier of the check that raised it | yes |

Table constraints:

```sql
UNIQUE (project_id, conflict_key)                 -- one episode per condition (§8.4)
UNIQUE (conflict_id, project_id)                  -- parent key for membership and seal
UNIQUE (conflict_id, project_id, conflict_key)    -- parent key for the seal's digest
```

There is no `status` column and no `blocks_use` column; both are derived (§6.4), because a stored status would be a mutable field in an append-only table. The last two keys exist only to be parents: the first lets membership and the seal prove the project, and the second lets the seal prove that the digest it froze is the digest the header carries.

**`reconciliation_conflict_observation`** — membership, frozen at seal

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `conflict_id` | TEXT | no | PK part; composite FK `(conflict_id, project_id)` → conflict | yes |
| `observation_id` | TEXT | no | PK part; composite FK `(observation_id, project_id)` → observation | yes |
| `project_id` | TEXT | no | the shared scope proven by both keys | yes |

The composite primary key makes duplicate membership impossible, and the two shared-scope keys make cross-project membership impossible. No array exists anywhere in the model. Since Revision 5 the rows are also frozen: once the conflict carries a seal row, an insert trigger rejects further membership and two further triggers reject any update or delete (§8.4).

**`reconciliation_conflict_seal`** — one immutable seal per conflict

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `seal_id` | TEXT | no | PK | yes |
| `conflict_id` | TEXT | no | **UQ** — exactly one seal per conflict | yes |
| `project_id` | TEXT | no | composite FK `(conflict_id, project_id)` → conflict | yes |
| `conflict_key` | TEXT | no | the digest being sealed; composite FK `(conflict_id, project_id, conflict_key)` → conflict | yes |
| `sealed_member_count` | INTEGER | no | CK `>= 1`; must equal the membership row count (trigger) | yes |
| `seal_version` | TEXT | no | CK `= 'conflict/v1'` — the digest domain the count belongs to | yes |
| `sealed_at` | TEXT | no | canonical timestamp | yes |

Table constraints:

```sql
UNIQUE (conflict_id)

FOREIGN KEY (conflict_id, project_id)
  REFERENCES reconciliation_conflict(conflict_id, project_id)
FOREIGN KEY (conflict_id, project_id, conflict_key)
  REFERENCES reconciliation_conflict(conflict_id, project_id, conflict_key)

CHECK (sealed_member_count >= 1)
CHECK (seal_version = 'conflict/v1')
```

The second key is what stops the seal from being a comment: it requires the sealed digest to *be* the header's digest, as a key match on three columns. A seal that named a different key would have no parent row, so "the digest changed when the membership changed" cannot be papered over by rewriting the seal.

**Triggers that enforce completeness and immutability.** These are proposed schema objects for the future implementation, written in SQLite's trigger syntax; none of them exists in `main`, and this document does not claim they have been run.

```sql
-- a seal may only declare the membership it can actually see
CREATE TRIGGER reconciliation_conflict_seal_member_count
BEFORE INSERT ON reconciliation_conflict_seal
FOR EACH ROW
WHEN NEW.sealed_member_count <>
     (SELECT COUNT(*) FROM reconciliation_conflict_observation
       WHERE conflict_id = NEW.conflict_id)
BEGIN
  SELECT RAISE(ABORT, 'conflict_seal_member_count_mismatch');
END;

-- no membership may be added once the conflict is sealed
CREATE TRIGGER reconciliation_conflict_observation_after_seal
BEFORE INSERT ON reconciliation_conflict_observation
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM reconciliation_conflict_seal s
              WHERE s.conflict_id = NEW.conflict_id)
BEGIN
  SELECT RAISE(ABORT, 'conflict_membership_sealed');
END;

-- sealed membership can never be edited or removed
CREATE TRIGGER reconciliation_conflict_observation_no_update
BEFORE UPDATE ON reconciliation_conflict_observation
BEGIN
  SELECT RAISE(ABORT, 'conflict_membership_immutable');
END;

CREATE TRIGGER reconciliation_conflict_observation_no_delete
BEFORE DELETE ON reconciliation_conflict_observation
BEGIN
  SELECT RAISE(ABORT, 'conflict_membership_immutable');
END;

-- a seal can never be edited or removed, which would re-open the set
CREATE TRIGGER reconciliation_conflict_seal_no_update
BEFORE UPDATE ON reconciliation_conflict_seal
BEGIN
  SELECT RAISE(ABORT, 'conflict_seal_immutable');
END;

CREATE TRIGGER reconciliation_conflict_seal_no_delete
BEFORE DELETE ON reconciliation_conflict_seal
BEGIN
  SELECT RAISE(ABORT, 'conflict_seal_immutable');
END;
```

Why these are valid and sufficient, stated precisely rather than assumed:

- **Syntax.** `CREATE TRIGGER … BEFORE INSERT … FOR EACH ROW WHEN <expr> BEGIN SELECT RAISE(ABORT, '<message>'); END;` is standard SQLite. `RAISE(ABORT, …)` aborts the statement and, because SQLite statements inside a transaction are atomic with it, rolls back the enclosing write transaction's effect on that statement along with whatever the application does next. A `BEFORE UPDATE`/`BEFORE DELETE` trigger with an unconditional `RAISE` is the documented way to make a row read-only.
- **Visibility.** All statements run on one connection inside one `BEGIN IMMEDIATE` transaction, so the trigger's `SELECT COUNT(*)` sees the membership rows inserted earlier in the same transaction. That is what makes the count meaningful: it counts the real set, not a caller's claim.
- **Order.** Header → membership → seal → audit (step 11, §5.2). A seal inserted before its membership would count zero and abort; membership inserted after the seal is rejected by the second trigger. Neither ordering mistake can commit.
- **No mutable status.** The seal is a separate append-only row, not a `status` flag on the conflict. A flag could be set back to `open`; a seal row cannot be removed without the trigger refusing, and a second seal cannot exist because of `UQ(conflict_id)`.

**What the triggers do not enforce.** They cannot force a conflict to *have* a seal: a header committed without one would be an unsealed, non-authoritative conflict. Since a conflict only becomes authoritative by having a seal (I15, §6.4), an unsealed header is inert — it blocks nothing, resolves nothing, and is reported as an integrity anomaly (§8.2). The atomic write path never produces one.
**`conflict_resolution`**

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `resolution_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | composite FK `(conflict_id, project_id)` → conflict | yes |
| `conflict_id` | TEXT | no | **UQ** — one terminal resolution per conflict | yes |
| `resolution_kind` | TEXT | no | CK ∈ {`duplicate_confirmed`, `distinct_confirmed`, `quarantined`} | yes |
| `decided_by_kind` | TEXT | no | CK ∈ {`automated`, `human`}; `human` requires J.10 and is outside Slice 2A | yes |
| `decided_by_reference` | TEXT | yes | `CK(decided_by_kind <> 'human' OR decided_by_reference IS NOT NULL)` | yes |
| `decided_at` | TEXT | no | canonical timestamp | yes |
| `rationale_code` | TEXT | no | `CK(rationale_code <> '')` | yes |

**`verification_supersession`** — observation-scoped, strictly linear

| Column | Type / domain | Null | Key / constraint | Immutable |
|---|---|---|---|---|
| `supersession_id` | TEXT | no | PK | yes |
| `project_id` | TEXT | no | part of both verification keys | yes |
| `observation_id` | TEXT | no | **the shared observation** — both verifications must belong to it | yes |
| `superseded_verification_id` | TEXT | no | **UQ** — at most one successor | yes |
| `superseding_verification_id` | TEXT | no | **UQ** — at most one predecessor (no convergence) | yes |
| `superseded_attempt_seq` | INTEGER | no | carried parent sequence; proven genuine by the key below | yes |
| `superseding_attempt_seq` | INTEGER | no | carried parent sequence; proven genuine by the key below | yes |
| `reason_code` | TEXT | no | `CK(reason_code <> '')` | yes |
| `authority_kind` | TEXT | no | CK ∈ {`automated`} in Slice 2A; `human` requires J.3/J.10 authority | yes |
| `decided_at` | TEXT | no | canonical timestamp | yes |

Table constraints:

```sql
UNIQUE (superseded_verification_id)
UNIQUE (superseding_verification_id)

FOREIGN KEY (superseded_verification_id, observation_id, project_id, superseded_attempt_seq)
  REFERENCES verification_result(verification_id, observation_id, project_id, attempt_seq)
FOREIGN KEY (superseding_verification_id, observation_id, project_id, superseding_attempt_seq)
  REFERENCES verification_result(verification_id, observation_id, project_id, attempt_seq)

CHECK (superseding_verification_id <> superseded_verification_id)
CHECK (superseding_attempt_seq > superseded_attempt_seq)
```

Because both foreign keys share the single `observation_id` and `project_id` columns, the two verifications are necessarily in the same observation and the same project — a supersession across observations is not "rejected by a rule", it has no parent row. Because `attempt_seq` is allocated per observation and strictly increases along every edge, `V1 → V2 → V3` is legal while `V1 → V2` plus `V1 → V3` collides on `UQ(superseded_verification_id)` and `V1 → V3` plus `V2 → V3` collides on `UQ(superseding_verification_id)`.

A record may be a successor in one row and a predecessor in another: the two uniqueness constraints are on different columns, so `V2` can appear as `superseding_verification_id` once and as `superseded_verification_id` once. That is exactly what a chain is.

---

### 5.4 Commercial baseline binding (Finding D of Revision 3, retained)

The baseline question has five parts, each answered by a column plus a key.

**Configuration identity versus configuration version identity.** A configuration is the project's commercial instrument; a configuration version is one immutable state of it. Only versions are referenced by evidence. `payment_config_version_id` is the version identity; `version_number` is ordering metadata within a project and is never used as a foreign key.

**Which version governs a transaction.** The one captured with the observation that established it, at ingestion. Ingestion resolves the project's effective version — the one referenced by the exact current accepted proposal version and the exact current applicable signed-agreement version, per canonical decision §B.1 — and records it on the observation. If resolution is impossible, the observation is stored unbound (§4.7) and can never establish a transaction.

**Why the transaction stores the version as well as the observation.** Derivable is not enforced. The transaction's `payment_config_version_id` is proven equal to its establishing observation's by the composite key `(source_observation_id, payment_config_version_id)` → `payment_observation(observation_id, payment_config_version_id)`, and proven to belong to the transaction's project by `(payment_config_version_id, project_id)` → `payment_configuration_version(payment_config_version_id, project_id)`. Two keys, two different claims: *same as the evidence* and *same as the owner*. A single `NOT NULL` foreign key would prove neither.

**Currency and other terms.** Currency is tied to the version by composite foreign key on the observation and on the transaction, so neither can be inserted with a currency its version does not use (J.13 at schema level). Amount ceilings are not evaluated in Slice 2A: there is no obligation comparison and no allocation. In Slice 2B, I1 evaluates an obligation's expected amount, and obligations are members of a configuration version, so the ceiling is always read from an immutable version rather than from current commercial terms.

**Proposal and agreement references.** Captured on the configuration version itself (`proposal_version_id`, `agreement_version_id`) at version creation, per §B.1. Evidence does not duplicate them; it references the version, and the version's references are immutable by construction. Staleness is a derived comparison — the version's referenced proposal/agreement versions against the project's current ones — never a stored flag.

**After a configuration change.** Nothing already accepted changes. A later observation binds the then-current version; the earlier transaction keeps its own. Because the binding is a `NOT NULL` foreign key with no update path (I4, I8), "reinterpreting" a historical transaction would require a new row, which `UQ(identity_id)` forbids for the same funds movement.

**When the bound version is stale at acceptance time.** The canonical decision states that a stale configuration cannot satisfy the activation gate (§B.1) but does not say what happens to funds received against a stale baseline. Slice 2A takes the fail-safe reading and does not invent a commercial rule: verification returns `failed` with `reason_code = config_baseline_stale`, no transaction is created, and the observation remains retained evidence. Whether funds received against a superseded commercial baseline may later be accepted — and against which baseline — is a Founder decision, listed in §16.4 and not resolved here.

### 5.5 The Slice 2A / 2B boundary, precisely

**Slice 2A may establish:** trusted provider accounts (global identity plus project binding), registrations, observations, verification results, acceptance records, canonical accepted transactions, correlation, conflicts, resolutions, supersession, and audit — a *synthetic verified-payment-transaction foundation*, subject to J.3 approval.

**Slice 2A must not establish or imply:**

- that an obligation is paid, satisfied, or partially satisfied;
- any obligation-specific allocation check (no allocation subsystem exists in 2A);
- any `obligation_id` association on evidence or transactions invented to make an acceptance test pass;
- any obligation state other than `proposed` (configuration membership);
- any inference from "funds accepted" to "obligation settled".

Verification in 2A compares an observation against the **configuration version it captured** and the verification contract. It does not compare against an obligation's expected amount; that comparison is a 2B allocation-time determination and requires J.14.

**Checks that belong to 2A:** registration trust; delivery uniqueness; provider reference presence *and equality* across observation, identity, transaction, and correlation; global identity uniqueness; account-binding, global-identity, observation, and reference agreement; accepted-amount equality with the establishing observation; currency agreement with the bound configuration version; exact decimal validity and canonical form; project consistency; correlation recording and cardinality; conflict detection, membership, sealing, and immutability; resolution recording; supersession recording and linearity; orphan-identity refusal; atomic audit.

**Checks that belong to 2B:** request idempotency; per-transaction available funds (I2); per-obligation remaining balance (I1); currency equality across transaction, obligation, and allocation; serialized write; obligation satisfaction under the selected J.14 option; compensating corrections.

**Slice 2A does not weaken the activation predicate.** The canonical predicate requires each required obligation to be individually satisfied against its own expected amount and currency (§F.2). A 2A foundation has no allocation and therefore cannot satisfy that predicate.

---

## 6. Verification, Acceptance, Conflicts, and Supersession

### 6.1 Verification outcome — semantics fixed

`verification_result.outcome` is exactly one of:

| Outcome | Meaning | Persistence consequence |
|---|---|---|
| `passed` | The observation satisfied the approved verification contract and its facts were accepted as evidence | Eligible for acceptance. By itself it creates no transaction and accepts no funds. |
| `failed` | A verification attempt could not reach a conclusion for a technical or transient reason (registration not yet active, provider reference absent, bound baseline stale) | No acceptance. Retry permitted as a new attempt with its own `attempt_seq`. |
| `rejected` | The observation is definitively inadmissible: malformed amount, currency mismatch with the bound version, unknown registration, unbound baseline, or a cross-project identity collision | No acceptance. A corrected observation is a new delivery, not a retry. |

A conflict is **not** an outcome. It is a separate record (§6.4).

### 6.2 Acceptance — the record that replaces the circular pointer

The decision "these funds are accepted on the strength of this verification" is stored once, in `payment_transaction_acceptance`, written after both parents and after the correlation proving they belong together (§5.2). Its constraints make five claims structural in the acceptance record itself — belonging, eligibility, singularity, classification agreement, and baseline agreement.

Two further claims are now enforced one table earlier, on the transaction, and the acceptance record inherits them because the acceptance can only reference a transaction that already satisfied them:

- **Funds-movement agreement.** The transaction's reference equals its identity's reference and its establishing observation's reference (§4.4). An acceptance cannot cite a transaction whose evidence and identity disagree, because such a transaction cannot exist.
- **Amount agreement.** The transaction's accepted amount and scale equal its establishing observation's (§5.3). An acceptance therefore cannot launder a different amount, and a verifier cannot change the amount by passing one — the acceptance record has no amount column at all.

**Multiple attempts** are multiple `verification_result` rows for the same observation, each with its own `attempt_seq`. Exactly one of them (or none) can be accepted; the others remain auditable as attempts. **Failed and rejected attempts** are fully auditable precisely because they have no acceptance row: absence from `payment_transaction_acceptance` is meaningful data, not a gap.

**No deferred constraint is used.** SQLite supports `DEFERRABLE INITIALLY DEFERRED` foreign keys, but this design does not need them: every foreign key is satisfiable at insert time in the order of §5.2. A design that *required* deferral would also depend on no reader observing the intermediate state, which is a much weaker guarantee than an immediate constraint.

### 6.3 The atomic acceptance path (Findings 5 and 5B)

A first-time acceptance is **one** database transaction. The sequence below is the design target; dependency order in §5.2 is what makes it legal.

```
BEGIN IMMEDIATE
  1. re-read the observation, its registration, its account binding, and its
     captured configuration version; verify the verification is `passed`
  2. require observation.provider_transaction_reference IS NOT NULL
     AND <> ''; otherwise reject with `provider_reference_absent` and
     create no identity at all
  3. resolve the global identity from the observation's own tuple
     (provider_account_identity_id, provider_transaction_reference):
       absent      -> INSERT provider_transaction_identity
       present     -> reuse it  (never re-derive it from caller input)
  4. classify the existing state of that identity (§6.3.1):
       no accepted transaction        -> integrity anomaly: reject, alert,
                                         roll back any identity created in 3
       accepted, same project         -> duplicate observation path:
                                         write correlation only, no new
                                         transaction, no new acceptance
       accepted, other project        -> collision path: `rejected`
                                         verification, conflict, alert,
                                         roll back any identity created in 3
  5. INSERT payment_transaction        (reference and accepted amount copied
                                        from the establishing observation)
  6. INSERT payment_transaction_observation   (establishing observation)
  7. INSERT payment_transaction_acceptance
  8. INSERT audit_event                (identifier-only, §8.6)
COMMIT
```

Step 2 is the behavioural consequence of Finding 1's NULL analysis. Revision 4 left "no reference" to the verifier's discretion; Revision 5 makes it a precondition of the write path *and* an impossibility at the schema level (§4.6): correlation cannot exist without a reference, and acceptance cannot exist without a correlation.

**No partial reservation can commit.** Steps 3–8 are one transaction. An identity row created in step 3 and not followed by a committed acceptance is rolled back with it, so a failed acceptance leaves no identity row, no transaction, and no acceptance. This is I12. The schema cannot forbid a transaction row without an acceptance (SQLite has no assertion or "must have child" constraint), so that remains an **application-level limitation** enforced by a single write path, and §6.3.1 states the converse limitation explicitly.

**Visibility.** SQLite is not claimed to provide snapshot isolation (§11.4). Another connection may observe uncommitted state only through a separate read of a database it is not writing; the design depends on atomic commit, not on isolation. The guarantee that matters is the one the database does provide: either all of steps 3–8 are durable or none are.

**The seven outcomes are distinct and must not be conflated:**

| Situation | Durable result | Not |
|---|---|---|
| Verification fails | `verification_result` with `outcome = failed`; observation retained | Not a transaction, not a conflict, not a rejection of the evidence |
| Observation unbound (no configuration version) | Observation retained; `failed` result; no transaction | Not a reservation of an identity |
| Observation has no provider reference | Observation retained; `rejected` with `provider_reference_absent`; no identity, no correlation | Not an identity reservation, not an orphan, not a conflict |
| Duplicate observation for an **already accepted same-project** transaction | New observation + new correlation row; no new transaction, no new acceptance, funds unchanged | Not a second acceptance; not double-counting |
| **Cross-project collision** | `rejected` verification in the refusing project + `cross_project_collision` conflict; no transaction, no identity row committed | Not a merge, not an ownership transfer, not disclosure of the owner |
| **Orphan identity anomaly** (§6.3.1) | `rejected` verification with `identity_integrity_anomaly`; identifier-only operational alert; no transaction, no identity committed | Not an ownership claim, not a silent assignment, not a duplicate identity |
| New observation passes and is accepted | Identity + transaction + correlation + acceptance + audit committed atomically | Not an obligation payment; not an allocation |

**Why a candidate identity is never durable before acceptance.** If the design allowed step 3 to commit on its own, any project could reserve a global reference by submitting an unverifiable delivery, denying the real owner the identity indefinitely — identity squatting. Because the reservation is rolled back unless acceptance commits, the only party that can create an identity is one that also creates a valid accepted transaction for it. There is no "claim" state to abuse, and therefore no cleanup job, expiry, or arbitration rule is required.

#### 6.3.1 Orphan provider transaction identities (Finding 5 of Revision 5)

SQLite cannot require every parent to have a child. Just as the schema therefore permits a transaction row with no acceptance, it permits a `provider_transaction_identity` row with no `payment_transaction`. Revision 4 named the first asymmetry and not the second, and an unnamed limitation is one a later reader will treat as impossible — which is precisely how an orphan becomes an ownership claim.

Five situations must be distinguished, because they look alike in a row listing and are not alike at all:

| # | Situation | What is true | What the design does |
|---|---|---|---|
| 1 | Identity and transaction inserted in one successful acceptance | The identity is owned by the transaction's project; both rows committed together | Normal path. No anomaly. |
| 2 | Identity inserted, transaction rolled back | Nothing durable exists: the identity row is gone with the rollback | No orphan can be produced by the 2A write path (I12) |
| 3 | Pre-existing orphan found during integrity review | An identity row exists with no transaction; its provenance is unknown | **Integrity anomaly.** No automatic use, no automatic cleanup (§6.3.1 rules) |
| 4 | Same-project legitimate retry against an already accepted transaction | The identity is owned by that project's accepted transaction | Duplicate-observation path, not an anomaly: correlation only, no new transaction |
| 5 | Cross-project attempt against an identity that already has an accepted transaction | The identity is owned elsewhere | Collision path: refusal, conflict, no disclosure (§7.5) — handled separately from case 3 |

**Fail-closed handling for a pre-existing orphan** (case 3). The rules are deliberately narrow, and none of them invents a policy:

1. **Anomaly, not ownership.** An orphan identity is an integrity anomaly. Its existence proves that some write path outside the 2A acceptance path created it; it does not prove that the requesting project owns the funds movement, and it does not prove that nobody does.
2. **No automatic assignment.** The acceptance path refuses with `identity_integrity_anomaly` and creates no transaction. It never assigns the identity to the requesting project, and it never treats "no transaction yet" as "unclaimed".
3. **No disclosure.** The refusal names no owner because there is none to name, and the operational alert carries identifiers only — `identity_id` and a digest of the identity tuple (§11.3) — never the account reference, the provider key, another project's identifier, or any amount. §8.6's allowlist already forbids the reference.
4. **No duplicate identity.** A second identity with the same natural key cannot be created: `UQ(provider_account_identity_id, provider_transaction_reference)` refuses it. "Resolve the anomaly by making my own identity" is not available.
5. **No silent adoption and no silent deletion.** Clearing, reassigning, expiring, or quarantining an orphan requires the authorized internal integrity-recovery procedure, which is a Founder/ops act under the existing internal capability (§7.3). This proposal defines the procedure's *preconditions*, not its policy: it must be performed by the internal capability, recorded in the audit trail, and decided with knowledge of which write path created the orphan.
6. **Existing boundaries preserved.** Recovery is not a Founder decision that this document makes, and it authorizes no restoration, no provider activation, and no payment processing. Whether an orphan may ever be associated with a project — and on what evidence — is listed in §16.4 as unresolved.

Why refuse rather than adopt is the safer reading: an orphan is indistinguishable, from the database alone, between "a crash left this behind" and "an attacker created it to be adopted later". The first is a rare operational incident that an authorized human can resolve; the second is silent theft of a funds movement's identity if the path auto-assigns. Refusing costs a delayed acceptance; adopting costs correctness.

### 6.4 Conflicts, sealing, and derived blocking

`reconciliation_conflict` records, immutably, that a detected condition exists. Its kinds:

| Kind | Raised when |
|---|---|
| `duplicate_content_mismatch` | A second observation resolves to an already-accepted identity but reports a different amount, currency, or classification |
| `cross_source_conflict` | Two correlated observations disagree on facts the contract cannot adjudicate |
| `unresolved_correlation` | Two or more observations appear related but no trusted reference establishes it |
| `cross_project_collision` | An identity already owned by another project is claimed again (§4.5) |

Membership is the relation `reconciliation_conflict_observation`, primary key `(conflict_id, observation_id)`: every participant is a foreign key, duplicate membership is rejected by the key, cross-project membership is rejected by the shared project key, and no array exists anywhere in the model. A conflict may additionally name a `payment_transaction_id` when a specific accepted transaction is affected, and a `trigger_observation_id` naming the delivery whose arrival raised it. Both are single, optional columns — never collections (§8.4).

**The participant set is sealed (Finding 3 of Revision 5).** Revision 4's digest was computed from the membership, but membership could still grow afterwards, so the stored key could stop describing the rows it was computed from — and the claim "reconstructable from persisted data" would quietly become false. Revision 5 makes the set immutable at the moment the conflict becomes authoritative:

```
BEGIN IMMEDIATE
  1. compute the digest over project, kind, optional trigger, optional
     transaction, and the full sorted participant set
  2. INSERT reconciliation_conflict         (carrying that digest)
  3. INSERT reconciliation_conflict_observation for every participant
  4. INSERT reconciliation_conflict_seal    (sealed_member_count = the count
                                              the trigger re-checks)
  5. INSERT audit_event
COMMIT
```

Steps 1–5 are one transaction. The seal counts what is actually present (a trigger compares the declared count with `COUNT(*)` of the membership rows, §5.3), and a second trigger rejects any membership inserted after the seal exists. Membership is therefore frozen by the database, not by convention, and the digest cannot drift because the set it hashed cannot change.

**A conflict is authoritative only if it is sealed.** That is the definition I15 adds, and it is what makes "incomplete membership silently becomes authoritative" impossible:

```
sealed(c)              := exists reconciliation_conflict_seal with c.conflict_id
open_conflict          := sealed(c) and no conflict_resolution row for c
blocked_transaction(t) := exists open conflict with t.payment_transaction_id = t
                          or exists open conflict whose membership includes an
                             observation correlated to t
blocked_observation(o) := exists open conflict whose membership includes o
```

An unsealed header blocks nothing and resolves nothing; it is an integrity anomaly reported like an orphan (§8.2), and the atomic write path never leaves one behind.

**New episodes are new conflicts, never additions.** A later disagreement with different membership or a different trigger produces a different digest, therefore a new conflict with its own immutable participant set and its own seal. After an earlier conflict is resolved, the new episode is representable — the terminal-resolution rule (`UQ(conflict_id)` on `conflict_resolution`) applies per conflict, not per condition — and the earlier conflict keeps its sealed set forever. This is the deliberate cost of sealing: a condition that genuinely grows its participant set is represented as a second episode rather than as a mutated first one.

**Concurrent creation converges, it does not duplicate.** Two writers computing the same digest for the same condition produce the same `(project_id, conflict_key)`; the second insert fails `UQ(project_id, conflict_key)` and the write path returns the existing conflict — including its seal, so the caller learns the participant set is already fixed. Two writers with genuinely different sets produce different keys and two episodes, each internally sealed.

Both blocking predicates are **views over immutable rows**. There is no `blocks_use` column and no `status` column, because either would be a mutable field in an append-only table and could drift from the resolution history. Blocking constrains *use* (derived financial position, and the 2B allocation precondition in §12.3), never *existence*.
### 6.5 Supersession — explicit precedence, never "latest wins"

A later verification may supersede an earlier conclusion only by writing a `verification_supersession` record. Rules:

1. **No implicit precedence.** The current position is not "the latest verification row". Selecting the latest row would let a later `failed` observation silently invalidate an earlier accepted transaction — the failure mode the canonical decision forbids (§D.6, §E.2).
2. **A `failed` or `rejected` result never by itself revokes acceptance.** It records an attempt outcome.
3. **Revocation requires a supersession record** naming the superseded verification, the superseding verification, the shared observation, a `reason_code`, and the authority that produced it. In Slice 2A only approved J.3 rules may create one; no human override exists in 2A.
4. **Supersession is linear in both directions and terminal per record:** at most one successor and at most one predecessor, so a chain can neither branch nor converge; a supersession cannot be undone; the successor may itself be superseded later.
5. **The derived position walks the chain** from the accepted verification to its head, then applies open conflicts as blocks.
6. **A supersession never deletes or mutates** the superseded result, the transaction, or the observations.

Rule 4 is the correction of Finding 3. Revision 3 declared `UQ(superseded_verification_id)` only, which forbade branching but permitted `V1 → V3` and `V2 → V3`: two predecessors converging on one successor, which is not a chain. `UQ(superseding_verification_id)` closes that, and the shared `observation_id` closes the scope question that Revision 3 left to project-level consistency.

### 6.6 Immutability of accepted funds

Once a `payment_transaction` and its acceptance exist, their identity, accepted amount, accepted currency, classification, and baseline are immutable. Later information cannot rewrite them, and cannot create a second transaction for the same identity (I7). This prevents a later failed observation from silently erasing earlier accepted funds while also preventing a replay from doubling them.

A failed verification never pretends an accepted payment exists, and never requires one to exist: `verification_result` references only its observation, and the observation exists independently of any transaction.

---

## 7. Trust Boundaries, Project Isolation, and Security

All rules below reuse the canonical decision's existing security contract (§G.2, §G.3, §H). No new customer capability is introduced.

### 7.1 How trusted provider/account identity is established

By a `provider_account_identity` row (the real account), a `payment_provider_account` row (one project's binding of it), and a `payment_source_registration` row (one channel into that binding), all created by the Founder/internal capability on the internal surface. The `provider_key`, `provider_environment`, `provider_account_reference`, and `source_namespace` values come from server-side configuration, never from a request body. A syntactically valid namespace supplied by an untrusted caller is **not** trusted: matching a string is not authentication.

The two-level split matters here for a security reason, not only a modelling one. A project may bind an account that another project also binds — that is normal for a business with two engagements on one merchant account — but *creating a binding* is an internal act that names an existing global account identity. A project cannot invent an account identity by picking an unused account reference, because the binding requires the global row to exist, and global rows are created only by the internal surface.

### 7.2 How external observations become associated with a project

The observation stores `source_registration_id`, `provider_account_id`, and `project_id`, and the composite key `(source_registration_id, provider_account_id, project_id)` requires a registration row with exactly those three values. All three are derived server-side from the resolved registration; a caller cannot supply a project that its registration does not belong to, because no such parent row exists. If a request carries a project reference, it is resolved within the caller's organization and compared against the registration's project; mismatch is rejected and recorded as `cross_project_collision`.

### 7.3 How project ownership is derived rather than trusted

The existing pattern is mandatory: resolve the caller-supplied reference inside the caller's organization, then re-check authorization server-side on every read and every write. Internal payment operations require the internal capability attached to a Person and never run on a customer route with hidden controls. Ownership of a funds movement is a property of the accepted transaction (`payment_transaction.project_id`), fixed at creation by the write path and never updated.

### 7.4 How configuration and baseline identities are checked

A transaction or allocation may reference only a configuration version belonging to the same project: `(payment_config_version_id, project_id)` → `payment_configuration_version(payment_config_version_id, project_id)` is applied on the observation, the transaction, and (in 2B) the obligation. The transaction's version additionally must equal its establishing observation's captured version, by `(source_observation_id, payment_config_version_id)`. The configuration's `proposal_version_id` and `agreement_version_id` are captured immutably at version creation; staleness is derived by comparing them with the project's current versions, and a stale version is not silently used (canonical decision §B.1).

### 7.5 How cross-project collisions are rejected

Canonical identity is global (§4.3). If a provider reference resolves to an existing identity whose transaction is owned by a different project, the write is refused by `UNIQUE(payment_transaction.identity_id)`, a `rejected` verification result is recorded, and a `cross_project_collision` conflict is raised in the refusing project. A second project never inherits, duplicates, or sees another project's transaction, and the owning project's records are untouched by the attempt. The refusing project's conflict row carries its own observations and the identity tuple only — never the owner's `project_id` or `payment_transaction_id`.

**An orphan identity is not a weaker form of collision.** A collision has a known owner and is refused without naming it; an orphan has no owner record at all and is refused without inventing one (§6.3.1). The two refusals differ in reason code (`cross_project_collision` versus `identity_integrity_anomaly`), in what is written (a conflict versus only a rejected verification), and in who may resolve them (nobody in 2A versus an authorized internal recovery). Treating "no transaction found" as "claimable" would convert the second into an ownership-acquisition path, so the acceptance path never does it: the absence of a transaction is evidence of a broken write path, not evidence of vacancy.

The refusing project sees its own verification result and, when a conflict applies, its own conflict row. Neither carries the owning project's identifier, the account reference, or the provider key; the internal operational channel carries `identity_id` and an identity-tuple digest, which is enough for an operator to find the row and not enough to widen a project's read scope or to reconstruct a provider reference from an audit trail.

### 7.6 How customer access stays read-only

Customer surfaces expose derived status only, under existing project-access checks. There is no customer route that writes payment state, submits evidence, or allocates funds — in this design or any later one implied here.

### 7.7 How automated provider authentication differs from human authorization

Automated verification is `verifier_kind = automated` with `verified_by IS NULL` (a checked constraint) and `verifier_reference` naming the verifier configuration that ran. It authenticates a *channel*, not a person. Human determination is `verifier_kind = human` with `verified_by` set, requires the internal capability and a J.10 decision, and is outside Slice 2A: the value is not in the column's check domain, so a migration is required before it can appear at all. An automated pass can never produce a human determination, and vice versa.

### 7.8 How audit records stay identifier-only

`audit_event.metadata` is restricted to an allowlist of identifier keys (§8.6). No amounts, currencies, payloads, credentials, or provider secrets. Enforcement is by allowlist rejection at write plus a test that rejects forbidden key patterns — not by searching for one sample amount string.

---

## 8. Slice 2A Schema, Constraints, and Lifecycles

### 8.1 Scope

Slice 2A is the synthetic, provider-neutral foundation: global provider account identities and their project bindings, registrations, observations, verification results, acceptance records, canonical transactions, correlation, conflicts, resolutions, supersession, exact decimals, currency agreement, project isolation, identifier-only audit. Synthetic/test data only. It requires J.3 resolution before implementation.

### 8.2 Constraint inventory

Each row is an invariant this proposal *depends on*, the mechanism that enforces it, and what it prevents. Anything enforced only in application code appears at the end of the table, labelled, and is also listed as a limitation in §16.4.

| Invariant | Mechanism | Prevents |
|---|---|---|
| I7: one transaction per funds movement | `UQ(provider_account_identity_id, provider_transaction_reference)`; `UQ(payment_transaction.identity_id)` | Double acceptance across channels, registrations, or projects |
| Account identity is global, binding is per project | `UQ(provider_key, provider_environment, provider_account_reference)` on `provider_account_identity`; `UQ(project_id, provider_account_identity_id)` on the binding | Two global identities for one real account; two bindings of one account in one project |
| Identity, binding, observation, and project agree | Twelve composite FKs on `payment_transaction`; the identity, binding, observation, project, and classification ones are listed here, the reference and amount ones in the rows below (§4.4, §5.3) | A transaction assembled from unrelated records |
| The transaction's provider reference equals the identity's **and** the evidence's | FK `(identity_id, provider_account_identity_id, provider_transaction_reference)` → identity; FK `(source_observation_id, provider_account_identity_id, provider_transaction_reference)` → observation | Accepting one funds movement on evidence of another (§4.1) |
| The accepted amount equals the evidence's amount and scale | FK `(source_observation_id, accepted_amount_normalized, accepted_amount_scale)` → `(observation_id, amount_normalized, amount_scale)`; canonicality checks on both tables | Accepting ₹1,000 on ₹10,000 of evidence (§4.1) |
| The observation's global account identity equals its binding's | FK `(provider_account_id, provider_account_identity_id)` → `payment_provider_account` | Evidence attributed to a binding that has since been rebound |
| An observation is proven to belong to its binding | Composite FK `(source_registration_id, provider_account_id, project_id)` → registration | Observations attributed to a channel or account they did not arrive through |
| Registration never defines funds identity | No registration column on `payment_transaction`; registration id absent from the funds key | Channel-scoped identity drift |
| Unresolved observations exist without a transaction | No transaction column on `payment_observation`; correlation is a relation | Phantom transactions invented to satisfy a mandatory FK |
| I11: one transaction per observation | PK `observation_id` on `payment_transaction_observation` | One delivery funding two accepted transactions |
| Many observations per transaction | `payment_transaction_id` not unique in the correlation relation | Losing second-channel evidence for an accepted movement |
| Conflict membership is relational | PK `(conflict_id, observation_id)`; shared project key | ID arrays, dangling references, cross-project membership |
| Exactly one acceptance per transaction | `UQ(payment_transaction_id)` on acceptance | Competing or repeated acceptances |
| Exactly one transaction per accepted verification | `UQ(verification_id)` on acceptance | Reusing one pass to accept two movements |
| Only `passed` can be accepted | `CK(verification_outcome = 'passed')` + composite FK to `(verification_id, outcome)` | Accepting failed or rejected attempts |
| Acceptance requires proven belonging | Composite FK `(observation_id, payment_transaction_id)` → correlation | Accepting a verification of an unrelated observation |
| Acceptance cannot cross projects | Shared `project_id` in composite FKs to both parents | Cross-project acceptance |
| Synthetic ≠ live | `data_classification` on observation, verification, transaction, acceptance with propagation keys | Test data laundering into real evidence |
| Unbound observation never accepted | `CK(outcome <> 'passed' OR config_binding_state = 'bound')`; acceptance version keys cannot match a NULL parent value | Silent acceptance without a commercial baseline |
| Baseline is immutable | `payment_transaction.payment_config_version_id NOT NULL` + no update path | Retroactive reinterpretation |
| Transaction baseline equals its evidence | Composite FK `(source_observation_id, payment_config_version_id)` | Choosing a baseline independent of the observation |
| Currency matches the baseline | Composite FK `(payment_config_version_id, accepted_currency)` | Mixed-currency acceptance |
| One current registration per scope | PK `(project_id, provider_account_id, source_kind, source_namespace)` + compare-and-swap (§8.3) | Concurrent replacement producing two currents |
| Projection points into its own scope | Composite five-column FK from projection to registration | A projection row pointing at another project's or channel's registration |
| Registration history is append-only | No update path; successor recorded by `supersedes_registration_id` | Lost or rewritten registration history |
| Registration chain stays in one scope | Self-referential six-column composite FK | Cross-project, cross-account, cross-channel, or cross-namespace supersession |
| One successor per registration | `UQ(supersedes_registration_id)` | Two registrations claiming the same predecessor |
| No registration cycle | Carried `supersedes_revision_seq` + `CK(revision_seq > supersedes_revision_seq)` + root rule | R→R, A→B→A, longer cycles, backdated insertion |
| One successor per verification | `UQ(superseded_verification_id)` | Branching |
| One predecessor per verification | `UQ(superseding_verification_id)` | Converging chains |
| Supersession stays in one observation and project | Shared `observation_id`/`project_id` in both composite FKs | Superseding a verification that decides different evidence |
| No verification cycle | Carried `attempt_seq` values + `CK(superseding_attempt_seq > superseded_attempt_seq)` | Two-node and longer cycles; self-supersession |
| A correlated observation carries the transaction's account and reference | Two three-column FKs on `payment_transaction_observation`; `NOT NULL` columns and `CK(<> '')` | A `provider_shared_reference` correlation that shares neither the account nor the reference |
| No correlation without a reference | `provider_transaction_reference NOT NULL` on the correlation; nullable on the observation, and NULL never matches a `NOT NULL` child | A reference-less delivery entering the acceptance chain through a NULL key |
| A conflict's participant set is fixed when it becomes authoritative | `reconciliation_conflict_seal` + count trigger + post-seal insert trigger (§5.3, §8.4) | Membership growing after the digest was computed |
| Sealed membership cannot be edited or removed | `BEFORE UPDATE`/`BEFORE DELETE` triggers that `RAISE(ABORT)` | Rewriting a participant set by mutation instead of by a new episode |
| An unsealed conflict is not authoritative | Derived predicate `sealed(c)` in §6.4 | A partially written conflict blocking or resolving anything |
| Timestamps are fixed-width and numeric | `GLOB '[0-9]…'` shape check plus field-range checks (§8.5) | Non-numeric characters in digit positions |
| Conflict idempotency | Deterministic `conflict_key` over persisted fields + `UQ(project_id, conflict_key)` (§8.4) | Duplicate open conflicts for one condition |
| Conflict resolution is terminal | `UQ(conflict_id)` on `conflict_resolution` | Re-resolution rewriting history |
| Every row has an identity | Every table declares a primary key (§5.3) | Unaddressable records |
| Audit is identifier-only | Allowlist at write (§8.6) + forbidden-pattern test | Amount, credential, or payload leakage |
| Amounts are exact | Grammar and normalization (§10) | Float, lexicographic, or scale-based money errors |

**Application-level rules, labelled as such and not counted as database enforcement:**

1. *Which project first establishes an identity* — and therefore owns the funds movement — is decided by which acceptance write commits first. The database guarantees that only one transaction can exist per identity (`UQ(identity_id)`); it cannot choose the winner.
2. *Verification content* — whether an amount is plausible for the contract — is application logic. The database enforces the structural consequences of the decision, not its quality.
3. *A transaction row without an acceptance row* — the schema permits the row because SQLite has no assertion or mandatory-child constraint. No 2A write path produces one (§6.3); this is a single-write-path discipline, not a constraint.
4. *An identity row without a transaction* (an orphan) — the same missing mandatory-child constraint, in the other direction. No 2A write path produces one, and the acceptance path refuses an orphan rather than adopting it (§6.3.1).
5. *A conflict header without a seal* — the schema permits the header; the triggers only constrain membership once a seal exists. Such a header is inert by the derived definition (§6.4) and is reported as an anomaly; no 2A write path leaves one.
6. *The conflict digest itself* — SQLite has no SHA-256 function, so `conflict_key` is computed by application code. The database enforces its uniqueness, its immutability, and the seal's equality with the header; a recomputation test proves the algorithm (§8.4).
7. *Timestamp calendar validity* — the checks constrain digit positions and field ranges, not month lengths or leap years (§8.5). Ordering never depends on timestamps, so this gap cannot affect precedence.
8. *Parsing the provider's original amount text* — the canonicality checks constrain the stored normalized form; they cannot prove that normalization parsed the source text correctly (§10.3, §10.7).

---

### 8.3 Source registration lifecycle (Finding 4)

**History versus current.** `payment_source_registration` is the authoritative, append-only history. `payment_source_registration_current` is a **projection**: one row per scope, pointing at the registration currently in force. It is explicitly mutable, explicitly non-authoritative, and fully rebuildable.

**The "at most one current" rule** is the projection's primary key:

```sql
PRIMARY KEY (project_id, provider_account_id, source_kind, source_namespace)
```

No partial index over a derived status is used, and no `is_active` flag is trusted: a stale flag can disagree with reality and cannot be constrained, whereas a primary key cannot.

**The scope is proven, not implied.** The projection's `source_registration_id` is not a single-column pointer. The foreign key repeats all five scope columns:

```sql
FOREIGN KEY (source_registration_id, project_id, provider_account_id,
             source_kind, source_namespace)
  REFERENCES payment_source_registration
             (source_registration_id, project_id, provider_account_id,
              source_kind, source_namespace)
```

so a projection row can only point at a registration that has exactly those five values. Revision 3's single-column key allowed a projection row for project A / account B / channel C to point at a registration belonging to project D.

**Ordering within a scope: `revision_seq`.** Integers, not timestamps (Finding 7). Allocation happens inside `BEGIN IMMEDIATE`:

```sql
-- inside the write transaction
SELECT COALESCE(MAX(revision_seq), 0) + 1
  FROM payment_source_registration
 WHERE project_id = :project AND provider_account_id = :account
   AND source_kind = :kind AND source_namespace = :namespace;
```

`UQ(project_id, provider_account_id, source_kind, source_namespace, revision_seq)` is the backstop: if two writers ever allocated the same value, the second insert fails rather than creating two registrations at one sequence position. The first registration in a scope has `revision_seq = 1`, `supersedes_registration_id = NULL`, and `supersedes_revision_seq = NULL`; a CHECK forbids a root with a predecessor and forbids a non-root without one.

**First registration — insertion**

```sql
INSERT INTO payment_source_registration VALUES (... revision_seq = 1, NULL, NULL ...);
INSERT INTO payment_source_registration_current
     (project_id, provider_account_id, source_kind, source_namespace,
      source_registration_id, current_since)
VALUES (:project, :account, :kind, :namespace, :new, :now);
```

A second insert for the same scope fails on the projection primary key — which is the intended outcome, not an error to swallow.

**Replacement — compare-and-swap with an explicit expected value**

```sql
-- 1. append the successor (its own revision_seq, its predecessor's id and seq)
INSERT INTO payment_source_registration VALUES (... :new, :seq, :expected_current, :expected_seq ...);

-- 2. move the projection, but only from the value the caller observed
UPDATE payment_source_registration_current
   SET source_registration_id = :new,
       current_since          = :now
 WHERE project_id = :project AND provider_account_id = :account
   AND source_kind = :kind   AND source_namespace = :namespace
   AND source_registration_id = :expected_current;

-- 3. require changes() = 1
```

Step 3 is not optional. Zero changed rows means the caller's expectation was stale: the whole transaction — including the successor inserted in step 1 — is rolled back and the operation reports `registration_superseded_concurrently`. It is never silently retried, because retrying would replace a registration the caller never observed.

**Why the compare-and-swap is safe.** `BEGIN IMMEDIATE` acquires the write lock before the first read, so two replacements cannot interleave a read-compare-write sequence: the second sees the first's committed pointer, its `WHERE` no longer matches `:expected_current`, and `changes()` is zero. The row identity in the `WHERE` clause is the full primary key, so the update can affect at most one row; the affected-row requirement converts "at most one" into "exactly the one I expected". The concurrency assumption is therefore *writers are serialized by SQLite's write lock* — the same assumption §12.3 relies on — and no reader-level isolation is assumed (§11.4).

**`current_since` semantics.** It is the time at which the pointed-to registration became current at this scope. It is set when the row is inserted and reset on every successful compare-and-swap. It is descriptive; ordering is `revision_seq`. A projection rebuild therefore reproduces `source_registration_id` exactly and `current_since` approximately (the rebuild cannot know historical wall-clock times better than the audit trail does), which is why the projection is labelled non-authoritative.

**Rebuild.** For each scope, the current registration is the chain head: the registration whose `revision_seq` is maximal for that scope, equivalently the one that no other registration names as `supersedes_registration_id`. A rebuild is:

```sql
INSERT INTO payment_source_registration_current (...)
SELECT r.project_id, r.provider_account_id, r.source_kind, r.source_namespace,
       r.source_registration_id, r.created_at
  FROM payment_source_registration r
 WHERE NOT EXISTS (SELECT 1 FROM payment_source_registration s
                    WHERE s.supersedes_registration_id = r.source_registration_id);
```

**Relationship to identity.** A registration change never changes any existing transaction, because no transaction references a registration (§4.2). An observation ingested under a registration that is later replaced keeps its own `source_registration_id` forever; that is historical provenance, not identity.

### 8.4 Conflict lifecycle, the deterministic key, and sealing (Findings 6 and 3)

Revision 3 hashed a `trigger_record_id` that no column defined and a sorted collection of participating transaction ids that no relation stored, so the key could not be reconstructed from the database. Revision 4 restricted the digest to fields that are actually persisted and stated exactly how each participant is recovered. Revision 5 closes the remaining hole: a digest over a set that can still grow is reproducible only until the next write, so the set is now **sealed** when the conflict becomes authoritative (§6.4).

**Digest inputs, and where each comes from**

| Position | Field | Source |
|---|---|---|
| 0 | Domain separator `conflict/v1` | Constant literal |
| 1 | `project_id` | `reconciliation_conflict.project_id` |
| 2 | `conflict_kind` | `reconciliation_conflict.conflict_kind` |
| 3 | `trigger_observation_id`, or the absent marker | `reconciliation_conflict.trigger_observation_id` |
| 4 | `payment_transaction_id`, or the absent marker | `reconciliation_conflict.payment_transaction_id` |
| 5 | Participant count, decimal | `COUNT(*)` over the membership rows, frozen as `reconciliation_conflict_seal.sealed_member_count` |
| 6… | Sorted participant observation ids | `reconciliation_conflict_observation.observation_id` |

There is no third collection. A conflict names **at most one** transaction, in a persisted column; if a future conflict kind genuinely needs several, it requires a `reconciliation_conflict_transaction` relation and a `conflict/v2` domain separator, which is out of scope for 2A and is not implied by this design.

Every input is therefore a column of the conflict row, a column of a membership row, or a `COUNT(*)` over exactly those rows — and after sealing, both the count and the rows are immutable, so recomputation is not merely *possible* but yields one value for the lifetime of the conflict.

**Byte-level canonicalization**

```
field(x)   := decimal_ascii(len(utf8(x))) || ':' || utf8(x)
absent     := field("absent")                    -- six-byte token, not an empty string
material   := field("conflict/v1")
           || field(project_id) || field(conflict_kind)
           || field(trigger_observation_id or absent)
           || field(payment_transaction_id or absent)
           || field(decimal(count))
           || concat(field(observation_id) for each id in ascending byte order)
conflict_key := lowercase_hex(SHA-256(material))
```

Properties that make this reconstructable and unambiguous:

1. **Every field is length-prefixed**, so a value containing `:`, `0x1F`, a comma, or a quote cannot shift a boundary. There is no delimiter scheme to escape, and no ambiguity to argue about.
2. **Encoding is UTF-8**, and the only characters in ids are the ones the system generates, but the prefix makes that irrelevant to correctness.
3. **Sorting is by raw UTF-8 byte order ascending**, which is SQLite's `BINARY` collation for `TEXT` and matches a byte-wise application sort. Two writers computing the same set therefore produce the same order without sharing a locale.
4. **Absence is a distinct token**, not an empty string, so "no trigger" and "trigger with an empty id" cannot collide (the latter is impossible anyway, but the encoding does not depend on that).
5. **No timestamps, no random salt, no mutable state.** Recomputing the digest months later from the stored rows yields the same bytes.

**Convergence and new episodes.** Re-detecting the same condition with the same participants and the same trigger yields a byte-identical key; `UQ(project_id, conflict_key)` rejects the second insert, the write path returns the existing conflict id and its seal, and no second membership set is created. A genuinely new episode differs in its trigger or its membership, therefore in its key, and inserts cleanly — the terminal-resolution rule does not become a dead end, and a resolved conflict does not have to be reopened to represent new evidence.

**Resolution.** `conflict_resolution` is append-only with `UQ(conflict_id)`: exactly one terminal resolution per conflict. A conflict is never edited to look resolved, and a resolution is never deleted. "Open" is derived (§6.4) — sealed and unresolved — so a resolved conflict's full history stays readable, and its sealed participant set stays fixed.

**Sealing the participant set.** The set is fixed by the following mechanisms acting together; none of them alone would be enough:

| Mechanism | Enforces | Would allow if absent |
|---|---|---|
| `reconciliation_conflict_seal` with `UQ(conflict_id)` | Exactly one seal per conflict, carrying the count and the digest being sealed | A conflict that is "authoritative" with no recorded set boundary, or several competing seals |
| Count trigger (§5.3) | `sealed_member_count` equals `COUNT(*)` of the membership rows at seal time | A seal that declares a set smaller or larger than the one actually written |
| Post-seal insert trigger (§5.3) | No membership row may be inserted once the seal exists | Membership growing after the digest was computed — the Revision 4 defect |
| Update/delete triggers (§5.3) | Sealed membership and the seal itself cannot be edited or removed | "Unsealing" by deletion, which would reopen the set without a new episode |
| Derived `sealed(c)` predicate (§6.4) | Only a sealed conflict blocks or resolves | A partially written conflict acquiring authority through mere existence |

The write order — header, membership, seal, audit, in one `BEGIN IMMEDIATE` transaction — is what makes the count check meaningful: the trigger sees the membership rows the same transaction inserted, so it compares the declared count with reality rather than with a caller's claim. A failure at any step rolls back the whole group, so there is no state in which a sealed conflict has partial membership or an audit row describes a conflict that did not commit (I6).

**What is database-enforced, and what is not.** The count, the immutability, and the one-seal rule are database-enforced by the seal table's constraints and the four triggers. That a conflict is *created* with a seal is not: SQLite cannot require a child to exist. It is guaranteed by the single atomic write path, is listed as an application-level limitation (§8.2 item 5), and an unsealed header is inert rather than authoritative.

### 8.5 Supersession lifecycle and ordering contracts (Findings 3 and 7)

**The ordering contract.** Ordering is an integer sequence scoped to the parent, allocated inside the serialized write transaction, and carried into the child row where a composite key proves it genuine (I10).

| Lifecycle | Sequence | Scope | Allocation | Carried into the child by |
|---|---|---|---|---|
| Verification attempts | `attempt_seq` | One observation | `COALESCE(MAX(attempt_seq),0)+1` for that observation inside `BEGIN IMMEDIATE` | Composite FK `(verification_id, observation_id, project_id, attempt_seq)` |
| Registration revisions | `revision_seq` | One `(project, account, kind, namespace)` scope | Same pattern, per scope | Self-referential six-column composite FK |

**Why text timestamps are not used.** SQLite compares `TEXT` lexicographically. Two ISO-8601 strings compare chronologically only if they share a fixed width, a fixed fractional precision, a fixed suffix, and a single offset. `2026-11-04T12:00:00Z`, `2026-11-04T13:00:00+01:00`, and `2026-11-04T12:00:00.000Z` are the same instant in three representations that sort three different ways, and `2026-11-04T12:00:00.9Z` sorts before `2026-11-04T12:00:00.10Z` while being later. Revision 3's `CK(superseding_created_at > superseded_created_at)` therefore proved only *string* order. Clock values are also not monotonic and not unique, so no amount of format discipline would make them a correctness basis.

**What is enforced instead.** The strict-increase check compares two integer columns that are *in the same row* and whose values are proven to be the parents' actual sequences by composite foreign keys. Since `attempt_seq` increases strictly along every edge within one observation, and both ends of an edge must belong to the same observation (§5.3), a cycle would require a strictly increasing sequence to return to its starting value. Self-supersession is additionally rejected by `CK(superseding_verification_id <> superseded_verification_id)`.

**Linearity.** `UQ(superseded_verification_id)` permits at most one successor; `UQ(superseding_verification_id)` permits at most one predecessor. Together they forbid branching (`V1→V2`, `V1→V3`) and convergence (`V1→V3`, `V2→V3`) while permitting `V1→V2→V3`, because the two constraints are on different columns and a middle node appears once in each.

**Concurrent supersession attempts.** Two racing attempts to supersede the same verification both insert rows naming it as `superseded_verification_id`; the second fails the unique constraint. Nothing is decided by a racy read, and the write transaction is serialized in any case (`BEGIN IMMEDIATE`).

**Descriptive timestamps: digit-accurate shape, no calendar claim.** `attempted_at`, `created_at`, `received_at`, `accepted_at`, `detected_at`, `decided_at`, `sealed_at`, `correlated_at`, `current_since`, `first_registered_at`, and `first_observed_at` are canonical UTC text of fixed width. Revision 4 constrained them with `LIKE '____-__-__T__:__:__.___Z'`, and `_` in a `LIKE` pattern matches **any single character**, so `2026-AB-CD T1x:..` satisfied it. Revision 5 uses `GLOB`, whose bracket classes match actual characters:

```sql
-- one canonical predicate, applied to every descriptive timestamp column
CHECK (ts GLOB
  '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z')
CHECK (substr(ts,  6, 2) BETWEEN '01' AND '12')   -- month
CHECK (substr(ts,  9, 2) BETWEEN '01' AND '31')   -- day
CHECK (substr(ts, 12, 2) BETWEEN '00' AND '23')   -- hour
CHECK (substr(ts, 15, 2) BETWEEN '00' AND '59')   -- minute
CHECK (substr(ts, 18, 2) BETWEEN '00' AND '59')   -- second
```

The `GLOB` pattern is anchored and has no wildcard, so it fixes every position *and* the total length at 24 characters; a separate `length(ts) = 24` check would be redundant and is not claimed as an additional guarantee. Its twelve bracket classes match only ASCII digits, so a letter in a digit position fails. The five `substr` checks are the ranges that `GLOB` cannot express and that fixed-width text decides correctly: `'01' AND '12'` is a valid month test *because* the field is exactly two digits, so lexicographic and numeric order coincide.

**What is still not enforced, stated rather than implied.** Those checks do not prove calendar validity: `2026-02-31T00:00:00.000Z` passes, and so does `2026-02-29` in a non-leap year. Month length, leap years, and any relationship between the timestamp and real time are **application-validated** (§8.2 item 7, §16.4). No constraint here claims otherwise, and none needs to: ordering never depends on these columns (I10), so an impossible-but-well-shaped timestamp can mislead a human reading a log line and cannot reorder a lifecycle.

**Why the shape still matters at all.** A column that is only ever displayed is still an interface: an operator comparing two rows, a future export, or a scheduled job that parses the field. A constraint that rejects `12:00:00.9Z` and `12:00:00+01:00` keeps that interface single-shaped, which is a narrowly stated benefit and not a claim of temporal correctness.

**A later `failed` attempt does not revoke acceptance.** Only a supersession row changes derived precedence, and only an approved J.3 rule may write one in Slice 2A.
**A later `failed` attempt does not revoke acceptance.** Only a supersession row changes derived precedence, and only an approved J.3 rule may write one in Slice 2A.

### 8.6 Audit allowlist

Permitted `audit_event.metadata` keys: `observation_id`, `verification_id`, `acceptance_id`, `payment_transaction_id`, `identity_id`, `conflict_id`, `resolution_id`, `supersession_id`, `source_registration_id`, `provider_account_id`, `provider_account_identity_id`, `paymentConfigVersionId`, `proposalVersionId`, `agreementVersionId`, `obligation_id`, `allocation_id`, `allocation_request_id`, `versionNumber`.

Rejected patterns at write time: any key matching `/amount|currency|due|scope|credential|secret|payload|token|reference|signature|email|name/i`.

`provider_account_identity_id` is added in Revision 4 because the two-level account model produces it and operators need to correlate a collision report with a real account without exposing the reference itself. Revision 2's `evidence_id` remains removed: no such column, table, or identifier exists, and an allowlist entry for a non-existent field is exactly the drift this document is meant to eliminate. `provider_transaction_reference` is deliberately **not** on the allowlist — it is an external identifier, and internal tracing is satisfied by `payment_transaction_id`.

This allowlist is the primary control. A substring search for a literal sample amount is retained only as a regression assertion, never as the proof of privacy.

### 8.7 What Slice 2A explicitly does not contain

No `allocation`; no `allocation_request`; no obligation linkage on evidence or transactions; no obligation state beyond `proposed`; no payment-attempt, retry, dunning, or notification subsystem; no manual determination; no customer upload; no activation predicate or event; no provider integration; no refund, reversal, or chargeback handling; no production data; no conflict-transaction membership relation (a conflict names at most one transaction, §8.4).

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
| `provider_transaction_reference` | `provider_transaction_identity`, `payment_observation`, `payment_transaction`, `payment_transaction_observation` | TEXT (provider's opaque funds reference) | observation: **yes** (a delivery may lack one); identity, transaction, correlation: no | none | Part of `UQ(provider_account_identity_id, provider_transaction_reference)` and of four parent/child keys | `CK(<> '')` where `NOT NULL`; equality enforced by composite keys (§4.4, §4.6) | yes | Nullable only on the observation, where it makes the row unusable as acceptance evidence |
| `sealed_member_count` | `reconciliation_conflict_seal` | INTEGER ≥ 1 | no | none | none | `CK(>= 1)`; trigger equality with membership `COUNT(*)`; `seal_version` pins the digest domain | yes | Fixed when the conflict becomes authoritative; never updated |
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

**Canonicality is checked, not assumed.** Normalization is application code, and an application rule that is not checked can drift. Revision 5 therefore constrains the stored *form* on both tables (§5.3): the fraction may not end in `0`, and `amount_scale` must equal the number of fractional digits, computed as `length(x) - instr(x, '.')`. The two checks together admit exactly one stored representation per value — `1500` with scale 0, never `1500.00` with scale 2 — which is what makes a *text equality* key a valid proxy for value equality. They do not re-parse the provider's original text, and they do not detect a normalization bug that produces a wrong but well-formed value; those remain application-level (§8.2 item 8).

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

**Amount equality across the evidence boundary.** Slice 2A applies no transformation to an amount between evidence and acceptance: the accepted amount and scale must equal the establishing observation's, enforced by the composite key `(source_observation_id, accepted_amount_normalized, accepted_amount_scale)` → `payment_observation(observation_id, amount_normalized, amount_scale)` (I14). Fees, deductions, settlement differences, refunds, reversals, and currency conversion are **not** modelled here and are not authorized by this document; a future mechanism that legitimately changes an amount would need its own record, its own evidence, its own authority, and a separate Founder decision (J.5, J.6), because it cannot be expressed by editing an accepted transaction — that row is immutable and its amount is proven against its source.

A second observation reporting a different amount for an already accepted identity does not change the accepted amount and does not create a second transaction: it is correlated evidence plus a `duplicate_content_mismatch` conflict (§6.4). The conflict is the record that the provider said two different things; the transaction remains the record of what was accepted first.

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
| **Trigger abort** | `RAISE(ABORT, …)` from a seal or membership trigger (§5.3, §8.4) | Not a transient error and not retried: it means the write path attempted a post-seal insert or declared a count it cannot support. The transaction rolls back and the condition is reported. |
| **Other persistence failure** | I/O, disk, corruption | Fail the operation; no retry loop. |
| **Verification rejection** | Business outcome | Not an error: a `rejected` verification result is committed. |
| **Reconciliation conflict** | Detected inconsistency | Not an error: a conflict record is committed, or convergence returns the existing one. |

### 11.2 Bounded retry — a recommendation, not a guarantee

Proposed: retry the entire transaction up to 5 attempts with exponential backoff and jitter (base ~50 ms, cap ~1 s). This is a **technical recommendation to be validated during implementation**, not a guarantee that a write eventually succeeds. The whole transaction is retried, never a partially applied one; rollback precedes retry. A stale compare-and-swap is not retried automatically, because the correct response is to re-read the registration state and surface the conflict to the caller.

### 11.3 Audit integrity on failure

- When a write **succeeds**, the material records and their identifier-only audit rows commit in one transaction (I6). Either both exist or neither does.
- When a write **fails**, no audit row can be claimed. The failure is reported through an out-of-band operational channel (structured application log or metric) containing only: operation type, project identifier, record identifier if one was assigned before the failure, identity tuple digest where applicable, failure class, attempt count, and timestamp. No amounts, no currency, no provider payload, no credentials, no customer-sensitive content.
- **The identity tuple digest** is a SHA-256 over the identity's natural-key tuple, encoded with the same length-prefixed scheme as the conflict digest (§8.4) under its own domain separator. It lets an operator locate an identity row — including an orphan (§6.3.1) — without writing the provider account reference or the provider transaction reference into a log, both of which are external identifiers that §8.6 excludes from the audit surface. A digest is a lookup aid, not a secret; it is reported only on the internal operational channel, never to a project-facing caller.
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

**No test was executed during this documentation revision.** Everything in §15 is a **proposed acceptance criterion** — a design specification of behaviour a later implementation must exhibit — not a reported result. Each criterion names the constraint, relation, or mechanism it exercises, so that an implementation cannot satisfy it by application-level mimicry of the outcome.

Each criterion below is written so that it has a **negative** counterpart wherever the design claims a refusal. A test that only demonstrates the happy path does not demonstrate a constraint.

### 15.1 A. Global account and transaction identity

| # | Test | Expected |
|---|---|---|
| 1 | Same real account registered by two projects | One `provider_account_identity`; two `payment_provider_account` rows referencing it; both bindings insert successfully |
| 2 | Same account key inserted twice | Second insert fails `UQ(provider_key, provider_environment, provider_account_reference)` |
| 3 | Same reference via webhook and via reconciliation import | One identity, one transaction, two observations, both correlated; funds counted once |
| 4 | Same reference via two registrations of one account | One identity, one transaction; both observations correlated; the registration id appears nowhere on the transaction |
| 5 | Correct identity-to-account binding | Transaction insert succeeds when all scope columns agree |
| 6 | Identity paired with a binding from **another** global account | Insert fails FK `(provider_account_id, provider_account_identity_id)` |
| 7 | Identity paired with an observation from **another account** | Insert fails FK `(source_observation_id, provider_account_id)` |
| 8 | Transaction whose observation belongs to **another project** | Insert fails FK `(source_observation_id, project_id)` |
| 9 | Transaction whose binding belongs to **another project** | Insert fails FK `(provider_account_id, project_id)` |
| 10 | Different accounts sharing a provider reference | Two identities, two transactions — asserted explicitly so the behaviour is not mistaken for a bug |
| 11 | Test and live environments with the same reference | Two account identities, two transaction identities, two transactions |
| 12 | Cross-project collision | Refused by `UQ(payment_transaction.identity_id)`; `rejected` verification in the refusing project; conflict raised there; owner's rows untouched; **no owner identifier disclosed** |
| 13 | Rolled-back acceptance | After a failure injected at any step of §6.3, no identity row, no transaction, no acceptance, no correlation persists (I12) |
| 14 | Identity cannot be squatted by an unverifiable delivery | Repeated failing deliveries create no identity row; the real owner's later acceptance succeeds |

### 15.2 B. Observation correlation

| # | Test | Expected |
|---|---|---|
| 1 | One observation → one transaction | Correlation row inserted; readable |
| 2 | A second observation from another channel → same transaction | Second correlation row permitted; `payment_transaction_id` is not unique |
| 3 | Duplicate correlation pair | Second insert fails PK/`UQ(observation_id)` |
| 4 | One observation → two different transactions | Second correlation fails PK `observation_id` |
| 5 | Two verification attempts for one observation, both accepted | First acceptance commits; second fails `UQ(payment_transaction_id)`; a second transaction for that observation is impossible |
| 6 | One verification accepted twice | Second acceptance fails `UQ(verification_id)` |
| 7 | Acceptance naming an observation correlated to a **different** transaction | Fails FK `(observation_id, payment_transaction_id)` → correlation |
| 8 | Cross-project correlation | Fails shared-project composite keys |
| 9 | Acceptance supported by an unbound verification | Fails the version composite key (NULL parent value cannot match) |

### 15.3 C. Verification supersession

| # | Test | Expected |
|---|---|---|
| 1 | `V1 → V2` | Accepted; chain head is V2 |
| 2 | `V1 → V2 → V3` | Accepted; head is V3; each row immutable |
| 3 | Supersession across two observations in one project | Insert fails both verification composite keys (they share one `observation_id`) |
| 4 | Supersession across projects | Insert fails the same keys |
| 5 | `V1 → V2` then `V1 → V3` | Second fails `UQ(superseded_verification_id)` |
| 6 | `V1 → V3` then `V2 → V3` | Second fails `UQ(superseding_verification_id)` |
| 7 | Self-supersession | Fails `CK(superseding_verification_id <> superseded_verification_id)` and the sequence check |
| 8 | Two-node cycle `V1 → V2` then `V2 → V1` | Fails `CK(superseding_attempt_seq > superseded_attempt_seq)` |
| 9 | Longer cycle `V1→V2→V3` then `V3→V1` | Fails the same check (strict increase cannot return to V1's sequence) |
| 10 | Carried sequence that does not match its parent | Fails the four-column composite FK |
| 11 | Valid chain remains append-only | No update/delete path; supersession rows accumulate |
| 12 | Later `failed` verification for the same observation | Recorded as a new attempt; earlier acceptance unchanged; no derived precedence change |
| 13 | Attempt to change precedence other than through `verification_supersession` | No such path exists; a `failed` row alone is not precedence |
| 14 | Concurrent supersessions of one verification | Exactly one commits; the other fails the unique constraint |

### 15.4 D. Registration lifecycle

| # | Test | Expected |
|---|---|---|
| 1 | First registration in a scope | Inserts with `revision_seq = 1`, no predecessor |
| 2 | First projection row | Inserts for that scope; `current_since` set |
| 3 | Second projection row for the same scope | Fails the projection primary key |
| 4 | Valid same-scope replacement | Successor `revision_seq = 2`; CAS updates one row; `changes() = 1` |
| 5 | Two successive replacements | `R1 → R2 → R3`; projection points at R3 |
| 6 | Two concurrent replacement attempts | Exactly one CAS matches; the loser rolls back its successor row and reports `registration_superseded_concurrently` |
| 7 | Stale compare-and-swap | Zero rows changed → whole transaction rolled back, including the inserted successor |
| 8 | Cross-project predecessor | Fails the self-referential composite FK |
| 9 | Cross-account predecessor | Fails the same key |
| 10 | Cross-channel (`source_kind`) predecessor | Fails the same key |
| 11 | Cross-namespace predecessor | Fails the same key |
| 12 | Duplicate successor | Two registrations naming the same predecessor fail `UQ(supersedes_registration_id)` |
| 13 | Registration cycle / backdating | `CK(revision_seq > supersedes_revision_seq)` rejects it; root/non-root checks reject a self-referential root |
| 14 | Projection pointing at a registration outside its scope | Fails the five-column composite FK |
| 15 | Projection rebuild | Chain-head query reproduces the projection's `source_registration_id` for every scope |
| 16 | Root representation | A registration with a predecessor but `supersedes_revision_seq IS NULL` (or the reverse) fails the equivalence check |

### 15.5 E. Transaction and baseline integrity

| # | Test | Expected |
|---|---|---|
| 1 | Transaction project ≠ source observation project | Insert fails |
| 2 | Transaction configuration version ≠ observation's version | Insert fails `(source_observation_id, payment_config_version_id)` |
| 3 | Transaction configuration version from another project | Insert fails `(payment_config_version_id, project_id)` |
| 4 | Transaction account ≠ observation account | Insert fails |
| 5 | Accepted currency ≠ configuration version currency | Insert fails |
| 6 | Transaction classification ≠ observation classification | Insert fails |
| 7 | Failed verification | No accepted transaction is created |
| 8 | Unresolved observation | No transaction; no identity; evidence retained |
| 9 | Successful acceptance | Identity, transaction, correlation, acceptance, and audit commit together |
| 10 | Failure injected at each step of §6.3 | No partially committed identity, transaction, or acceptance |
| 11 | Duplicate same-project observation after acceptance | Correlation added; no second transaction; no second acceptance; funds unchanged |
| 12 | Cross-project collision | No second accepted transaction; no identity row committed by the refusing project |
| 13 | Later configuration version | Existing transaction's version, amount, and currency unchanged byte-for-byte |
| 14 | Second transaction for the same observation | Fails `UQ(source_observation_id)` |

### 15.6 F. Conflict key and membership

| # | Test | Expected |
|---|---|---|
| 1 | Same participants and trigger detected twice | Byte-identical `conflict_key`; second insert fails `UQ(project_id, conflict_key)`; write path returns the existing id |
| 2 | Key recomputed from persisted rows alone | Recompute from `reconciliation_conflict` plus membership rows reproduces the stored key exactly |
| 3 | Participant order varied before insertion | Membership is a set; the digest sorts by byte order, so the same participants yield the same key regardless of insertion order |
| 4 | Genuinely new episode | Different trigger or membership → different key → new conflict row, legally |
| 5 | Cross-project membership | Fails the shared-project composite keys |
| 6 | Duplicate membership | Fails PK `(conflict_id, observation_id)` |
| 7 | Digest input that is not a persisted field | Not constructible: the algorithm's inputs are exactly the columns and membership rows listed in §8.4 |
| 8 | Absent trigger vs absent transaction | Encoded as the distinct `absent` token; the two conflicts do not collide |
| 9 | Double resolution | Fails `UQ(conflict_id)` |

### 15.7 G. Global schema integrity

| # | Test | Expected |
|---|---|---|
| 1 | No undefined column | Schema introspection: every column named in §5.3 exists; every check references only columns of its own table |
| 2 | No dangling foreign key | Every FK parent table and column exists |
| 3 | No missing parent unique key | Every composite FK's parent columns are covered by a declared `UNIQUE` constraint, in the same order |
| 4 | No invalid composite foreign key | `PRAGMA foreign_key_check` is empty after a full fixture load |
| 5 | No inconsistent project relationship | Every project-bearing row equals its parent's project (composite keys) |
| 6 | No inconsistent provider-account relationship | Every transaction's binding and observation belong to the transaction's global account |
| 7 | No inconsistent configuration-version relationship | Version belongs to the same project and to the observation |
| 8 | No invalid lifecycle insertion order | One row per table inserted in the §5.2 order commits without any deferred constraint |
| 9 | No unexplained mutable row | Only `payment_source_registration_current` is mutable; nothing else has an update/delete path |
| 10 | No permanent identity reservation from a rolled-back operation | Covered by 15.1 #13–#14 |
| 11 | No one-observation/multiple-transaction path | Primary key on `payment_transaction_observation.observation_id`; attempted second transaction fails |
| 12 | Every invariant has a positive and a negative test | This matrix; each refusal cites the specific constraint |
| 13 | No uniqueness rule depends on derived state | No index references a `status` or `is_active` column |
| 14 | Every table has a primary key | Introspection: zero tables without one |
| 15 | Every reference-equality key has a declared parent | Introspection: each three-column `REFERENCES` resolves to a declared unique key on exactly those columns, in order |
| 16 | No amount can be accepted without an evidence parent | Introspection: the accepted-amount key exists and both tables carry the canonicality checks |
| 17 | Every descriptive timestamp column carries the same predicate | Introspection: one `GLOB` check per timestamp column; zero `LIKE` shape checks remain |
| 18 | Every sealed conflict's count matches its membership | Integrity query over `reconciliation_conflict_seal` vs `reconciliation_conflict_observation` returns no rows |

### 15.8 Decimal, currency, and classification (retained from Revision 3)

| # | Test | Expected |
|---|---|---|
| 1 | Grammar | `1500`, `1500.00`, `1500.000` normalize identically; `+1500`, `-1500`, `1e3`, `1,500`, ` 1500` rejected; 19 integer digits and scale 7 rejected |
| 2 | Zero rejected | `0` and `0.00` rejected for observations and transactions |
| 3 | Exact comparison | `1500` = `1500.00`; `1500` ≠ `1500.01`; `"900"` not ranked above `"1500"`; no float parsing at any layer |
| 4 | Currency normalization | Case normalization only; matching is exact against the bound version; no conversion, no exchange rate |
| 5 | Classification propagation | Transaction equals its observation; acceptance equals both parents; a mismatch fails a composite key |
| 6 | Verifier field combinations | `test_fake` + `verified_by` set rejected; `test_fake` + `system_clock` rejected; `test_fake` + `live` rejected; `automated` + `verified_by` set rejected; `automated` without `verifier_reference` rejected |

### 15.9 Slice 2B acceptance criteria

| # | Test | Expected |
|---|---|---|
| 1 | Mandatory request idempotency | Allocation without an idempotency key is refused by schema |
| 2 | Same request replay | Returns the recorded outcome; no second allocation |
| 3 | Same key, different payload | Idempotency conflict; nothing written |
| 4 | Two legitimate identical-value requests | Different keys → two allocations permitted, subject to I1/I2 |
| 5 | Transaction ceiling (I2) | Allocation exceeding accepted amount refused; nothing written |
| 6 | Obligation ceiling (I1) | Allocation exceeding expected amount refused; nothing written |
| 7 | Concurrent allocation requests | Serialized write plus inside-transaction recheck admits exactly one |
| 8 | Atomic allocation + audit | Both or neither |
| 9 | Correction without mutation | Compensating record appended; original intact; double compensation refused |
| 10 | Cross-project allocation | Transaction, obligation, and allocation project mismatch refused |
| 11 | Currency mismatch | Transaction/obligation/allocation currency disagreement refused |
| 12 | Overpayment and unapplied funds | Excess remains unapplied; never auto-allocated or auto-refunded |
| 13 | Blocked transaction cannot fund | A transaction with an open conflict (§6.4) cannot be allocated from |
| 14 | Baseline is inherited, not chosen | Allocation writes no configuration version of its own |

Slice 2B tests are not Slice 2A acceptance criteria.

### 15.10 H. Provider-reference integrity (Revision 5, Finding 1)

| # | Test | Expected |
|---|---|---|
| 1 | Establishing observation and identity carry the same global account and the same reference | Transaction insert succeeds; the three-column key matches on both parents |
| 2 | Establishing observation's reference differs from the identity's | Insert fails FK `(source_observation_id, provider_account_identity_id, provider_transaction_reference)` → observation |
| 3 | Establishing observation belongs to another global account | Insert fails FK `(source_observation_id, provider_account_identity_id)` and the three-column key |
| 4 | A second observation, same account and same reference, correlated to the accepted transaction | Correlation insert succeeds; `payment_transaction_id` is not unique |
| 5 | A second observation, same account but a **different** reference, correlated | Correlation insert fails the transaction-side three-column key |
| 6 | Correlation naming a transaction from another global account | Fails `(payment_transaction_id, provider_account_identity_id, provider_transaction_reference)` |
| 7 | `NULL` reference with `correlation_basis = 'provider_shared_reference'` | Fails `NOT NULL` on the correlation column; no `MATCH SIMPLE` bypass exists (the child column is not nullable) |
| 8 | Empty-string reference | Fails `CK(provider_transaction_reference <> '')` on observation, identity, and correlation |
| 9 | Reference-less observation attempts acceptance | No correlation row can exist, so the acceptance's `(observation_id, payment_transaction_id)` key has no parent; the write path also refuses earlier with `provider_reference_absent` |
| 10 | Same reference under two legitimately different global accounts | Two identities, two transactions — asserted explicitly so it is not mistaken for a bug |
| 11 | Same account and reference observed through webhook and reconciliation | One identity, one transaction, two correlated observations, funds counted once |
| 12 | Same identity attempted through two project bindings | First commits; second fails `UQ(payment_transaction.identity_id)` and produces the collision outcome (§4.5 case 14) |
| 13 | Transaction whose reference matches the identity but no observation | Impossible: `source_observation_id` is `NOT NULL` and its three-column key has no parent |
| 14 | `verified_mapping` correlation attempted in 2A | Fails `CK(correlation_basis = 'provider_shared_reference')` — the value is outside the domain, not merely discouraged |

### 15.11 I. Amount integrity (Revision 5, Finding 2)

| # | Test | Expected |
|---|---|---|
| 1 | Accepted amount and scale equal the establishing observation's | Insert succeeds |
| 2 | Accepted amount differs in value | Fails FK `(source_observation_id, accepted_amount_normalized, accepted_amount_scale)` |
| 3 | Source text `"1500.00"` normalized to `1500`/scale 0, accepted as `1500`/scale 0 | Succeeds; the original text stays verbatim in `amount_text` and is not compared |
| 4 | Accepted scale that does not equal the stored fraction length | Fails the canonicality `CHECK` on the transaction (and on the observation, if it is the evidence that is malformed) |
| 5 | Zero amount | Rejected by the grammar at ingestion (§10.1) and by `CK(amount_normalized <> '0')` / `CK(accepted_amount_normalized <> '0')` |
| 6 | Amount beyond 18 integer digits or scale 6 | Rejected at validation; the row would also fail the scale check |
| 7 | Second observation with a different amount for an accepted identity | Conflict `duplicate_content_mismatch`; accepted amount unchanged; no second transaction |
| 8 | Verification failure after acceptance | No write path can alter the accepted amount; the verification row has no amount column |
| 9 | Later observation rewriting history | No `UPDATE` exists on `payment_transaction`; a new row would fail `UQ(identity_id)` |
| 10 | Fee, deduction, or conversion asserted between evidence and acceptance | Not representable: the key requires equality, and no transformation mechanism exists in 2A |
| 11 | Non-canonical stored form (`1500.00`, scale 2) | Rejected by the trailing-zero and scale/fraction checks, so the equality key cannot be satisfied by two spellings of one value |

### 15.12 J. Conflict sealing (Revision 5, Finding 3)

| # | Test | Expected |
|---|---|---|
| 1 | Single-participant conflict | Seals with `sealed_member_count = 1` |
| 2 | Multi-participant conflict | Seals with the exact count; recomputation reproduces `conflict_key` |
| 3 | Seal declaring fewer members than present | Count trigger aborts `conflict_seal_member_count_mismatch` |
| 4 | Seal declaring more members than present | Same trigger aborts |
| 5 | Header written, seal omitted, transaction committed by a non-2A path | The conflict is not `open` (derived predicate requires a seal); it blocks nothing and is reported as an integrity anomaly |
| 6 | Membership inserted after the seal | Insert trigger aborts `conflict_membership_sealed` |
| 7 | Duplicate membership | Fails the composite primary key (before any sealing question arises) |
| 8 | Failure injected after the seal | Whole group rolls back: no header, no membership, no seal, no audit row (I6) |
| 9 | Digest recomputed from the sealed rows | Byte-identical to the stored `conflict_key` |
| 10 | Participants inserted in a different order | Same digest: membership is a set, sorted by byte order |
| 11 | New episode after resolution, different membership | New digest → distinct conflict and its own seal; the earlier conflict keeps its set |
| 12 | Update or delete of a sealed membership row | Trigger aborts `conflict_membership_immutable` |
| 13 | Two writers creating the same conflict concurrently | Exactly one commits; the other fails `UQ(project_id, conflict_key)` and returns the existing conflict and seal |
| 14 | Audit on rollback | No audit row claims a conflict that did not commit; the failure is reported out of band (§11.3) |
| 15 | Seal naming a different digest than its header | Fails the `(conflict_id, project_id, conflict_key)` parent key |
| 16 | Second seal for one conflict | Fails `UQ(conflict_id)` on the seal |

### 15.13 K. Timestamp validation (Revision 5, Finding 4)

| # | Test | Expected |
|---|---|---|
| 1 | `2026-11-04T12:00:00.000Z` | Passes shape and all range checks |
| 2 | Alphabetic year position (`2026` → `20x6`) | Fails `GLOB` |
| 3 | Alphabetic month position | Fails `GLOB` |
| 4 | Alphabetic day position | Fails `GLOB` |
| 5 | Alphabetic hour or minute position | Fails `GLOB` |
| 6 | Alphabetic millisecond position | Fails `GLOB` |
| 7 | Wrong separator (`2026/11/04T…` or `T12-00`) | Fails `GLOB` |
| 8 | Wrong suffix (`.000+01:00`, `.000z`, no `Z`) | Fails `GLOB` |
| 9 | Variable fractional precision (`.00Z`, `.0000Z`) | Fails `GLOB` |
| 10 | Missing fractional part | Fails `GLOB` |
| 11 | Wrong length (23 or 25 characters) | Fails `GLOB`, which fixes all 24 positions |
| 12 | `2026-02-31T00:00:00.000Z` | Passes the shape checks: month-length validity is application-level (§8.5), documented rather than claimed |
| 13 | `2026-13-01T…` | Fails the month range check |
| 14 | Sequence ordering with adversarial timestamps | Unaffected: precedence reads `attempt_seq` / `revision_seq` only |

### 15.14 L. Orphan identity handling (Revision 5, limitation)

| # | Test | Expected |
|---|---|---|
| 1 | Successful acceptance | Identity and transaction committed in one transaction; identity has exactly one transaction |
| 2 | Failure injected after identity creation, before transaction | No identity row persists (I12) |
| 3 | Failure injected after transaction creation, before acceptance | No identity and no transaction persist |
| 4 | Pre-existing orphan identity encountered by an acceptance attempt | Refused with `identity_integrity_anomaly`; no transaction written |
| 5 | Orphan present, requesting project asserts ownership | No assignment occurs; the refusal is identical to any other caller's |
| 6 | Orphan present, application treats "no transaction" as free | Not possible through the documented path; the classification step refuses before any insert |
| 7 | Attempt to create a second identity with the orphan's natural key | Fails `UQ(provider_account_identity_id, provider_transaction_reference)` |
| 8 | Orphan encountered by a different project | Same refusal; no owner identifier, account reference, or provider key disclosed |
| 9 | Same-project duplicate observation for an already accepted identity | Duplicate-observation path: correlation only; not classified as an orphan |
| 10 | Cross-project attempt against an identity with an accepted transaction | Collision path, not orphan path: `cross_project_collision`, conflict, no disclosure |
| 11 | Orphan cleared without authorization | No 2A code path deletes an identity row; recovery is an internal capability act (§6.3.1) |

### 15.15 Threat analysis (Slice 2A)

| Threat | Defense |
|---|---|
| Double-counting across channels, registrations, or projects | Global account identity + global transaction identity + `UNIQUE(identity_id)` (§4.3, §4.4) |
| A transaction assembled from unrelated records | Twelve composite keys on `payment_transaction` (§4.4) |
| Accepting one funds movement on evidence of another | Reference equality on identity, observation, and transaction; three-column keys on the correlation (§4.4, §4.6) |
| Substituting an accepted amount | Amount equality key plus canonicality checks on both tables (§5.3, §10.4) |
| A reference-less delivery reaching acceptance through a NULL key | Correlation's reference is `NOT NULL`; the observation's nullable reference never matches a `NOT NULL` child (§4.6, §4.7) |
| Growing a conflict's participant set after its digest was computed | Seal relation, count trigger, post-seal insert trigger, update/delete triggers (§6.4, §8.4) |
| Adopting an orphan identity to acquire a funds movement | Orphan classified as an integrity anomaly and refused; no auto-assignment, no duplicate, no disclosure (§6.3.1) |
| A non-numeric or malformed timestamp passing validation | `GLOB` digit classes plus field-range checks; precedence never reads a timestamp (§8.5) |
| One delivery funding two transactions | PK `observation_id` on correlation (§4.6) |
| Identity squatting / denial of service | Identity created only inside the atomic acceptance transaction (§6.3) |
| Duplicate delivery | Delivery uniqueness; replay returns the original record |
| Forged or untrusted namespace | Registration-based trust; matching a string is not authentication (§7.1) |
| Cross-project access or collision | Server-side project resolution; project composite keys; collision refusal without disclosure (§7.5) |
| Phantom payment invented to satisfy a foreign key | Observation has no transaction column; acceptance requires a correlation row (§5.2) |
| Evidence fabricated as live payment | Four-table classification with propagation keys; verifier checks (§9.2) |
| Silent revocation of accepted funds | Supersession requires an explicit record, one successor, one predecessor, same observation (§8.5) |
| Superseding unrelated evidence | Shared `observation_id` in both verification composite keys |
| Retroactive re-pricing of historical funds | Immutable `NOT NULL` baseline binding tied to the evidence (I8, §5.4) |
| Audit leakage | Identifier allowlist enforced at write (§8.6) |
| Funding double-count via allocation | Out of 2A; prevented in 2B by I1/I2 inside a serialized transaction (§12.3) |
| Float or lexicographic money errors | Exact decimal contract (§10) |
| Clock skew or format drift changing precedence | Ordering by scoped integer sequences, never by clock text (§8.5) |

### 15.16 Test-count and evidence-quality accuracy

- Revision 1 claimed "328 tests pass" and reused that number as evidence for unchanged behavior. **No fresh evidence supports 328.**
- The recorded result for PR #54 at head `51a796a` is: **321 passed** (implementation-agent-reported), plus typecheck and build passing, plus fresh GitHub checks (Website CI, Dependency Review, CodeQL, Snyk) reported as successful on that head.
- Those are **historical, agent-reported** results for a rolled-back slice. They are not current, not independently reproduced here, and not evidence about code that is not in `main`.
- No test was executed during Revision 5. Reported results, independently verified results, and proposed acceptance criteria are labelled separately and never merged. The matrix above is a specification: it states what a future implementation must demonstrate, and nothing in this document claims any of it has been demonstrated.

---

## 16. Exclusions, Readiness Verdict, and Correction Record

### 16.1 Explicit exclusions

Excluded from Slice 2A: allocations; allocation requests; obligation linkage on evidence; obligation states beyond `proposed`; payment attempts, retries, dunning, notifications; manual determination; customer upload or any customer write; activation predicate or event; provider integration, webhook receiver, credentials; production or live customer data; mutable `status` columns; mutable `blocks_use` columns; ID arrays in any record; conflict-to-transaction membership relations; caller-controlled trust; snapshot-isolation claims; audit events for failed writes; fabricated test-pass claims; **amount transformations of any kind** (fees, deductions, settlement adjustments, refunds, reversals, currency conversion); **`verified_mapping` correlation**; **orphan-identity reassignment, expiry, or cleanup** (§6.3.1 leaves that to an authorized internal procedure).

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
| C — Source identity | Delivery-scoped identity introduced (superseded twice: by Revision 2 §4, then by Revision 3 §4.3, then by Revision 4 §4.2). |
| D — J.14 rewrite | Rewritten as options (superseded by Revision 2 §13, which made the options independent). |
| E — Allocation model | Normalized allocation records; no arrays of allocation IDs. |
| F — Attempts, states, SQLite | Attempts excluded; no `failed` obligation state; snapshot isolation not claimed. |

**Revision 2 corrections (retained):**

| Finding | Original problem | Correction | Section |
|---|---|---|---|
| **A** | One provider transaction could be accepted twice through different channels. | Three identities — delivery, canonical transaction, allocation — with uniqueness, correlation basis, and blocking of unresolved correlations. | §4 |
| **B** | No defined evidence → transaction → configuration → obligation relationship. | Full record model with identities, FKs, ownership, baseline, immutability, idempotency, authority. | §5 |
| **C** | `reconciliation_conflict` used as an outcome while absent from the enum. | Outcome enum fixed; conflicts became a separate record; supersession made explicit. | §6 |
| **D** | `fake_verifier` returned passed with a Founder identity. | Test-only verifier, fail-closed production path, `verified_by = NULL`. | §9 |
| **E** | J.14 non-canonical status unclear; options not independent; J.10 tied to Option D. | J.14 labelled proposed; eleven dimensions; four options; comparison matrix; J.10 separated. | §13 |
| **F** | Allocation relied on a check-then-write precheck. | Serialized write, inside-transaction rechecks, atomic writes, defined busy/rollback/replay behavior. | §12 |
| **Finding 9** | Strings preserved but arithmetic undefined. | Grammar, precision limits, normalization, exact comparison and arithmetic, overflow, no floats. | §10 |
| **Finding 10** | Claimed an audit row after failed lock retries. | Failure classes separated; audit guaranteed only for successful writes. | §11 |
| **Finding 11** | Trust boundary under-specified. | Eight explicit rules. | §7 |
| **Finding 12** | Governance reconciliation handled loosely. | Verified facts table; five-way distinction; explicit unresolved inconsistency. | §3 |
| **Finding 13** | J.7 missing. | Full J.1–J.13 register plus proposed J.14. | §14 |
| **Finding 14** | Schema/test mismatch; unsupported count claim. | Test matrix rebuilt; count claim corrected. | §15 |
| **Finding 15** | Misnumbered sections, duplicated content. | Numbering normalized; duplicate removed; 16 sections. | Whole document |

**Revision 3 corrections (retained):**

| Finding | Original problem | Correction | Mechanism | Section |
|---|---|---|---|---|
| **A** | Canonical key `(source_registration_id, provider_transaction_reference)` was channel- and project-scoped. | Identity moved into a global `provider_transaction_identity` registry; registration id removed from key and row. | `UNIQUE(provider_key, provider_environment, provider_account_reference, provider_transaction_reference)`; `UNIQUE(payment_transaction.identity_id)` | §4, §5.3 |
| **B** | Unresolved observations required a transaction; conflicts used an `observation_ids` array; `correlation_basis = 'unresolved'` needed a transaction to say there was none. | Observation has no transaction column; correlation is a relation; membership is a relation. | Absence of FK; PK `(observation_id, payment_transaction_id)`; PK `(conflict_id, observation_id)` | §4.7, §6.4, §5.3 |
| **C** | `verification_result.payment_transaction_id` ↔ `payment_transaction.accepted_verification_id` formed a cycle under immediate enforcement. | Separate acceptance record; verification references only its observation. | `UQ(payment_transaction_id)`, `UQ(verification_id)`, composite FK to correlation | §5.2, §6.2, §5.3 |
| **D** | The transaction's baseline was "none" in the record model while other sections assumed a version. | Observation captures the version or is explicitly unbound; transaction copies it `NOT NULL`; currency tied to it. | Composite FKs to observation and configuration version; `CK` on binding state | §5.4, §4.7 |
| **E** | Verifier and classification fields were referenced by constraints but defined in no table. | Complete column catalogue; fields defined once with owner, domain, nullability, checks, lifetime; classification on four tables. | Nine checks on `verification_result`; classification propagation keys | §5.3, §9.2 |
| **F** | "One active registration", "one open conflict", "terminal supersession" were asserted, not enforced. | Projection with a primary key + CAS; deterministic conflict key; unique successor + carried ordering. | PK on scope; `UQ(project_id, conflict_key)`; `UQ(superseded_verification_id)` + ordering check | §8.3–§8.5 |
| **Decimal grammar** | Grammar permitted an undefined `signed` production. | `signed` deleted; direction via `effect_sign`. | Grammar in §10.1 | §10 |
| **Audit allowlist** | Allowlist named `evidence_id`, which exists nowhere. | Allowlist aligned with the model; `evidence_id` removed. | Allowlist rejection at write | §8.6 |

**Revision 4 corrections (retained):**

| Finding | Original problem | Correction | Mechanism | Section |
|---|---|---|---|---|
| **1** | The global transaction identity was not tied to a trusted provider account or to the observation that established it; a transaction could cite an identity, a binding, and an observation describing three different things. | Account identity split into a global `provider_account_identity` (unique on provider, environment, account reference) and a project-scoped `payment_provider_account` binding referring to it; the transaction stores `provider_account_identity_id` and proves identity, binding, observation, project, baseline, and classification agreement with composite keys. | `UQ(provider_key, provider_environment, provider_account_reference)`; `UQ(provider_account_identity_id, provider_transaction_reference)`; composite FKs binding identity, binding, observation, project, baseline, and classification on the transaction; one on the observation | §4.2–§4.5, §5.3 |
| **2** | One observation could correlate to several canonical transactions, so one delivery could underlie two accepted funds movements. | Correlation's primary key is `observation_id`; many observations per transaction remain permitted; acceptance inherits the rule through `(observation_id, payment_transaction_id)` → correlation plus `UQ(payment_transaction_id)`. | PK `observation_id`; `UQ(observation_id, payment_transaction_id)` as the acceptance parent | §4.6, §5.3, §15.2 |
| **3** | Verification supersession was project-scoped, not observation-scoped, and one successor could converge from two predecessors. | The relation carries `observation_id`; both verifications are proven to belong to it and to the project by four-column composite keys; uniqueness is declared on **both** ends. | Composite FK to `(verification_id, observation_id, project_id, attempt_seq)`; `UQ(superseded_verification_id)`; `UQ(superseding_verification_id)` | §5.3, §6.5, §8.5 |
| **4** | The registration projection and its predecessor link did not prove scope, and `replaced_at` contradicted the row's meaning. | Projection's `source_registration_id` uses a five-column composite key into its own scope; the predecessor uses a six-column self-referential key; `replaced_at` replaced by `current_since` with a stated update rule; insertion, CAS, zero-row rollback, and rebuild are all specified. | Composite FKs; PK on scope; `changes() = 1` requirement inside `BEGIN IMMEDIATE`; `revision_seq` ordering | §5.3, §8.3, §15.4 |
| **5** | The transaction's project, account, observation, and baseline were not proven to be the same, and an unaccepted transaction could reserve a global identity. | Nine composite keys (twelve after Revision 5) make the transaction internally coherent at insert; acceptance is one atomic write transaction; identity rows are created only inside it and roll back on any failure. | Composite FKs; single `BEGIN IMMEDIATE` spanning identity → transaction → correlation → acceptance → audit | §4.4, §5.3, §6.3 |
| **6** | The conflict digest hashed `trigger_record_id` and a collection of transaction ids that no relation stored. | Digest restricted to persisted, reconstructable inputs: project, kind, one optional trigger observation, one optional transaction, and sorted membership rows; length-prefixed encoding removes delimiter ambiguity. | `UQ(project_id, conflict_key)`; recomputation algorithm in §8.4 | §8.4, §15.6 |
| **7** | Ordering was enforced by comparing ISO-8601 text, which SQLite compares lexicographically. | Ordering moved to integer sequences scoped to the parent and allocated inside `BEGIN IMMEDIATE`, carried into the child and proven by composite keys; timestamps demoted to descriptive text with a shape check only. | `attempt_seq`; `revision_seq`; strict-increase checks on integer columns | §8.5, §8.3, §15.3 |

**Revision 5 corrections (new in this revision):**

| Finding | Original problem | Correction | Mechanism | Section |
|---|---|---|---|---|
| **1** | The transaction proved that its identity, binding, and observation shared an account and a project, but not that they described the same funds movement: the provider reference on the observation was never compared with the one inside the identity, and `provider_shared_reference` was a label rather than a constraint. | The observation records its global account identity and its reference; the transaction stores the reference and proves it equal to the identity's and to the evidence's; the correlation repeats the identity tuple and references both parents' three-column keys. | `UQ(identity_id, provider_account_identity_id, provider_transaction_reference)`; three-column parent keys on observation and transaction; `NOT NULL` reference on transaction and correlation | §4.4, §4.6, §5.3 |
| **2** | The accepted amount had no structural relationship to the establishing observation's amount, so evidence for one value could support accepted funds of another. | Accepted amount and scale must equal the evidence's, by key; both tables constrain the stored form to a single canonical representation. | FK `(source_observation_id, accepted_amount_normalized, accepted_amount_scale)` → `(observation_id, amount_normalized, amount_scale)`; scale/fraction and trailing-zero `CHECK`s | §5.3, §10.3, §10.4 |
| **3** | The conflict digest hashed a participant set that could still grow, so the stored key could stop matching the rows it was computed from. | Membership is sealed when the conflict becomes authoritative; the seal carries the count and the digest, and triggers reject post-seal insertion or mutation. | `reconciliation_conflict_seal` + count trigger + post-seal insert trigger + update/delete triggers; derived `sealed(c)` predicate | §5.3, §6.4, §8.4 |
| **4** | The timestamp check used `LIKE '____-…'`, where `_` matches any character, so it validated separators and width but not digits. | `GLOB` with `[0-9]` classes fixes every position; fixed-width field ranges are checked; month-length and leap-year validity are stated as application-validated. | `GLOB '[0-9]…'` shape check + `substr` range checks | §8.5 |
| **5 (limitation)** | A `provider_transaction_identity` row can exist without a transaction, and the asymmetry was undocumented — the shape an untrusted claimant could exploit. | Orphan identities are classified as integrity anomalies and refused: no assignment, no duplicate, no disclosure, no cleanup outside an authorized internal procedure. | Fail-closed classification step in the atomic path; application-level limitation recorded | §6.3.1, §7.5, §8.2 |

### 16.4 Open dependencies this revision does not resolve

**Technical questions, documented rather than decided:**

1. **Acceptance of funds received against a stale commercial baseline.** Slice 2A fails closed (`config_baseline_stale`) because the canonical decision governs the activation gate, not retrospective evidence handling. Whether such funds may later be accepted, and against which baseline, is undecided (§5.4).
2. **Cross-version allocation.** Whether funds bound to one configuration version may fund an obligation issued under another is left to J.14; the technical model requires currency identity only (§12.1).
3. **Configured naming of the C-slice columns.** `payment_configuration_version(project_id, currency, proposal_version_id, agreement_version_id)` is stated against a table that is not in `main`; the names must be confirmed against the restored schema at implementation (§3.3).
4. **Ownership arbitration for a contested identity.** The database guarantees that only one transaction can exist per identity; which project wins is decided by which acceptance write commits first. Any rule beyond first-writer-wins — for example a Founder-directed assignment — does not exist and is not assumed (§8.2).
5. **Conflict kinds needing several transactions.** The current digest names at most one transaction, matching the persisted column. A future kind that must name two would require a `reconciliation_conflict_transaction` relation and a digest version bump; no such relation is designed here (§8.4).
6. **Association of an orphan identity.** If an identity row exists with no transaction, nothing in this design may attach it to a project. Whether such a row may ever be associated, on what evidence, and by whom is a Founder/ops decision requiring an authorized integrity-recovery procedure; §6.3.1 defines the preconditions and refuses to invent the policy.
7. **A conflict that genuinely gains a participant.** Sealing means a later participant is a new episode, not an addition. Whether a conflict kind should instead support an append-only membership log with a per-revision digest is open; it would require a `conflict/v2` domain separator and is not implied by this design (§8.4).
8. **The amount boundary beyond 2A.** Slice 2A accepts exactly what it observed. How a fee, settlement difference, or refund is represented — and against which accepted amount — is J.5/J.6 territory and is not designed here (§10.4).

**Application-level limitations, stated so they are not mistaken for constraints:**

1. *First-writer ownership* of a contested identity (§8.2).
2. *Verification content* — plausibility of an amount — is application logic (§8.2).
3. *A transaction row without an acceptance row* is permitted by the schema; no 2A write path creates one (§6.3).
4. *The conflict digest* is computed in application code because SQLite has no SHA-256; the database enforces uniqueness and immutability, and a recomputation test is specified (§8.4).
5. *Timestamp calendar validity* — the checks enforce digit positions and field ranges, not month lengths or leap years (§8.5).
6. *An identity row without a transaction* (an orphan) — permitted by the schema, never produced by a 2A write path, refused when encountered (§6.3.1).
7. *A conflict header without a seal* — permitted by the schema, inert by the derived definition, never produced by a 2A write path (§6.4).
8. *Canonicality of the stored amount form* is checked, but correct parsing of the provider's original text is application logic (§10.3).
9. *The triggers in §5.3 are proposed schema objects*, written in valid SQLite syntax; they have not been created or executed, and no test in this document has been run against them.

**Founder decisions (unchanged and unresolved):**

- J.3 (authoritative evidence and verification) blocks Slice 2A entirely; it also governs `verified_mapping` correlation, supersession authority, and the resolution rules that may close conflicts.
- J.10 governs any manual determination; `verifier_kind = 'human'` and human-authored resolutions are outside Slice 2A by construction.
- J.4, J.5, J.6, J.7, J.8, J.9, J.11, J.12 remain unresolved and are not decided here. J.8 in particular means no provider is selected by this design — `provider_key` is an opaque string and `'fake_provider'` is the only value Slice 2A produces.
- J.14 remains proposed and non-canonical; Slice 2B is blocked on it.

**Governance dependencies (unchanged):**

- The canonical-decision/Project-Map approval contradiction (§3.3) remains open and requires a separate Founder-authorized correction.
- Restoration of the rolled-back initial slice remains a separate act requiring separate authorization; nothing here implies it.

---

## Final Statement

This document is a **documentation-only revision**, containing 16 numbered sections. It changes exactly one file: `review-artifacts/payment-slice-2-revised-proposal.md`, published to `review/payment-slice-2-proposal-clean` and reflected in the existing Draft pull request #68 against `main`.

It does not modify application code, tests, schemas, migrations, dependencies, workflows, or governance documents. It does not restore rolled-back implementation, select a provider, add credentials, process payments, activate a project, or deploy anything. It does not merge, close, or promote PR #68.

No Founder decision is resolved by this document. J.14 remains proposed and non-canonical. The canonical-decision/Project-Map approval contradiction remains open and requires separate Founder-authorized correction. Slice 2A and Slice 2B remain unauthorized for implementation.

A stronger relational model is not implementation authorization. Revision 5 closes four evidence-integrity and validation defects and documents a fifth asymmetry instead of leaving it implicit; it changes no governance status and authorizes nothing. It is offered for independent architectural review of the corrected model, and for nothing further.
