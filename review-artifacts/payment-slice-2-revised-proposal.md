# Payment Slice 2 — Revised Proposal, Revision 2 (Documentation-Only)

## Revision Scope and Authority Statement

This document is the second corrective revision of the Payment Slice 2 proposal. Its **content** is documentation only: it modifies no application source, no tests, no migrations or schemas, no dependencies, no workflows, and no governance documents (`docs/decisions/2026-10-12-payments-project-activation.md`, `docs/project-map.md`, `CONSTITUTION.md`).

Its **publication** is a separate fact that must be stated rather than elided: this revision is published by committing this one Markdown file to branch `review/payment-slice-2-proposal-clean` and updating the existing Draft pull request #68. That publication created a branch, a commit, and a pull request. It created no implementation, no schema, no provider integration, and no deployment. Publishing documentation is not implementation authorization.

Revision 2 corrects the material architectural, data-integrity, concurrency, security, and governance defects found in independent review of Revision 1. It also repairs Revision 1's internal inconsistencies: misnumbered subsections, duplicated audit sections, an acceptance test that referenced an enum value absent from its schema, an optional idempotency mechanism that could not guarantee idempotency, a test-count claim with no supporting evidence, and historical statements that were true when drafted but false once the document was published.

Every recommendation below is a **proposed technical recommendation** or an **unresolved Founder decision**. Nothing here is a Founder-approved decision, and nothing here authorizes Slice 2A or Slice 2B implementation.

### Universal invariants

These hold everywhere in this document. Later sections reference them by number instead of restating them.

| # | Invariant |
|---|---|
| **I1** | No allocation may cause the sum of allocations applied to an obligation to exceed that obligation's expected amount. |
| **I2** | No allocation may cause the sum of allocations drawn from a transaction to exceed that transaction's accepted amount. |
| **I3** | Monetary values are exact decimal values with explicit scale. No floating-point parsing, no lexicographic comparison, no implicit rounding or conversion. |
| **I4** | Observations, verification results, accepted transactions, conflicts, allocations, and audit rows are append-only. Corrections are new records; nothing is edited or deleted. |
| **I5** | Project ownership is derived server-side from a trusted registration or an authorized project resolution. A caller-supplied identifier is never proof of access and never a source of project ownership. |
| **I6** | Audit rows are identifier-only and are committed in the same database transaction as the material write they describe. |

---

## 1. Executive Summary and Revision Scope

Payment Slice 2 is the design for what a project owes and what has been paid, built on the already-approved provider-neutral design in `docs/decisions/2026-10-12-payments-project-activation.md`. That design is Founder-approved; its implementation is not, except for one limited initial slice (see §3).

This revision keeps the two-slice split and corrects the defects that made Revision 1 unsafe to review:

- **Slice 2A — Verified Payment Evidence and Canonical Transaction Foundation.** Trusted source registration, source observations, verification results, canonical accepted transactions, correlation, conflicts, supersession, exact decimal handling, project isolation, identifier-only audit. Synthetic/test data only. No allocation, no obligation satisfaction.
- **Slice 2B — Allocation and Derived Financial Position.** Allocation requests, allocations, transaction-level and obligation-level ceilings, derived balances, compensating corrections, and a serialized allocation write contract.

The substantive corrections in Revision 2:

1. **Evidence identity is split into three distinct identities** (§4): source delivery, canonical transaction, and internal allocation. Revision 1 used a single delivery-scoped tuple as a global payment identity, which permitted one provider transaction observed through two channels to be accepted twice.
2. **The relational model is stated explicitly** (§5), with primary identity, foreign keys, project ownership, baseline linkage, immutability, idempotency, and authority for every record — and with the Slice 2A/2B boundary drawn so that Slice 2A never claims an obligation is paid.
3. **Verification outcomes, reconciliation conflicts, accepted transactions, and derived financial position are separated** (§6), with explicit precedence and supersession rules instead of "latest record wins".
4. **The fake verifier is confined to test infrastructure** (§9) and can never impersonate Founder approval or a live payment.
5. **J.14 is labelled as a proposed decision that is not in the canonical register** (§13), reworked across eleven independent policy dimensions with a comparison matrix, and separated from J.10.
6. **Allocation safety is specified as a transactional contract** (§12), not an application-level check, and allocation-request idempotency is mandatory with a stable request identity.
7. **Decimal and currency handling is specified as an exact arithmetic contract** (§10).
8. **SQLite failure reporting no longer claims an audit row can always be written** (§11).
9. **Trust boundaries and project isolation are stated as checkable rules** (§7).
10. **Governance history is reconciled without editing governance documents** (§3), including the unresolved contradiction between the canonical decision and the Project Map.

Sections 14–16 consolidate the decision register (including the previously missing J.7), the corrected acceptance-test matrix with an accurate evidence-quality statement, and the full correction record.

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
| Current `main` contains no payment source code | `git ls-tree -r origin/main` matches exactly one payment path: the canonical decision document. No `payment-configurations.ts`, no payment tests. |
| Current `main` head | `6f74476c29b4dc02c37aa4936a21f844ef3db234`. |
| Restoration work is **local and unmerged** | Commit `f079be7ba31242f51f35caa5c42ebc01a8017982` (`fix(payments): verify the whole payment schema and close on failed startup`) exists only in a local worktree; no remote ref contains it. |
| The remote "restoration" branches contain **patch artifacts, not source** | `review/payment-restoration-f079be7-2026-11-02` (`827ca28`), `review/payment-restoration-final-2026-11-02` (`7ab911a`), and `review/payment-restoration-patch-2026-11-02` (`1330ecd`) each contain only `review-artifacts/*.patch` alongside the decision document. They are review artifacts, not restored application branches. |
| The original PR #54 branch still exists remotely | `feat/payments-config-obligations` at `51a796a`. |
| Slice 2A and Slice 2B have no implementation authorization | No implementation branch, no merge, no deployment exists for either. |

**Correction to Revision 1:** Revision 1 described the restored candidate as existing "as `review/payment-restoration-f079be7-2026-11-02` on origin". That branch does not contain the restored source; it contains a patch file. A patch artifact is not a source branch, and neither restores `main`.

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

---

## 4. Evidence Identity Model

### 4.1 Why Revision 1's identity was unsafe

Revision 1 used `(source_kind, source_namespace, source_event_id)` as a *global* deduplication identity for payments. That tuple identifies **one observation**, not one **funds movement**. The same provider transaction can legitimately arrive twice:

- as a webhook delivery (`source_kind = provider_webhook`, delivery id `evt_1`), and
- as an API reconciliation entry (`source_kind = provider_api_reconciliation`, observation id `rec_9`).

Those are different tuples, so both pass the uniqueness constraint, both can be accepted, and the funds get counted twice. Delivery-scoped uniqueness cannot prevent this.

### 4.2 The three identities

**A. Source delivery identity** — identifies exactly one incoming observation.

```
source_delivery_key = (source_registration_id, delivery_reference)
```

- `delivery_reference` is the provider's delivery/event identifier for a webhook, or the reconciliation observation identifier for an API pull.
- Uniqueness: `UNIQUE(source_registration_id, delivery_reference)`.
- Guarantees: one delivery is processed once. It guarantees **nothing** about funds.

**B. Canonical transaction identity** — identifies the underlying funds movement independently of how it was observed.

```
canonical_transaction_key = (source_registration_id, provider_transaction_reference)
```

- `source_registration_id` is the trusted provider/account namespace (§7.1), not a request-supplied string.
- `provider_transaction_reference` is the provider's own reference to the funds movement, carried by the provider contract (for example the payment/charge identifier), supplied by the provider rather than derived by this system.
- Uniqueness: `UNIQUE(source_registration_id, provider_transaction_reference)` on `payment_transaction`.
- Consequences: at most one canonical transaction exists per provider transaction per registered account; N observations of it across M channels still yield one transaction and one amount of available funds.

**C. Internal allocation identity** — identifies an application operation.

- `allocation_request_id` identifies one idempotent allocation request (§12.2).
- `allocation_id` identifies one applied allocation record (§12.1).
- These are internal identities. They are never derived from, never equal to, and never interchangeable with `delivery_reference` or `provider_transaction_reference`. A single canonical transaction may back many allocations; a single allocation request yields at most one allocation.

### 4.3 Source-to-transaction correlation

Correlation is recorded, not inferred:

- `payment_transaction_observation` links an observation to a canonical transaction with `correlation_basis`:
  - `provider_shared_reference` — the provider contract states that both observations carry the same `provider_transaction_reference`. **The only basis permitted in Slice 2A.**
  - `verified_mapping` — an externally verified mapping established outside this system. Not available in Slice 2A; requires a J.3 decision defining the mapping's authority.
  - `unresolved` — no reliable cross-channel reference was supplied.

Rules:

1. Only correlate observations across source kinds when a trusted provider contract or verified mapping establishes that they refer to the same transaction.
2. Never merge observations because amounts, currency, or timestamps look similar. Amount equality is not identity (I3 and §4.4).
3. A correlated duplicate observation is recorded (it is evidence of what the provider reported) but contributes **no additional funds**. Available funds are a property of the canonical transaction, not of the observation count.

### 4.4 When the provider supplies no reliable cross-channel reference

This is the dangerous case, and it is handled by refusing to guess:

- Each observation remains independently recorded under its own delivery identity.
- Each observation that cannot be promoted is linked with `correlation_basis = unresolved` and is **not** promoted to a canonical transaction's funds.
- An open `reconciliation_conflict` of kind `unresolved_correlation` is created (§6.2), naming every observation involved.
- While that conflict is open, none of the involved observations contributes to derived financial position. They are retained as evidence, not as money.
- Resolution requires an approved correlation rule under J.3 (or a later J.10-authorized human determination). Until then, the condition is reported as unresolved. It is never resolved by auto-merging, by picking the larger amount, or by accepting both as separate funds.

### 4.5 Reported versus accepted

Two questions have two different answers, and both are preserved:

| Question | Authoritative record |
|---|---|
| What did the provider report? | `payment_observation` (immutable, verbatim normalized facts) |
| What has this system accepted as funds? | `payment_transaction` (immutable, accepted amount and currency) |

A conflict between them is never resolved by overwriting either record.

---

## 5. Relational Model and Slice Boundaries

### 5.1 Records

`C` = configuration/obligation records delivered by the (rolled-back) initial slice; `2A` and `2B` mark the slice that owns the record. "Baseline" means the commercial-baseline linkage to the accepted-proposal and signed-agreement versions via the configuration version.

| Record | Primary identity | Foreign keys | Project ownership | Baseline | Immutability | Idempotency | Authority |
|---|---|---|---|---|---|---|---|
| `payment_source_registration` (2A) | `source_registration_id` | `project_id` | **Defines** project ownership for its namespace | none | Append-only; changes via a new registration that `supersedes_registration_id`s the old one | `UNIQUE(project_id, source_kind, source_namespace)` for active rows | **Authoritative** for trust |
| `payment_observation` (2A) | `observation_id` | `source_registration_id` → registration | **Derived** from the registration; never from the request | none | Immutable | `UNIQUE(source_registration_id, delivery_reference)` | **Authoritative** for "what the provider reported" |
| `verification_result` (2A) | `verification_id` | `observation_id` (NOT NULL) → observation; `payment_transaction_id` (nullable) → transaction | Derived from observation | none | Immutable | One result per attempt; attempts are distinct records | **Authoritative** for the verification outcome |
| `payment_transaction` (2A) | `payment_transaction_id` | `source_registration_id`; `accepted_verification_id` → verification | Derived from registration | none | Immutable | `UNIQUE(source_registration_id, provider_transaction_reference)` | **Authoritative** for "what the system accepted as funds" |
| `payment_transaction_observation` (2A) | `(observation_id, payment_transaction_id)` | both | Derived | none | Immutable | Natural key | **Derived** correlation record |
| `reconciliation_conflict` (2A) | `conflict_id` | observations involved; optional transaction | Derived | none | Immutable header; state derived from resolutions | One open conflict per detected condition | **Authoritative** that a conflict exists |
| `conflict_resolution` (2A) | `resolution_id` | `conflict_id` | Derived | none | Immutable | One resolution event per decision | **Authoritative** resolution history |
| `verification_supersession` (2A) | `supersession_id` | superseding and superseded verification ids | Derived | none | Immutable | One record per supersession | **Authoritative** precedence |
| `payment_configuration_version` (C) | `payment_config_version_id` | `project_id`, `proposal_version_id`, `agreement_version_id` | `project_id` | **Is** the baseline anchor | Immutable version | Version number per project | **Authoritative** commercial baseline |
| `payment_obligation` (C) | `obligation_id` | `payment_config_version_id` | via configuration | Member of exactly one configuration version | Immutable after issuance | Deterministic ordering within version | **Authoritative** for expected amount and currency |
| `allocation_request` (2B) | `allocation_request_id` | `project_id`, `payment_transaction_id` | `project_id` | none | Immutable payload and recorded outcome | `UNIQUE(project_id, idempotency_key)` | **Authoritative** idempotency record |
| `allocation` (2B) | `allocation_id` | `payment_transaction_id`, `obligation_id`, `allocation_request_id`, `compensates_allocation_id` (nullable) | `project_id` | via obligation | Immutable; corrections are new records | Exactly one allocation per accepted request | **Authoritative** applied allocation |
| `audit_event` (existing) | `audit_event_id` | none (identifier metadata only) | `project_id` column, identifier-only | none | Append-only | n/a | **Authoritative** audit trail |

Derived, never stored as authoritative columns: obligation remaining balance, transaction unapplied funds, whether an obligation is satisfied, aggregate financial position, an obligation's state beyond `proposed`. Any materialized view of these is rebuildable and explicitly non-authoritative.

### 5.2 The Slice 2A / 2B boundary, precisely

**Slice 2A may establish:** trusted registrations, observations, verification results, canonical accepted transactions, correlation, conflicts, supersession, and audit — a *synthetic verified-payment-transaction foundation*, subject to J.3 approval.

**Slice 2A must not establish or imply:**

- that an obligation is paid, satisfied, or partially satisfied;
- any obligation-specific allocation check (no allocation subsystem exists in 2A, so no such check can exist);
- any `obligation_id` association on evidence or transactions invented to make an acceptance test pass;
- any obligation state other than `proposed` (configuration membership);
- any inference from "funds accepted" to "obligation settled".

Verification in 2A compares an observation against the **configuration currency** (J.13) and the verification contract. It does **not** compare against an obligation's expected amount; that comparison is a 2B allocation-time determination and requires J.14.

**Checks that belong to 2A:** registration trust; delivery uniqueness; provider reference presence and uniqueness; currency agreement with the configuration; exact decimal validity; project consistency; correlation recording; conflict detection; supersession recording; atomic audit.

**Checks that belong to 2B:** request idempotency; per-transaction available funds (I2); per-obligation remaining balance (I1); currency equality across transaction, obligation, and allocation; serialized write; obligation satisfaction under the selected J.14 option; compensating corrections.

**Slice 2A does not weaken the activation predicate.** The canonical predicate requires each required obligation to be individually satisfied against its own expected amount and currency (§F.2 of the canonical decision). A 2A foundation has no allocation and therefore cannot satisfy that predicate. No activation logic exists in either slice's current authorization.

---

## 6. Verification Results, Reconciliation Conflicts, and Supersession

Revision 1's acceptance tests asserted `outcome = "reconciliation_conflict"` while its schema enumerated only `passed`, `failed`, `rejected`. Revision 2 removes the contradiction by separating the concepts.

### 6.1 Verification result — semantics fixed

`verification_result.outcome` is exactly one of:

| Outcome | Meaning | Persistence consequence |
|---|---|---|
| `passed` | The observation satisfied the approved verification contract and its facts were accepted. | A `payment_transaction` is written in the same transaction; `verification_result.payment_transaction_id` is set. |
| `failed` | A verification attempt could not reach a conclusion for a technical or transient reason (for example the observation arrived before its registration was active, or a required provider reference was absent). | No acceptance. Retry is permitted as a new attempt with its own record. |
| `rejected` | The observation is definitively inadmissible: malformed amount, currency mismatch with the configuration, untrusted or unknown registration, or a cross-project identity collision. | No acceptance. Retrying the same observation is not expected to succeed; a new *corrected* observation is a new delivery. |

A conflict is **not** an outcome. It is a separate record (§6.2). This is deliberate: folding conflicts into the outcome enum is what produced Revision 1's schema/test mismatch, and it also conflated "verification of one observation" with "disagreement between two records".

### 6.2 Reconciliation conflict — separate record

`reconciliation_conflict` fields:

| Field | Meaning |
|---|---|
| `conflict_id` | Primary identity. |
| `project_id` | Owning project (derived, not caller-supplied). |
| `conflict_kind` | `duplicate_content_mismatch`, `cross_source_conflict`, `unresolved_correlation`, `cross_project_collision`. |
| `observation_ids` | All observations involved. |
| `payment_transaction_id` | Nullable; set when a specific accepted transaction is affected. |
| `detected_at`, `detection_source` | When and by which check the conflict was found. |
| `blocks_use` | Derived: open conflicts block the affected transaction from contributing to derived financial position. |

Resolution history is append-only in `conflict_resolution` (`resolution_id`, `conflict_id`, `resolution_kind`, `decided_by_kind`, `decided_by_reference`, `decided_at`, `rationale_code`). A conflict is never "fixed" by editing it.

A conflict **blocks use, not existence**: the accepted transaction and its observations remain recorded and auditable. Blocking is expressed in the derived position and in the allocation precondition (§12.3).

### 6.3 Accepted canonical transaction — immutable

Once a `payment_transaction` is written, its identity, accepted amount, and accepted currency are immutable. Later information cannot rewrite them. This prevents a later failed observation from silently erasing earlier accepted funds.

### 6.4 Supersession — explicit precedence, never "latest wins"

A later verification or reconciliation event may supersede an earlier conclusion only by writing a `verification_supersession` record. Rules:

1. **No implicit precedence.** The current position is not "the latest verification row". Selecting the latest row would let a later `failed` observation silently invalidate an earlier accepted transaction — which is exactly the failure mode the canonical decision forbids (§D.6, §E.2).
2. **A `failed` or `rejected` result never by itself revokes acceptance.** It records an attempt outcome.
3. **Revocation requires a supersession record** naming the superseded verification, the superseding verification, a `reason_code`, and the authority that produced it. In Slice 2A only automated rules approved under J.3 may create one; no human override exists in 2A.
4. **Supersession is one-directional and terminal per record:** a superseded verification cannot be un-superseded; the superseding record may itself be superseded later.
5. **The derived position walks the supersession chain** from the accepted verification to its head, and applies open conflicts as blocks.
6. **A supersession never deletes or mutates** the superseded result, the transaction, or the observations.

### 6.5 Failed verification without an accepted evidence record

The referential problem in Revision 1 was a nullable `evidence_id` with no other anchor, producing rows that referenced nothing meaningful.

Fix: `verification_result.observation_id` is **NOT NULL** — every verification attempt verifies a specific observation, whether or not it succeeds. `payment_transaction_id` is nullable precisely because a failed or rejected attempt accepts no funds. Referential integrity is therefore complete: a failed verification points at a real observation; a passed one points at both an observation and the transaction it accepted.

A failure never pretends an accepted payment exists, and never requires one to exist.

---

## 7. Trust Boundaries, Project Isolation, and Security

All rules below reuse the canonical decision's existing security contract (§G.2, §G.3, §H). No new customer capability is introduced.

### 7.1 How trusted provider/account identity is established

Only by a `payment_source_registration` row created by the Founder/internal capability on the internal surface. The namespace value comes from server-side configuration, never from a request body. A syntactically valid namespace supplied by an untrusted caller is **not** trusted: matching a string is not authentication. Unregistered namespaces produce `rejected` verification results and no records.

### 7.2 How external observations become associated with a project

The observation's `project_id` is derived from `source_registration_id`. A caller may not supply it. If a request carries a project reference, that reference is resolved within the caller's organization and compared against the registration's project; mismatch is rejected and recorded as `cross_project_collision`.

### 7.3 How project ownership is derived rather than trusted

The existing pattern is mandatory: resolve the caller-supplied reference inside the caller's organization, then re-check authorization server-side on every read and every write. Internal payment operations require the internal capability attached to a Person and never run on a customer route with hidden controls.

### 7.4 How configuration and baseline identities are checked

A transaction or allocation may reference only a configuration version belonging to the same project. The configuration's `proposal_version_id` and `agreement_version_id` are revalidated as the current versions at write time; a stale configuration is not silently used (canonical decision §B.1). Obligations must be members of the configuration version being evaluated.

### 7.5 How cross-project collisions are rejected

Canonical keys are unique per registration. If a `provider_transaction_reference` resolves to an existing transaction owned by a different project, the write is refused and a `cross_project_collision` conflict is recorded. A second project never inherits another project's transaction.

### 7.6 How customer access stays read-only

Customer surfaces expose derived status only, under existing project-access checks. There is no customer route that writes payment state, submits evidence, or allocates funds — in this design or any later one implied here.

### 7.7 How automated provider authentication differs from human authorization

Automated verification is a `verifier_kind = automated` result tied to a registered namespace and verifier configuration version. It authenticates a *channel*, not a person. Human determination is `verifier_kind = human`, requires the internal capability and a J.10 decision, and is out of Slice 2A scope entirely. An automated pass can never produce a human determination, and vice versa.

### 7.8 How audit records stay identifier-only

`audit_event.metadata` is restricted to an allowlist of identifier keys (§8.4). No amounts, currencies, payloads, credentials, or provider secrets. Enforcement is by allowlist rejection at write plus a test that rejects forbidden key patterns — not by searching for one sample amount string.

---

## 8. Slice 2A Scope and Minimum Schema

### 8.1 Scope

Slice 2A is the synthetic, provider-neutral foundation: registrations, observations, verification results, canonical transactions, correlation, conflicts, supersession, exact decimals, currency agreement, project isolation, identifier-only audit. Synthetic/test data only. It requires J.3 resolution before implementation.

### 8.2 Records and constraints

| Record | Required constraints |
|---|---|
| `payment_source_registration` | `UNIQUE(project_id, source_kind, source_namespace)` for active rows; `supersedes_registration_id` self-FK; no customer-writable path. |
| `payment_observation` | `UNIQUE(source_registration_id, delivery_reference)`; `CHECK(amount_text <> '')`; `CHECK(currency = UPPER(currency))`; `project_id` NOT NULL, derived. |
| `verification_result` | `observation_id` NOT NULL; `payment_transaction_id` nullable; `outcome IN ('passed','failed','rejected')`; `CHECK(outcome <> 'passed' OR payment_transaction_id IS NOT NULL)`. |
| `payment_transaction` | `UNIQUE(source_registration_id, provider_transaction_reference)`; accepted amount and currency NOT NULL; `accepted_verification_id` NOT NULL. |
| `payment_transaction_observation` | PK `(observation_id, payment_transaction_id)`; `correlation_basis IN ('provider_shared_reference','verified_mapping','unresolved')`; Slice 2A permits only `provider_shared_reference` and `unresolved`. |
| `reconciliation_conflict` | `conflict_kind` enumerated; `blocks_use` derived. |
| `conflict_resolution` | `conflict_id` NOT NULL; append-only. |
| `verification_supersession` | `superseded_verification_id <> superseding_verification_id`; append-only. |
| `audit_event` | `metadata` validated against the identifier allowlist at write. |

There is **no** `status` column on observations, transactions, or evidence rows. Position and blocks are derived (I4, §6).

### 8.3 What Slice 2A explicitly does not contain

No `allocation`; no `allocation_request`; no obligation linkage on evidence or transactions; no obligation state beyond `proposed`; no payment-attempt, retry, dunning, or notification subsystem; no manual determination; no customer upload; no activation predicate or event; no provider integration; no production data.

### 8.4 Audit allowlist

Permitted metadata keys: `evidence_id`, `observation_id`, `verification_id`, `payment_transaction_id`, `conflict_id`, `obligation_id`, `versionNumber`, `paymentConfigVersionId`, `proposalVersionId`, `agreementVersionId`, `source_registration_id`, `allocation_id`, `allocation_request_id`.

Rejected patterns at write time: any key matching `/amount|currency|due|scope|credential|secret|payload|token/i`.

This allowlist check is the primary control. A substring search for a literal sample amount is retained only as a regression assertion, never as the proof of privacy.

---

## 9. Synthetic Fixtures, Test Verification, and the Fake Verifier

Four different things must never be confused. Revision 1 blurred them by having `fake_verifier(event)` return `"passed"` with `verified_by = founder_person_id`, which fabricates Founder approval.

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
- Emits `verifier_kind = test_fake`, `verified_by = NULL`, `verified_at_source = test_clock`. It must **never** emit a Founder person identifier, and a database constraint rejects `verifier_kind = test_fake` together with a non-null `verified_by`.
- Records it produces carry `data_classification = synthetic`; a constraint prevents a synthetic transaction from being marked real.

### 9.2 What `verified_by` means

- **Automated verification:** `verified_by` is NULL. The record instead carries `verifier_kind = automated` and `verifier_reference` = the identifier of the verifier configuration/version that ran. Naming a person here would imply a human determination that never happened.
- **Human determination:** `verified_by` is the acting person's identifier plus the capability and the governing J.10 decision reference. This path does not exist until J.10 is resolved.

Manual determination stays governed by J.10 and is out of scope. No production payment processing, provider selection, provider integration, or credentials are authorized by this proposal.

---

## 10. Decimal, Currency, and Exact Arithmetic Contract

I3 governs. Revision 1 preserved decimal *strings* but never specified what "exact" required.

### 10.1 Accepted grammar

```
amount := unsigned | signed          (payments use unsigned only)
unsigned := int ( "." frac )?
int      := "0" | [1-9][0-9]{0,17}
frac     := [0-9]{1,6}
```

- Maximum 18 integer digits and at most 6 fractional digits (scale ≤ 6).
- Leading `+`, exponent notation, thousands separators, whitespace, and `,` decimal separators are rejected.
- Zero and negative amounts are rejected for payment observations and allocations.

### 10.2 Preservation of original text

`amount_text` stores the exact text the provider or operator supplied, unmodified. Normalization produces a separate `amount_normalized` value plus `amount_scale`; the original is never overwritten, so evidence remains verbatim.

### 10.3 Canonical normalization

1. Parse into `(sign, integer_digits, fraction_digits)`.
2. Strip trailing zeros from `fraction_digits`.
3. Drop an empty fraction.
4. Result is `integer_digits` or `integer_digits + "." + fraction_digits`.

Therefore `1500`, `1500.00`, and `1500.000` all normalize to `1500` with scale 0 and are the same value.

### 10.4 Exact comparison

- Compare **values**, never text. Lexicographic comparison is forbidden: it would rank `"900"` above `"1500"`.
- Compare `(sign, integer_digits, fraction_digits)` after normalization, or compare integer-scaled representations at a common scale.
- Equality of `1500` and `1500.00` is **true**; equality of `1500` and `1500.01` is false.

### 10.5 Exact addition and subtraction

- Represent values as sign plus arbitrary-precision integers (`BigInt` or an equivalent decimal library) scaled to a common exponent.
- Addition and subtraction are performed on those integers; no intermediate rounding exists.
- Sums used for ceilings (I1, I2) are exact sums of exact values, computed inside the write transaction (§12.3).

### 10.6 Currency

- Normalize by trimming and ASCII-uppercasing; valid form is `^[A-Z]{3}$`.
- A three-letter string does **not** prove a currency is real. This proposal introduces no currency table and makes no ISO-4217 claim.
- The operative rule is J.13: the code must equal the project's registered configuration currency exactly. Anything else is `rejected`. No conversion, rounding, or re-scaling exists, and no exchange rate is introduced.
- Transaction, obligation, and allocation currency must be identical at allocation time (§12.3).

### 10.7 Failure handling

| Condition | Result |
|---|---|
| Malformed grammar | `rejected`; no record written; validation error returned. |
| More than 18 integer digits or scale > 6 | `rejected`. |
| Sum overflow beyond 18 integer digits | Operation refused; no partial write. |
| Currency mismatch with configuration | `rejected`; nothing persisted. |
| Currency mismatch at allocation time | Allocation refused; nothing persisted. |

No financial amount is ever parsed into a JavaScript floating-point number, at any layer, including tests.

---

## 11. SQLite Transactionality, Concurrency, and Failure Reporting

### 11.1 Failure classes are distinct

Revision 1 claimed that after three failed lock retries a `payment_evidence.write_failure` audit row is appended. That is not always possible: if the database is locked, the audit insert can fail for the same reason. Revision 2 separates the classes:

| Class | Detection | Handling |
|---|---|---|
| **Uniqueness conflict** | `SQLITE_CONSTRAINT_UNIQUE` / primary-key violation | Not an error. Resolve to the replay path: read the existing row, compare normalized content, return the original outcome (§4.2, §12.2). |
| **`SQLITE_BUSY`** | Contention; database reachable | Bounded retry of the whole transaction (see 11.2). |
| **`SQLITE_LOCKED`** | Lock held, typically shared-cache or schema lock | Same bounded retry, distinct metric; not treated as busy. |
| **Other persistence failure** | I/O, disk, corruption | Fail the operation; no retry loop. |
| **Verification rejection** | Business outcome | Not an error: a `rejected` verification result is committed. |
| **Reconciliation conflict** | Detected inconsistency | Not an error: a conflict record is committed. |

### 11.2 Bounded retry — a recommendation, not a guarantee

Proposed: retry the entire transaction up to 5 attempts with exponential backoff and jitter (base ~50 ms, cap ~1 s). This is a **technical recommendation to be validated during implementation**, not a guarantee that a write eventually succeeds. The whole transaction is retried, never a partially applied one; rollback precedes retry.

### 11.3 Audit integrity on failure

- When a write **succeeds**, the material records and their identifier-only audit rows commit in one transaction (I6). Either both exist or neither does.
- When a write **fails**, no audit row can be claimed. The failure is reported through an out-of-band operational channel (structured application log or metric) containing only: operation type, project identifier, record identifier if one was assigned before the failure, failure class, attempt count, and timestamp. No amounts, no currency, no provider payload, no credentials, no customer-sensitive content.
- The proposal explicitly does **not** claim a committed audit record for a failed write. Reporting a write failure as an "audit event" in the same database would be a false statement about durability.

### 11.4 No isolation claim

SQLite is not claimed to provide snapshot isolation. The guarantees relied on are: uniqueness constraints enforced by the database, `BEGIN IMMEDIATE` serialization of writers (§12.3), and atomic commit. Readers may observe pre-commit state; nothing here depends on repeatable reads.

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

### 12.2 Mandatory, stable allocation-request idempotency

Revision 1 made `allocation_request` optional and fell back to `(transaction_id, obligation_id, allocated_amount, allocated_currency)`. That fallback is unsafe: two genuinely distinct allocation requests with identical values are indistinguishable, so a legitimate second request is discarded as a duplicate — or, worse, a replay is created because the values differ in scale.

Revision 2 removes the fallback entirely. `allocation_request` is **mandatory**:

- `UNIQUE(project_id, idempotency_key)`, where `idempotency_key` is an opaque caller-supplied request identifier.
- `payload_digest` records a canonical digest of the normalized request payload (transaction, obligation, exact normalized amount, currency).
- **Same key + same digest** → return the original recorded outcome; no second allocation, no state change.
- **Same key + different digest** → reject as an idempotency conflict (`409` semantics); nothing written.
- **Different keys** → distinct requests, even when monetary values are identical; each may succeed subject to I1 and I2.
- The request row, its recorded outcome, the allocation, and the audit row commit in one transaction. A replay reads the committed outcome and never re-executes.
- The database constraints — not application memory — enforce the contract.

### 12.3 Transactional allocation contract

Revision 1 relied on an application-level precheck, `SUM(allocated_amount) <= verified_amount`, executed outside the write transaction. Two concurrent requests can both pass it and both write, over-allocating.

Corrected contract — every allocation performs, in this order, inside one serialized write transaction:

1. `BEGIN IMMEDIATE` (or a technically equivalent serialized-write strategy) **before** reading any ceiling.
2. Resolve the request by `(project_id, idempotency_key)`; on replay with matching digest, return the recorded outcome and commit nothing new.
3. Re-read the canonical transaction: accepted amount and currency, and require that no open conflict sets `blocks_use` (§6.2). Recompute `SUM(allocated_amount * effect_sign)` for that transaction **inside** the transaction.
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

Revision 1's four options were not independent: Option C largely repeated ceilings that every option already enforces, and Option D described *who* allocates rather than *what policy* applies. Revision 2 separates the decision into dimensions and requires each option to answer all eleven.

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

### 13.4 J.10 is not an allocation option

J.10 asks **who may make or override a manual payment-status determination**. It is required whenever that capability is proposed — regardless of which allocation option is selected. Revision 1 wrongly presented J.10 as relevant only under Option D.

The distinction:

- **Founder-directed allocation** is the act of deciding *which verified funds are applied to which obligation*. It assumes funds already verified (J.3) and moves no money.
- **Manual payment-status determination** is the act of asserting or overriding *whether an obligation is paid*, potentially against the verification record.

These are different capabilities with different misuse risk. The second is the highest-risk path in the design, remains governed by J.10, and is not authorized by any option in §13.5. If a future slice proposes it, J.10 must be resolved first, whichever allocation option is in force.

### 13.5 Options

All four options apply I1–I6, D4, D5, D8, D10, and D11 identically. They differ only where the matrix shows.

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

No tests were executed during this documentation revision. Everything in §15 is a **proposed acceptance criterion**, not a reported result.

### 15.1 Slice 2A acceptance criteria

| # | Test | Expected |
|---|---|---|
| 1 | Trusted source namespace accepted | Observation from a registered namespace verifies; `passed`. |
| 2 | Unregistered namespace | `rejected`; no records. |
| 3 | Source delivery identity | Same `(registration, delivery_reference)` twice → one observation; second returns the original. |
| 4 | Canonical transaction identity | One `(registration, provider_transaction_reference)` yields one transaction. |
| 5 | Duplicate webhook delivery | No second observation; no second funds. |
| 6 | Duplicate API reconciliation observation | Same as 5, through the other channel. |
| 7 | Cross-source observation of the same transaction | Webhook + reconciliation sharing a provider reference → one transaction, one amount, two observations linked with `provider_shared_reference`. |
| 8 | Conflicting transaction observations | Same key, different amount → transaction unchanged; `duplicate_content_mismatch` conflict open; `blocks_use` true. |
| 9 | Unresolved correlation (no shared reference) | Observations retained, none promoted; `unresolved_correlation` conflict open; no contribution to financial position. |
| 10 | Cross-project identity collision | Refused; `cross_project_collision` conflict; no second project's transaction. |
| 11 | Invalid verification | Malformed amount or currency mismatch → `rejected`, nothing persisted. |
| 12 | Failed verification without accepted evidence | `failed` row referencing a real observation, `payment_transaction_id` NULL; no phantom transaction. |
| 13 | Verification supersession | A later `failed` result alone does not revoke acceptance; revocation requires a supersession record and is auditable. |
| 14 | Immutable history | Attempts to update or delete observations, results, transactions, or conflicts fail; corrections are new rows. |
| 15 | Exact decimal validation | `1500` = `1500.00` = `1500.000`; `1500` ≠ `1500.01`; `"900"` not ranked above `"1500"`; 19 integer digits and scale 7 rejected; no float parsing anywhere. |
| 16 | Currency consistency | Non-matching configuration currency rejected before persistence; case-insensitive normalization only; no conversion. |
| 17 | Transactional evidence + audit integrity | Material rows and audit rows commit together or not at all. |
| 18 | Concurrent duplicate ingestion | Two simultaneous identical deliveries → exactly one observation, one transaction, one audit row. |
| 19 | Customer/internal boundary | Customer surface cannot write; cross-project reads rejected server-side; internal capability required for writes. |
| 20 | No false payment-satisfaction inference | No 2A record, view, or derived value reports an obligation as paid, satisfied, or partially satisfied. |
| 21 | Synthetic never live evidence | `test_fake` verifier carries `verified_by = NULL`; constraint rejects any Founder identifier; synthetic transactions cannot be marked real. |

### 15.2 Slice 2B acceptance criteria

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

Slice 2B tests are not Slice 2A acceptance criteria.

### 15.3 Threat analysis (Slice 2A)

| Threat | Defense |
|---|---|
| Double-counting across channels | Canonical transaction identity (§4.2); correlation recorded (§4.3); unresolved conflicts block use (§4.4). |
| Duplicate delivery | Delivery uniqueness; replay returns the original record. |
| Forged or untrusted namespace | Registration-based trust; matching a string is not authentication (§7.1). |
| Cross-project access or collision | Server-side project resolution; derived project ownership; collision refusal (§7.5). |
| Evidence fabricated as live payment | Test-only verifier with constraints (§9.1). |
| Silent revocation of accepted funds | Supersession requires an explicit record (§6.4). |
| Audit leakage | Identifier allowlist enforced at write (§8.4). |
| Funding double-count via allocation | Out of 2A; prevented in 2B by I1/I2 inside a serialized transaction (§12.3). |
| Float or lexicographic money errors | Exact decimal contract (§10). |

### 15.4 Test-count accuracy

- Revision 1 claimed "328 tests pass" and reused that number as evidence for unchanged behavior. **No fresh evidence supports 328.**
- The recorded result for PR #54 at head `51a796a` is: **321 passed** (implementation-agent-reported), plus typecheck and build passing, plus fresh GitHub checks (Website CI, Dependency Review, CodeQL, Snyk) reported as successful on that head.
- Those are **historical, agent-reported** results for a rolled-back slice. They are not current, not independently reproduced here, and not evidence about code that is not in `main`.
- No test was executed during this revision. Reported results, independently verified results, and proposed acceptance criteria are labelled separately and never merged.

---

## 16. Exclusions, Readiness Verdict, and Correction Record

### 16.1 Explicit exclusions

Excluded from Slice 2A: allocations; allocation requests; obligation linkage on evidence; obligation states beyond `proposed`; payment attempts, retries, dunning, notifications; manual determination; customer upload or any customer write; activation predicate or event; provider integration, webhook receiver, credentials; production or live customer data; mutable `status` columns; caller-controlled trust; snapshot-isolation claims; audit events for failed writes; fabricated test-pass claims.

Excluded from Slice 2B as of this revision: any satisfaction rule before J.14; refund, reversal, chargeback behavior (J.5/J.6); activation integration (J.9); provider integration (J.8).

Excluded from this task entirely: application source, tests, schemas, migrations, dependencies, workflows, governance documents, and any additional repository change.

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
| C — Source identity | Delivery-scoped identity introduced (superseded by Revision 2 §4, which shows it is insufficient alone). |
| D — J.14 rewrite | Rewritten as options (superseded by Revision 2 §13, which makes the options independent). |
| E — Allocation model | Normalized allocation records; no arrays of allocation IDs. |
| F — Attempts, states, SQLite | Attempts excluded; no `failed` obligation state; snapshot isolation not claimed. |

**Revision 2 corrections:**

| Finding | Original problem | Correction | Section |
|---|---|---|---|
| **A** | One provider transaction could be accepted twice through different channels. | Three identities — delivery, canonical transaction, allocation — with uniqueness, correlation basis, and blocking of unresolved correlations. | §4 |
| **B** | No defined evidence → transaction → configuration → obligation relationship; `allocation.transaction_id` had no verified FK. | Full record model with identities, FKs, ownership, baseline, immutability, idempotency, authority; Slice 2A cannot claim payment or satisfaction; no invented `obligation_id`. | §5 |
| **C** | Tests used `reconciliation_conflict` while the enum lacked it; verification, conflict, acceptance, and position were conflated. | Outcome enum fixed to `passed`/`failed`/`rejected`; conflicts are a separate record; supersession is explicit; no "latest wins"; failed verification references an observation, not a phantom payment. | §6 |
| **D** | `fake_verifier` returned passed with a Founder identity. | Test-only verifier, fail-closed production path, `verified_by = NULL`, synthetic classification constraints, explicit `verified_by` semantics. | §9 |
| **E** | J.14 presented without clear non-canonical status; options not independent; J.10 tied to Option D. | J.14 labelled proposed and non-canonical; eleven dimensions; four internally consistent options; comparison matrix; J.10 separated and required under every option. | §13 |
| **F** | Allocation relied on a check-then-write precheck. | Serialized write (`BEGIN IMMEDIATE`), inside-transaction rechecks of both ceilings, atomic writes, defined busy/rollback/replay behavior, mandatory request idempotency, compensating corrections. | §12 |
| **Finding 9 — Decimal, currency, financial calculations** | Strings preserved but arithmetic undefined. | Grammar, precision limits, normalization, exact comparison, exact arithmetic, overflow, malformed and currency handling, no floats. | §10 |
| **Finding 10 — SQLite error handling and audit integrity** | Claimed an audit row after failed lock retries. | Failure classes separated; bounded retry as a recommendation; audit guaranteed only for successful writes; out-of-band, redacted failure reporting. | §11 |
| **Finding 11 — Security and project isolation** | Trust boundary under-specified. | Eight explicit rules: registration trust, derived project ownership, baseline checks, collision rejection, read-only customers, automated vs human authority, identifier-only audit. | §7 |
| **Finding 12 — Governance and canonical-document reconciliation** | Rollback and Project Map contradiction handled loosely; patch artifact implied to be restored source. | Verified facts table; five-way distinction; explicit unresolved governance inconsistency; patch artifacts distinguished from source branches; restoration not authorized. | §3 |
| **Finding 13 — Founder decision register** | J.7 missing. | Full J.1–J.13 register plus proposed J.14. | §14 |
| **Finding 14 — Acceptance tests and threat analysis** | Schema/test mismatch; 328 claim unsupported. | Test matrix rebuilt against the actual schema; test-count claim corrected to the verified 321 for PR #54; no tests claimed as run. | §15 |
| **Finding 15 — Document structure and factual accuracy** | Misnumbered subsections, duplicated sections, stale publication statements, wrong section count. | Numbering normalized; duplicate audit section removed; publication facts stated; 16 sections. | Whole document |

---

## Final Statement

This document is a **documentation-only revision**, containing 16 numbered sections. It changes exactly one file: `review-artifacts/payment-slice-2-revised-proposal.md`, published to `review/payment-slice-2-proposal-clean` and reflected in the existing Draft pull request #68 against `main`.

It does not modify application code, tests, schemas, migrations, dependencies, workflows, or governance documents. It does not restore rolled-back implementation, select a provider, add credentials, process payments, activate a project, or deploy anything. It does not merge, close, or promote PR #68.

No Founder decision is resolved by this document. J.14 remains proposed and non-canonical. The canonical-decision/Project-Map approval contradiction remains open and requires separate Founder-authorized correction. Slice 2A and Slice 2B remain unauthorized for implementation.
