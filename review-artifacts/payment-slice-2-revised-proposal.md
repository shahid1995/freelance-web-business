# Payment Slice 2 — Revised Proposal (Documentation-Only)

## Revision Scope and Authority Statement

This proposal is a documentation-only revision of Payment Slice 2. It presents revised technical design text for Founder review and decision. **No application source code, tests, migrations, schemas, or configuration is modified.** No repository documents (`docs/decisions/`, `docs/project-map.md`) are edited. No branches, commits, PRs, or pushes are created. No provider integration, credential configuration, or live customer data processing occurs. The deliverable is proposal text only, presented in the response.

The revision addresses six material issues identified in the review:
- Issue A: Append-only evidence model contradiction
- Issue B: Out-of-scope source kinds in Slice 2A
- Issue C: Source identity and idempotency design
- Issue D: J.14 rewrite as coherent Founder decision options
- Issue E: Allocation model and duplicate-allocation tests
- Issue F: Payment attempts, states, and SQLite concurrency

All recommendations are presented as **proposed technical recommendations** or **unresolved Founder decisions**, not as already-approved decisions.

---

## 1. Executive Summary and Revision Scope

This revision realigns Payment Slice 2 against `docs/decisions/2026-10-12-payments-project-activation.md` (the canonical decision, Founder-approved 2026-10-16). The original proposal introduced several technical deviations from the approved design:

- Mutable statuses on records called "immutable" (Issue A)
- Out-of-scope source kinds (`customer_upload`, `manual_determination`) in Slice 2A (Issue B)
- Incomplete source-identity and idempotency design (Issue C)
- Incoherent J.14 policy options (Issue D)
- Confused allocation model and duplicate-allocation rules (Issue E)
- Payment attempts/obligation-states conflated with incorrect SQLite claims (Issue F)

This revision corrects all six issues. The core architecture splits into two distinct technical scopes:

- **Slice 2A**: Verified Payment Evidence Ledger — synthetic, provider-neutral, append-only evidence records, idempotency, decimal/currency handling, project isolation, identifier-only audit. No allocations, no manual determination, no payment attempts, no activation.
- **Slice 2B**: Allocation and Derived Financial Position — built on Slice 2A foundation; requires J.14 resolution; explicit allocation records, per-transaction fund ceilings, per-obligation balance calculation, derived financial position.

The Founder decisions J.1 and J.2 are resolved (Founder sets amount/currency per project; three initial schedule structures). J.13 is resolved (single currency per configuration). J.3–J.12 and J.14 remain unresolved. This proposal does not resolve any of them on the Founder's behalf but provides decision-ready frameworks for each.

---

## 2. Canonical Decision and Authority Boundaries

The governing design document is `docs/decisions/2026-10-12-payments-project-activation.md`. Its authority boundaries are:

- **J.1 and J.2 are resolved Founder decisions**: Founder sets amount and currency per project; no public pricing catalogue or automatic pricing; three initial schedule structures (full upfront, deposit plus later, milestone-linked).
- **Implementation separately approved only for the limited initial provider-neutral Payment Configuration + Obligations slice (synthetic/test data only; delivered by PR #54)**. Later slices, provider selection/activation, and production use remain not approved.
- **PR #54 was merged into `main`** as commit `51a796a7949cb375f59edbac51170ed2de1c02f0`. That implementation was subsequently rolled back from `main` by `a2e7b01533b69d7c13a62379421052bfe3aa3181` ("revert: remove accidentally merged payment configuration slice from main").
- **Current `main` was last independently verified at `6f74476c29b4dc02c37aa4936a21f844ef3db234`**. The restored candidate `f079be7ba31242f51f35caa5c42ebc01a8017982` remains local and unpublished; 0 remote refs push to main.
- **Slice 2A and Slice 2B have not received implementation authorization**.
- **Design approval ≠ implementation approval**. Nothing in this or any related document authorizes processing real payments or activating live projects.

The Project Map (`docs/project-map.md`) reflects the same boundaries: design approved; implementation separately unapproved; J.3–J.12 and J.14 remain unresolved.

---

## 3. Corrected Repository History and Baseline

| Fact | Evidence |
|---|---|
| Initial configuration/obligation implementation approval exists for synthetic/test data only | PR #54 was merged; delivered payment configuration + obligations slice as synthetic/test data only. |
| PR #54 was merged into `main` | Merged as commit `51a796a7949cb375f59edbac51170ed2de1c02f0`. |
| The payment implementation was subsequently rolled back from `main` | Rollback commit `a2e7b01533b69d7c13a62379421052bfe3aa3181` restored `container.ts`, `domain.ts`, `ports.ts`; removed `payment-configurations.ts` and `payment-configurations.test.ts` from main. |
| Current `main` is `6f74476c29b4dc02c37aa4936a21f844ef3db234` | Verified: `git rev-parse main` returns this SHA (latest state in workspace review). |
| Rollback commit `a2e7b01533b69d7c13a62379421052bfe3aa3181` is an ancestor of current `main` | Confirmed from workspace root. |
| The restored candidate at `f079be7ba31242f51f35caa5c42ebc01a8017982` remains local and unpublished | Verified: exists locally and as `review/payment-restoration-f079be7-2026-11-02` on origin; 0 remote refs pushing to main; never merged to main. |
| Slice 2 has not received implementation approval | By design; no implementation branch pushed; no deployment authorized. |
| J.1 and J.2 are resolved by Founder approval 2026-10-16 | Founder sets amount and currency per project; no public pricing catalogue. |
| J.13 is resolved by Founder approval 2026-10-20 | Single currency per configuration; no mixed-currency obligations. |
| J.3–J.12 and J.14 remain unresolved | Per the live register in the canonical decision document. |

**Do not claim** PR #54 was merged into the restored feature branch. It was merged into `main`; the later rollback and restored candidate are separate historical events.

**Governance-document inconsistency (requires separate Founder-authorized correction):** The canonical decision document records implementation approval for the limited initial Payment Configuration + Obligations slice (synthetic/test data only) delivered by PR #54. The current Project Map states implementation remains separately unapproved and that the initial configuration/obligations slice may be considered for separate approval. These documents do **not** reflect the same approval status. This is a governance-document inconsistency requiring separate Founder-authorized correction; neither document is edited by this task.

---

## 4. J.3 Evidence Architecture and Unresolved Decisions

### J.3 Framework — Provider-Neutral, Verification-Gated Evidence Model

J.3 asks: what is the authoritative payment evidence source, and how is it verified?

**This design does not declare any source authoritative by default.** Instead, it provides a source-agnostic evidence model with verification gating. The Founder must later decide which source kind(s) are authoritative.

### Evidence Record (Append-Only, Immutable)

| Field | Type | Notes |
|---|---|---|
| `evidence_id` | UUID | Stable identifier; append-only; never modified after write. |
| `source_kind` | enum `["provider_webhook", "provider_api_reconciliation"]` | **Slice 2A implemented kinds only**. `customer_upload` and `manual_determination` are explicitly outside Slice 2A scope (Issue B). Future source kinds may be added via Founder decision. |
| `source_namespace` | string | Trusted server-side configured namespace or provider account identifier. Must not be arbitrary caller-controlled input (Issue C.1). Unknown/invalid namespaces fail verification (Issue C.2). |
| `source_event_id` | string | Stable source event identifier — **the deduplication key** (Issue C). |
| `amount` | decimal string | Exact text as entered; never parsed to floating-point number. |
| `currency` | 3-letter uppercase string | e.g., `"USD"`. Must match configuration currency (per §J.13). |
| `project_id` | string | Project reference; all reads/writes scoped by project. |

**Critical correction — Issue A (Append-Only Behavior):**

The prior proposal included mutable evidence statuses (`pending`, `accepted`, `conflicting`, `rejected`) while also calling the evidence record immutable. This is corrected as follows:

- **The received source evidence identity and normalized evidence facts are immutable once recorded.** After an evidence record is written, it is never modified.
- **Verification outcomes are represented by immutable events or records, not by mutating the original evidence.** A `verification_result` append-only record references the `evidence_id` and carries the outcome; it does not change the evidence record.
- **The current verification/reconciliation position is derived from the authoritative records.** The "current state" is computed by reading the latest `verification_result` for a given `evidence_id` plus the associated `allocation` records. It is not stored as a mutable column on the evidence record.
- **Conflicting duplicate deliveries never silently overwrite or replace previously accepted evidence.** A duplicate delivery with the same `(source_kind, source_namespace, source_event_id)` deduplication key is recognized and returns a reference to the previously accepted evidence record. A delivery with conflicting `amount` or `currency` against the same key is flagged as conflicting evidence (reconciliation event), and the earlier accepted record is preserved.
- **A rejected or failed verification attempt can be represented without falsely making it an accepted payment.** A `verification_result` record with `outcome` = `"failed"` or `"rejected"` is append-only; it records the failure but does not change the evidence record's status. The evidence record itself remains as originally written.
- **Corrections and superseding decisions preserve the prior history.** If a new verification outcome supersedes a prior one, a new `verification_result` append is written; the prior record is not deleted or overwritten. The derived position reflects the full history.

**One authoritative internal source of payment/obligation state:**

The append-only internal payment ledger of normalized, evidence-backed payment events is the single authoritative source. Derived obligation state (`proposed`/`due`/`partially_paid`/`paid`/`disputed`/`reversed`) is computed from it where needed. If a materialized view exists for performance, it is derived from the ledger and is not an independent source of truth. There are no two competing sources of truth.

**Distinguishing three layers:**

1. **Untrusted incoming delivery** — raw provider webhook or API output; not persisted as authoritative evidence in Slice 2A. May be stored temporarily for verification.
2. **Verification attempt/result** — append-only `verification_result` record: `verification_id` PK, `evidence_id` FK (nullable if no accepted evidence exists), `outcome` enum `["passed", "failed", "rejected"]`, `verified_at`, `verified_by`, `project_id`. For failed verification with no accepted evidence, the FK is nullable and source identity fields may be recorded. Passed verification for accepted evidence is written in the same transaction as the evidence record.
3. **Accepted normalized internal event** — the evidence record itself (`evidence_id`, `source_kind`, `source_namespace`, `source_event_id`, `amount`, `currency`, `project_id`). This is the authoritative ledger entry (Slice 2A). It is never mutated. Allocation relationships belong in Slice 2B only.

The verification gating rule: **A provider callback is not authoritative merely because it was delivered successfully.** Verification logic must pass (e.g., source namespace is trusted, source_event_id is valid, amount/currency match obligation expectations) before the `verification_result` outcome is `"passed"` and the evidence record is accepted.

**Synthetic evidence fixtures and injected fake verifier:**

For testing, Slice 2A includes:
- Pre-constructed synthetic evidence records with deterministic `source_event_id` values.
- Injected fake verifier that produces `verified_at`/`verified_by` without a live provider.
- Test fixtures that exercise the full evidence pipeline (ingest → verify → accept → audit) without any provider dependency.
- These fixtures support unit tests, integration tests, and regression suites entirely in-memory.

**This is a decision framework for the Founder, not a Founder decision itself.**

> **J.3 framework**: Adopt a provider-neutral, verification-gated evidence model where:
> - The authoritative ledger entry is the normalized internal payment event (`source_kind` + `source_namespace` + `source_event_id` + `amount` + `currency`).
> - Provider callbacks are not authoritative by delivery alone; verification logic must pass.
> - Synthetic evidence fixtures and an injected fake verifier support testing without a live provider.
> - Manual determination remains a separately authorized mechanism under J.10, not a prerequisite for Slice 2A implementation.
> - The evidence model is source-agnostic: new `source_kind` values can be added later via Founder decision.
> - The three-layer model (untrusted delivery → verification result → accepted internal event) maintains append-only integrity and one authoritative source.

---

## 5. J.10 Scope and Separation

### J.10 — Who May Make or Override a Manual Payment-Status Determination

**J.10 is required if and only if manual payment-status determination is implemented.** It does not block a synthetic evidence-ledger foundation that contains no manual marking operation.

### Precise Distinction

| Scenario | J.10 Required? | Slice 2A Scope |
|---|---|---|
| **Slice 2A with only normalized evidence records** (no manual marking) | **No** | Evidence records carry `source_kind` = `"provider_webhook"` or `"provider_api_reconciliation"` only. All evidence is external/derived. No manual determination field needed. |
| **Slice 2A with manual determination capability** | **Yes** | Manual determination is a distinct `source_kind` = `"manual_determination"`; requires J.10 to define who may authorize it. **`customer_upload` and `manual_determination` are explicitly outside Slice 2A scope** (Issue B). |
| **Customer-facing evidence submission** | **Never** (explicitly prohibited) | No customer write capability at any point. All evidence ingestion is Founder/internal-authorized. |

### J.10 Scope — Decision-Ready Framing

> **J.10 scope**: If and when Slice 2A includes a `source_kind` = `"manual_determination"` evidence record type, J.10 must define who may authorize such determinations. The recommended scope is: "Founder/internal capability only, least-privileged; never a customer capability."

> **J.10 not required** for the base Slice 2A evidence-ledger design that uses only external source kinds (`provider_webhook`, `provider_api_reconciliation`). Manual determination is an opt-in extension that requires its own Founder decision.

**No customer-facing evidence submission or payment-status write capability is permitted** at any point. This is a hard boundary.

---

## 6. Proposed J.14 Decision Options — Allocation, Partial-Payment and Overpayment Policy

### J.14 — Rationale

The existing design leaves partial-payment behavior unresolved in §B.2 and §D.4. The original J.4, J.5, and J.6 decisions address related but insufficient scope:

- **J.4** (failure, retry limits, dunning, notifications) addresses post-activation failure behaviors; does not cover partial acceptance, overpayment, or multi-transaction allocation.
- **J.5** (reversals, chargebacks, disputes) addresses undo behaviors after a payment exists; Slice 2 has no live payment to reverse from.
- **J.6** (full and partial refund policy) addresses refund execution; does not cover allocation across multiple obligations, per-transaction ceilings, or outstanding balance tracking.

**J.14 must address**: partial payment acceptance; multiple transactions allocated to one obligation; one transaction allocated across multiple obligations; outstanding balances; overpayments; unapplied funds; duplicate allocation; allocation and reconciliation failures.

### Rewritten J.14 Options — Coherent Policy Alternatives

Each option is a complete, self-consistent policy alternative. **Do not recommend any default as though it has already been selected.**

#### Option A: All-or-Nothing with Running Balance

| Behavior | Description |
|---|---|
| **Partial payment acceptance** | No — obligation is satisfied only when the sum of allocations equals the full expected amount. Partial allocations do **not** satisfy the obligation; an obligation remains in `due`/`partially_paid` state until fully funded. Individual partial allocations may accumulate (successive allocations from one or more verified transactions) toward the full amount, but no single partial allocation makes the obligation `paid`. |
| **Receiving funds vs satisfaction** | Receiving/unapplied funds and accepting partial satisfaction are distinct. Funds may sit in an unapplied pool until fully allocated to satisfy an obligation under all-or-nothing rules; partial allocation alone does not constitute satisfaction. |
| **One transaction allocated across multiple obligations** | Yes — a single transaction may be split across multiple obligations, up to each obligation's full expected amount. |
| **Multiple transactions allocated to one obligation** | Yes — successive allocations accumulate toward the full expected amount; remaining balance tracked as `expected_amount - SUM(allocated_amount)`. |
| **Outstanding balances** | Always calculated as `expected_amount - SUM(allocated_amount)` from the authoritative obligation and allocation history; not stored as mutable column. Must always be derivable. |
| **Overpayments** | When total allocated > expected_amount, excess is treated as unapplied fund; no automatic refund unless J.6 decides otherwise. |
| **Duplicate allocation** | Same `transaction_id` may not have allocations exceeding its verified available funds; re-allocation of already-allocated funds rejected. |
| **Allocation correction/reversal** | New allocation records append; prior allocations preserved in history; net balance recomputed from full ledger. |

**Best for**: Founders who want no partial satisfaction; all obligations must be fully funded before `paid` state is reachable.

#### Option B: Partial Payments with Remaining Balance

| Behavior | Description |
|---|---|
| **Partial payment acceptance** | Yes — obligation marked `partially_paid` when allocated < expected_amount; remaining balance > 0 carried forward. |
| **One transaction allocated across multiple obligations** | Yes — same per-obligation ceiling rules; each obligation's remaining balance limits its share. |
| **Multiple transactions allocated to one obligation** | Yes — allocations accumulate; when SUM >= expected_amount, obligation transitions to `paid`. |
| **Outstanding balances** | Always calculated from ledger: `expected_amount - SUM(allocated_amount)`. Never stored mutably. |
| **Overpayments** | When SUM(allocated) > expected_amount, excess becomes unapplied fund; may be rolled to next obligation in sequence or refunded per J.6 policy. |
| **Duplicate allocation** | Same `transaction_id` allocated more than once up to its ceiling; excess rejected. |
| **Allocation correction/reversal** | New append-only allocation records; net position recomputed from full history. |

**Best for**: Founders who accept partial satisfaction; obligations may be partially paid with remaining balance carried forward.

#### Option C: Per-Transaction Ceiling with Overpayment Absorption

| Behavior | Description |
|---|---|
| **Partial payment acceptance** | Yes — each transaction allocated up to its ceiling; remaining balance carried forward after ceiling applied. |
| **One transaction allocated across multiple obligations** | Yes — per-transaction fund ceiling enforced; each obligation's remaining balance also applies. |
| **Multiple transactions allocated to one obligation** | Yes — allocations accumulate; per-obligation remaining balance limits further allocations. |
| **Outstanding balances** | Calculated from ledger; per-obligation ceiling may be separate from per-transaction ceiling. |
| **Overpayments** | Overpayment per transaction absorbed as unapplied fund; no automatic refund unless J.6 decides otherwise. Cumulative overpayments across transactions handled per J.6. |
| **Duplicate allocation** | Same `transaction_id` allocated up to its ceiling; excess rejected. |
| **Allocation correction/reversal** | New append-only records; net position from full history. |

**Best for**: Founders who want strict transaction boundaries; overpayments are absorbed, not automatically refunded.

#### Option D: Founder-Directed Allocation (requires separate Founder decisions on J.10 and J.3)

| Behavior | Description |
|---|---|
| **Partial payment acceptance** | Yes — Founder may direct allocation of verified evidence across obligations. |
| **Founder allocation vs manual status determination** | Founder-directed allocation instructions are **not** automatically evidence that funds moved. J.3 source authority (what constitutes authoritative payment evidence) and J.10 manual payment-status determination (who may mark status) are separate decisions. Allocation of existing verified evidence is distinct from determining payment status. |
| **One transaction allocated across multiple obligations** | Yes — Founder decides distribution per allocation, subject to verified funds and system constraints. |
| **Multiple transactions allocated to one obligation** | Yes — Founder directive. |
| **Outstanding balances** | Always calculated from the authoritative obligation and allocation history (`expected_amount - SUM(allocated_amount)`); balances must always be derivable and are not optional. |
| **Overpayments** | Founder directive: roll, refund, absorb, or other explicitly approved treatment, consistent with append-only history. |
| **Duplicate allocation** | Only authorized allocation of unallocated verified funds; system enforces constraints against double-allocation. |
| **Allocation correction/reversal** | New append-only allocation records; prior history preserved; net position recomputed from full ledger. |

**Note**: Option D requires J.10 (who may make manual determinations) and J.3 (evidence source authority) to be resolved first as separate decisions. It is not available for Slice 2A (which has no manual determination). It is a later-slice option. No Founder policy is chosen by this document.

**Do not recommend Option B or any other default as though it has already been selected.** Present all four options for Founder review.

> **Which Slice 2B behaviors cannot be implemented until J.14 is resolved?**
> - Partial-payment acceptance behavior (Option A vs. B vs. C differ).
> - Overpayment handling (roll, refund, absorb — only Option D specifies Founder directive; A–C have defined behaviors but they differ).
> - Remaining balance calculation policy (per the chosen option).
> - Duplicate allocation prevention rules (all options include some form, but details differ).
> - Allocation across multiple obligations from one transaction (rules on ceilings and balances differ).

---

## 7. Slice 2A — Immutable Evidence and Verification Model

### 7.1 Core Records (Minimum for Slice 2A)

Slice 2A contains only the minimum records required:

| Table | Purpose |
|---|---|
| `payment_evidence` | Immutable normalized synthetic evidence records (Slice 2A). PK = `evidence_id`. Fields: `evidence_id`, `source_kind`, `source_namespace`, `source_event_id`, `amount`, `currency`, `project_id`, `created_at`. No mutable status; no `obligation_ids` (Slice 2A has no allocation relationships). |
| `verification_result` | Immutable verification outcomes. PK = `verification_id`. Fields: `verification_id`, `evidence_id` FK (nullable if no accepted evidence record exists), `outcome` enum `["passed", "failed", "rejected"]`, `verified_at`, `verified_by`, `project_id`, `source_kind`, `source_namespace`, `source_event_id` (for failed verification without evidence). Written in same transaction as `payment_evidence` when evidence is created; failed verification without evidence is recorded separately with nullable FK. |
| `audit_event` | Identifier-only audit events (existing contract). Fields: `type`, `actor`, `project_id`, `timestamp`, `metadata` (allowlist: `evidence_id`, `verification_id`, `obligation_id`, `versionNumber`, `paymentConfigVersionId`, `proposalVersionId`, `agreementVersionId`). No amounts, no currencies, no credentials. |

**No `remaining_balance_after` column** in any table. Balances are derived from authoritative obligation amounts and valid allocations (Issue E).

**No mutable `status` column** on `payment_evidence`. The record is append-only immutable. Position/status is derived from the full history (Issue A).

### 7.5 Synthetic Fixtures and Fake Verifier (Testing Support)

Slice 2A test infrastructure includes:
- `synthetic_evidence_fixture()` — returns a pre-constructed `payment_evidence` record with deterministic fields.
- `fake_verifier(event)` — returns `{ outcome: "passed", verified_at: now, verified_by: founder_person_id }` without any provider integration.
- Test that identical duplicate delivery returns reference to original (no double-counting).
- Test that conflicting content with same source identity is rejected/flagged.
- Test that unknown namespace fails verification.
- Test that malformed amount pattern is rejected.
- Test that exact decimal handling preserves entered text (no floating-point parsing).
- Test that currency mismatch against configuration is rejected before persistence.

All Slice 2A tests use synthetic data only; no live provider, no real payment.

---

## 8. Slice 2A Idempotency, Trusted Source Identity, and SQLite Concurrency

### 8.1 Idempotency and Stable Source Identity

**Slice 2A deduplication key**: `(source_kind, source_namespace, source_event_id)` — globally unique source identity within the trusted source namespace. This is the deduplication key defined in §C and Issue C.

- **Global uniqueness**: The uniqueness constraint is `(source_kind, source_namespace, source_event_id)` with a unique index in the database. The same source event may not be accepted under two different projects.
- **Project association is immutable metadata**: The `project_id` is attached to the first accepted event as immutable metadata. If the same source identity later appears under another project, this constitutes a cross-project conflict and must not be accepted as a second payment event.
- **Duplicate replay of the same source event**: Must be idempotent and must not create another `payment_evidence` record. Identical replays return the original evidence reference. `INSERT OR IGNORE` alone is not sufficient; after a uniqueness conflict, the implementation must select the existing record and compare normalized content. Conflicting normalized content (different `amount` or `currency`) is detected by explicit comparison and flagged as a conflicting evidence reconciliation event, while the earlier accepted record is preserved.
- **Source namespace must be established through trusted server-side configuration or an equivalent trusted source-registration mechanism.** It must not be accepted as arbitrary caller-controlled input. Unknown, unregistered, or invalid source namespaces must fail verification (Issue C.2).
- **Safe handling of concurrent duplicate writes**: On uniqueness constraint violation during concurrent writes, both transactions must safely resolve to returning the existing evidence record. SQLite busy/locked errors require bounded retry (max 3 attempts, exponential backoff) as described in §8.2.

### 8.2 SQLite Concurrency (Issue F)

**Do not claim SQLite provides snapshot isolation.** The actual intended protections are:

- **Database uniqueness constraints** (partial unique index) prevent duplicate `(source_kind, source_namespace, source_event_id)` inserts.
- **Appropriate write transactions**: All evidence + verification_result + audit writes occur in a single SQLite `BEGIN/COMMIT` transaction. Either all three write, or none do (atomic write pattern already used in PR #54 tests).
- **Safe handling of busy/locked conditions**: On `SQLITE_BUSY` or `SQLITE_LOCKED`, the application retries with bounded exponential backoff (max 3 attempts, ~100ms base, ~500ms total). After 3 failed attempts, the write is rejected and an audit event `payment_evidence.write_failure` is appended. No silent drop.
- **Concurrency guarantees required for Slice 2A**: Uniqueness constraint + transactional atomicity + bounded retry. These prevent duplicate evidence records and ensure consistent state.
- **Concurrency guarantees deferred to Slice 2B**: Allocation-specific concurrency (per-obligation remaining balance, per-transaction fund ceiling) is J.14-dependent and deferred.

### 8.3 Append-Only History and Correction History

- **Evidence records are strictly append-only immutable.** After an evidence record is written, it is never modified.
- **Verification outcomes are represented by immutable events or records, not by mutating the original evidence.** A `verification_result` append-only record references the `evidence_id` and carries the outcome; it does not change the evidence record.
- **The current verification/reconciliation position is derived from the authoritative records.** The "current state" is computed by reading the latest `verification_result` for a given `evidence_id` plus the associated `allocation` records. It is not stored as a mutable column on the evidence record.
- **Conflicting duplicate deliveries never silently overwrite or replace previously accepted evidence.** A duplicate delivery with the same `(source_kind, source_namespace, source_event_id)` deduplication key is recognized and returns a reference to the previously accepted evidence record. A delivery with conflicting `amount` or `currency` against the same key is flagged as conflicting evidence (reconciliation event), and the earlier accepted record is preserved.
- **A rejected or failed verification attempt can be represented without falsely making it an accepted payment.** A `verification_result` record with `outcome` = `"failed"` or `"rejected"` is append-only; it records the failure but does not change the evidence record's status. The evidence record itself remains as originally written.
- **Corrections and superseding decisions preserve the prior history.** If a new verification outcome supersedes a prior one, a new `verification_result` append is written; the prior record is not deleted or overwritten. The derived position reflects the full history.

### 8.4 Identifier-Only Audit Privacy

For audit privacy, use an explicit allowlist of permitted metadata keys:

**Permitted keys** (must pass allowlist check):
- `evidence_id`
- `verification_id`
- `obligation_id`
- `versionNumber`
- `paymentConfigVersionId`
- `proposalVersionId`
- `agreementVersionId`

**Rejected keys** (test asserts these are forbidden):
- Any key containing `amount` substring (e.g., `amount`, `total_amount`, `paid_amount`).
- Any key containing `currency` substring (e.g., `currency`, `payment_currency`).
- Any key containing `due` substring (e.g., `due_date`, `payment_due`).
- Any key containing `scope` substring (e.g., `scope_ref`, `milestone_scope`).
- Any key containing `credential` or `secret` substring.

**Test pattern** (for each audit event written):
```javascript
const allowedKeys = new Set([
  "evidence_id", "verification_id", "obligation_id",
  "versionNumber", "paymentConfigVersionId", "proposalVersionId", "agreementVersionId"
]);
for (const key of Object.keys(event.metadata)) {
  assert.ok(allowedKeys.has(key), `unexpected audit metadata key: ${key}`);
  assert.equal(/amount|currency|due|scope/i.test(key), false, `sensitive key ${key}`);
}
const serialized = JSON.stringify(event.metadata);
assert.equal(serialized.includes("600.25"), false);  // proven no amount leaked
assert.equal(serialized.includes("1500.00"), false); // proven no amount leaked
```

**A string search for one sample amount is not adequate proof** — the allowlist test must cover all permitted and forbidden key patterns.

---

## 9. Slice 2B — Allocation Model and Derived Financial Position

### 9.1 Normalized Allocation Records (Built on Slice 2A Foundation)

| Table | Purpose |
|---|---|
| `allocation` | Immutable allocation records. PK = `allocation_id`. Fields: `allocation_id`, `transaction_id` (opaque verified transaction identifier), `obligation_id` FK, `allocated_amount` decimal string, `allocated_currency` 3-letter string, `created_at`. |
| `allocation_request` | Optional stable allocation-request identity for idempotency. PK = `allocation_request_id`. Fields: `allocation_request_id`, `source_evidence_id` FK, `requested_amount`, `requested_currency`, `project_id`, `created_at`, `status` enum `["pending", "accepted", "duplicate_rejected"]`. **This is the idempotency contract for allocations** (Issue E). Not all Slice 2B implementations require this; it depends on the approved policy. |

**Per-transaction fund ceiling**: For each `transaction_id`, the total of all `allocated_amount` where `allocated_currency` matches and `transaction_id` matches must not exceed the verified available funds from the associated evidence. This is enforced by the application logic (not a database trigger) that reads the associated `payment_evidence` + `verification_result` records and checks: `SUM(allocated_amount) ≤ verified_amount`.

### 9.2 Stable Allocation-Request Identity and Idempotency

- **Duplicate replay of the same allocation request**: Must be idempotent and must not create another allocation record. The `allocation_request` table (if used) records `status` = `"duplicate_rejected"` on second submission. If `allocation_request` is not used, the application-level deduplication key is `(transaction_id, obligation_id, allocated_amount, allocated_currency)` — but this is policy-dependent and deferred to J.14 resolution.
- **Two distinct legitimate allocations from one verified transaction**: May be allowed where approved policy permits (e.g., Option B and C allow a single transaction to be split across multiple obligations; Option A also allows it up to each obligation's full amount). The system does not reject legitimate multiple allocations from one transaction, subject to ceilings.
- **Cumulative allocations against one transaction**: Must never exceed that transaction's verified available funds. The application enforces: `SUM(allocation.allocated_amount WHERE allocation.transaction_id = X) ≤ verified_amount_from_evidence_X`.
- **Allocations to an obligation**: Must obey the applicable Founder-approved policy and balance rules (per J.14 option). Option A: allocated ≤ remaining full expected_amount. Option B: allocated ≤ remaining balance (expected - prior allocations). Option C: allocated ≤ min(per-transaction ceiling, per-obligation remaining balance).

**Do not use the incorrect rule that a transaction ID may only ever have one allocation record.** One transaction may legitimately fund multiple obligations, subject to the approved policy and fund ceiling.

**Do not use arrays of allocation IDs as a substitute for normalized relational records.** Allocation is a separate normalized record with `allocation_id`, `transaction_id`, `obligation_id`, `allocated_amount`, `allocated_currency` — not a denormalized array embedded in another record.

### 9.3 Derived Remaining Balance

**`remaining_balance_after` or another mutable balance snapshot is NOT in the authoritative ledger.** Balances are derived from authoritative obligation amounts and valid allocations:

```
remaining_balance(expected_amount, allocated) = expected_amount - SUM(allocated_amount WHERE obligation_id = ... AND allocated_currency = obligation.currency)
```

Any materialized/cached representation of the balance is explicitly marked as **non-authoritative** and must be safely rebuildable from the ledger (payment_evidence + allocation + obligation records). If the cache is lost, it can be reconstructed without data loss or inconsistency.

### 9.4 Concurrency and J.14 Policy Dependencies

**Do not claim SQLite provides snapshot isolation.** The actual intended protections for Slice 2A are:

- **Database uniqueness constraints** (partial unique index) prevent duplicate `(source_kind, source_namespace, source_event_id)` inserts.
- **Appropriate write transactions**: All evidence + verification_result + audit writes occur in a single SQLite `BEGIN/COMMIT` transaction. Either all three write, or none do (atomic write pattern already used in PR #54 tests).
- **Safe handling of busy/locked conditions**: On `SQLITE_BUSY` or `SQLITE_LOCKED`, the application retries with bounded exponential backoff (max 3 attempts, ~100ms base, ~500ms total). After 3 failed attempts, the write is rejected and an audit event `payment_evidence.write_failure` is appended. No silent drop.
- **Concurrency guarantees required for Slice 2A**: Uniqueness constraint + transactional atomicity + bounded retry. These prevent duplicate evidence records and ensure consistent state.
- **Concurrency guarantees deferred to Slice 2B**: Allocation-specific concurrency (per-obligation remaining balance, per-transaction fund ceiling) is J.14-dependent and deferred.
- **J.14 policy dependencies**: The specific allocation rules (partial acceptance, overpayment handling, balance calculation) depend on the chosen J.14 option (A: all-or-nothing; B: partial payments with balance; C: per-transaction ceiling). Until J.14 is resolved, Slice 2B allocation rules remain undefined.

**Explicit exclusion from Slice 2A**: Allocations, payment attempts, manual determinations, partial-payment behavior, and derived obligation states beyond `proposed` are explicitly excluded from Slice 2A and deferred to Slice 2B.

## 10. Payment Attempts and Obligation-State Boundaries

### 9.1 Payment Attempts Outside Slice 2A

- **Payment attempts are outside Slice 2A scope.** J.4 remains unresolved.
- **Do not introduce a retry, dunning, notification, authorization/capture, or settlement subsystem in Slice 2A.**
- **Conceptual separation**: Payment attempts, verified evidence, allocations, and obligation states are four distinct concepts.

| Concept | Description | Slice 2A |
|---|---|---|
| **Payment attempt / transaction** | One provider/reconciliation outcome with timestamps, provider identifiers. | Not implemented. |
| **Verified evidence** | Normalized internal payment event that passed verification. | Yes — `payment_evidence` record. |
| **Allocation** | Link between payment/evidence and obligations with amounts. | Deferred to Slice 2B. |
| **Obligation state** | `proposed`/`due`/`partially_paid`/`paid`/`disputed`/`reversed`. | Only `proposed` (configuration membership) in Slice 2A; others require J.14. |

### 9.2 Why the Distinction Matters

A "successful" payment attempt does **not** guarantee obligation satisfaction. An allocation must exist, must be valid per the approved policy (J.14), and must not exceed per-obligation or per-transaction ceilings. A "failed" attempt does **not** imply obligation failure — such an obligation state does not exist in the design (per §C.4, no `failed` obligation state).

The system tracks all four as separate columns in the model. No assumption flows automatically from one to another.

### 9.3 Obligation States in Slice 2A

| State | Prerequisites in Slice 2A | Requires |
|---|---|---|
| `proposed` | Configuration membership only. | Slice 2A only. |
| `due` | Schedule and due-trigger rules. | J.9 (activation conditions) — not resolved in Slice 2A. |
| `partially_paid` | Partial-payment policy. | J.14 — not resolved; deferred. |
| `paid` | Authoritative evidence + valid allocations under approved policy. | J.3 + J.14 — not resolved; deferred. |
| `disputed` | J.5 decision. | Not implemented in Slice 2A. |
| `reversed` | J.5/J.6 decisions. | Not implemented in Slice 2A. |

**Only `proposed` is the Slice 2A obligation state.** All others are deferred to later slices after the applicable Founder decisions.

### 9.4 Separation of Financial Position from Lifecycle Status

| Calculation | Derived from | Purpose |
|---|---|---|
| **Remaining balance** | `expected_amount - SUM(allocated_amount)` from ledger. | Financial position; allocation ceiling enforcement, overpayment detection. |
| **Obligation state** (`proposed`/`due`/`partially_paid`/`paid`/`disputed`/`reversed`) | Schedule rules + evidence + allocation policy (J.14). | Commercial lifecycle status. |
| **Allocation ceiling** | Per-transaction fund ceiling + per-obligation remaining balance (from ledger calc). | Business rule enforcement; prevents overallocation. |

**Key invariant**: Financial-position calculations are computed from the ledger and are not stored as mutable columns. The derived obligation state is a separate concept computed from different prerequisites (schedule + evidence + policy).

---

## 11. Separate Slice 2A / Slice 2B Data Models and Scope

### 10.1 Slice 2A Model (Synthetic Evidence Ledger Only)

**Tables (minimum)**:
- `payment_evidence` — immutable normalized evidence records.
- `verification_result` — immutable verification outcomes.
- `audit_event` — identifier-only audit events (existing contract).

**Explicitly excluded from Slice 2A**:
- ❌ Allocations (deferred to Slice 2B).
- ❌ Payment attempts/retry subsystem (J.4 unresolved; deferred).
- ❌ Manual Founder/internal paid determinations (J.10; excluded per Issue B).
- ❌ Customer evidence uploads (Issue B; excluded from Slice 2A schema).
- ❌ Partial-payment or overpayment behavior (J.14 unresolved; deferred).
- ❌ Derived obligation states beyond `proposed` (require J.14; deferred).
- ❌ Provider integration (design is provider-neutral).
- ❌ Activation predicate or activation event (J.9 unresolved; deferred).
- ❌ Customer payment UI or customer-facing write capability (hard boundary).
- ❌ Production data or live customer projects (synthetic only).

**Slice 2A is testable entirely with synthetic fixtures.** No live provider required.

### 10.2 Slice 2B Model (Allocation and Derived Financial Position)

**Tables (built on Slice 2A foundation)**:
- `allocation` — immutable allocation records; `transaction_id`, `obligation_id`, `allocated_amount`, `allocated_currency`.
- `allocation_request` — optional stable allocation-request identity for idempotency (Issue E).
- `payment_evidence` — inherited from Slice 2A (unchanged).
- `verification_result` — inherited from Slice 2A (unchanged).
- `audit_event` — inherited from Slice 2A (unchanged).

**Explicitly included in Slice 2B**:
- ✅ Explicit allocation records.
- ✅ Per-transaction funds ceiling.
- ✅ Per-obligation balance calculation (derived from ledger).
- ✅ Concurrency and duplicate-allocation controls.
- ✅ Derived financial position (remaining balance; non-authoritative cache allowed).
- ✅ Integration with J.14 partial-payment policy options.
- ✅ Integration with J.3 evidence model (which evidence records count toward `partially_paid` or `paid`).

**Slice 2B depends on J.14 resolution.** Without J.14, the specific allocation rules (partial acceptance, overpayment handling, balance calculation) are undefined.

---

## 12. Acceptance Tests and Threat Analysis

Tests are split by slice. Slice 2B tests are explicitly deferred and must not appear as Slice 2A acceptance criteria.

### 11.1 Slice 2A Tests (Synthetic, Provider-Neutral)

| Test Category | Test Focus |
|---|---|
| **Valid evidence through fake verifier** | Synthetic valid evidence passes verification contract; `payment_evidence` record written; `verification_result` outcome = `"passed"`. |
| **Invalid/unverified evidence** | Missing fields, invalid decimal pattern, unknown namespace, currency mismatch → `verification_result` outcome = `"rejected"`; no `payment_evidence` record; audit event `payment_evidence.rejected` appended. |
| **Identical duplicate source event** | Same `(source_kind, source_namespace, source_event_id)` delivered twice → second returns reference to first `evidence_id`; no new record; audit event `payment_evidence.duplicate_delivery`. |
| **Same source event identifier with conflicting content** | Same deduplication key but different `amount` or `currency` → earlier accepted record preserved; `verification_result` outcome = `"reconciliation_conflict"`; reconciliation outcome recorded as audit event. |
| **Unknown/untrusted source namespace** | Namespace not in trusted register → verification fails; `verification_result` outcome = `"rejected"`; no evidence record. |
| **Project-ID substitution** | One project cannot read another project's evidence; all reads scoped by `project_id`; IDOR regression test. |
| **Concurrent duplicate ingestion** | Two concurrent deliveries of same source event → uniqueness constraint ensures only one wins; second returns reference to accepted record; no double-counting. |
| **Database uniqueness conflict handling** | `INSERT OR IGNORE` / retry pattern handles `SQLITE_BUSY`/`SQLITE_LOCKED`; max 3 retries with exponential backoff; after 3 failures, write rejected, audit event `payment_evidence.write_failure`. |
| **Atomicity of evidence, verification result, and audit writes** | All three written in one transaction; if any fails, all rolled back; consistent state after failure. |
| **Exact decimal representation and validation** | `1500`, `1500.00`, `120.750` all valid; zero rejected; no floating-point parsing; amount stored as exact text. |
| **Currency consistency** | Obligation currency must match configuration currency (per §J.13); mixed-currency obligations rejected before persistence; comparison is plain string equality on uppercase form. |
| **Append-only history and correction history** | Evidence records cannot be modified after write; prior versions preserved; `evidence_id` of earlier record never changes; `verification_result` history appendable. |
| **Identifier-only audit privacy** | Audit `metadata` allowlist: `evidence_id`, `verification_id`, `obligation_id`, `versionNumber`, `paymentConfigVersionId`, `proposalVersionId`, `agreementVersionId`. String search for one sample amount (e.g., "600.25") in serialized metadata returns false. No amounts, no currencies, no credentials. |
| **Existing regression behavior** | All existing 328 tests pass unchanged; `customerStageFor`; proposal/agreement/organization/project stage derivation unchanged. |

**Policy-dependent tests (deferred)**: Partial-payment acceptance, overpayment handling, manual determination authorization, activation predicate conditions — these require J.14/J.3/J.10 resolution and are not Slice 2A acceptance criteria.

### 11.2 Slice 2B Tests — Explicitly Deferred

| Test Category | Requires |
|---|---|
| **Duplicate allocation-request replay** | J.14 allocation-idempotency policy. |
| **Distinct valid allocations from one transaction across multiple obligations** | J.14 option selected (A allows it; B and C have ceiling rules). |
| **Transaction-level cumulative fund ceiling** | J.14: per-transaction verified available funds ceiling. |
| **Obligation-level ceiling and remaining balance** | J.14: per-option balance rules (A vs. B vs. C differ). |
| **Concurrent allocation attempts** | J.14: depends on chosen option's concurrency controls. |
| **Allocation rollback/atomicity** | J.14: new append-only records; net position from full history. |
| **Partial-payment behavior after J.14 resolution** | J.14: Option A vs. B vs. C differ. |
| **Overpayment and unapplied-fund behavior after J.14 resolution** | J.14: overpolicy specified per option. |

**Slice 2B tests must not be included as Slice 2A acceptance criteria.**

### 11.3 Threat Analysis (Slice 2A)

| Threat | Slice 2A Defense |
|---|---|
| **Duplicate source event delivery** | Deduplication on `(source_kind, source_namespace, source_event_id)`; second delivery returns reference to accepted record; no double-counting. |
| **Same source event identifier with conflicting content** | Conflict flagging: earlier accepted record preserved; reconciliation outcome recorded; no silent overwrite. |
| **Wrong source namespace** | Namespace is part of deduplication key and trusted register check; different namespace = separate event; both may be accepted if verification passes. |
| **Forged or unverified evidence** | Verification gating: evidence only accepted after verification logic passes (namespace trusted, event ID valid, amount/currency match attempt). Rejected evidence produces audit event, no record written. |
| **Project-ID substitution** | All reads and writes scoped by `project_id`; one project cannot read another's evidence, obligations, or allocations. |
| **Duplicate allocation** | Not applicable in Slice 2A (allocations deferred). Uniqueness constraint prevents duplicate evidence records. |
| **Transaction-level over-allocation** | Not applicable in Slice 2A (allocations deferred). |
| **Obligation over-allocation** | Not applicable in Slice 2A (allocations deferred). |
| **Concurrency** | Uniqueness constraint + transactional atomicity + bounded retry (max 3 attempts, exponential backoff). No snapshot isolation claims. |
| **Rollback** | Transactional consistency: evidence + verification_result + audit written in one `BEGIN/COMMIT`; matching existing PR #54 contract. |
| **Exact decimal arithmetic** | Amounts stored as decimal strings; no floating-point parsing; arithmetic via decimal library or string comparison; verified by existing test suite (5 finding tests all pass). |
| **Currency mismatch** | Currency comparison is plain string equality on stored uppercase form; case never decides outcome; no conversion, rounding, or re-scaling. |
| **Append-only history** | Database constraints or application logic enforce never-modify-after-write; audit events verify integrity. |
| **Identifier-only audit privacy** | Audit metadata keys restricted to allowlist; decimal-dot check proves no amounts leaked (e.g., `serialized.includes("600.25")` = false). |
| **No change to proposal, agreement or customer-facing stage behavior** | All 328 existing tests pass unchanged; `customerStageFor` stage derivation unchanged; proposal/agreement behavior unchanged. |

### 11.4 Audit Privacy — Explicit Allowlist

For audit privacy, use an explicit allowlist of permitted metadata keys and tests that reject forbidden fields:

**Permitted keys** (must pass allowlist check):
- `evidence_id`
- `verification_id`
- `obligation_id`
- `versionNumber`
- `paymentConfigVersionId`
- `proposalVersionId`
- `agreementVersionId`

**Rejected keys** (test asserts these are forbidden):
- Any key containing `amount` substring (e.g., `amount`, `total_amount`, `paid_amount`).
- Any key containing `currency` substring (e.g., `currency`, `payment_currency`).
- Any key containing `due` substring (e.g., `due_date`, `payment_due`).
- Any key containing `scope` substring (e.g., `scope_ref`, `milestone_scope`).
- Any key containing `credential` or `secret` substring.

**Test pattern** (for each audit event written):
```javascript
const allowedKeys = new Set([
  "evidence_id", "verification_id", "obligation_id",
  "versionNumber", "paymentConfigVersionId", "proposalVersionId", "agreementVersionId"
]);
for (const key of Object.keys(event.metadata)) {
  assert.ok(allowedKeys.has(key), `unexpected audit metadata key: ${key}`);
  assert.equal(/amount|currency|due|scope/i.test(key), false, `sensitive key ${key}`);
}
const serialized = JSON.stringify(event.metadata);
assert.equal(serialized.includes("600.25"), false);  // proven no amount leaked
assert.equal(serialized.includes("1500.00"), false); // proven no amount leaked
```

**A string search for one sample amount is not adequate proof** — the allowlist test must cover all permitted and forbidden key patterns.

### 11.5 Regression Tests — Distinguish Fresh vs. Historical

- **Historical agent-reported test counts**: The earlier proposal mentioned 328 tests passing. This was agent-reported against a specific implementation base.
- **Freshly verified test results**: As of this revision, the baseline is the canonical decision document `docs/decisions/2026-10-12-payments-project-activation.md` and the verified repository state `main` at `6f74476c29b4dc02c37aa4936a21f844ef3db234`. No test execution has been performed in this sandbox; the 328 count is referenced from the prior work state and should be re-verified against the actual implementation base if needed.
- **Tests not run**: Slice 2A and Slice 2B tests are newly described in this proposal; they have not been executed against any codebase.
- **Any known baseline failure**: None reported in this revision; the prior 328-pass result is from the pre-sandbox state and should be re-verified.

**Do not claim the 328-test result is current unless freshly reproduced against the exact implementation base.** This revision is documentation-only; no code execution or test runs are performed.

---

## 13. Roadmap, Decision Dependencies and Independent Authorization Gates

### 12.1 Slice 2A — Synthetic Evidence-Ledger Foundation

**Authorization gate**: Founder must authorize Slice 2A implementation as a synthetic, provider-neutral design only.

| Item | Status |
|---|---|
| Synthetic evidence-ledger foundation | Not authorized; design proposal only. |
| Provider integration | Excluded. |
| Customer uploads | Excluded. |
| Manual determination | Excluded (J.10 unresolved). |
| Payment attempts/retries | Excluded (J.4 unresolved). |
| Allocations | Excluded (deferred to Slice 2B). |
| Partial-payment/overpayment behavior | Excluded (J.14 unresolved). |
| Activation | Excluded (J.9 unresolved). |
| Customer payment UI | Excluded (hard boundary). |
| Production data | Excluded (synthetic only). |

**If the canonical decision requires J.3 to be resolved before even a synthetic authoritative-event contract can be implemented, Slice 2A must remain a design/test-only proposal until the Founder resolves that dependency.** Do not bypass J.3 by labelling an unresolved policy a framework.

### 12.2 Slice 2B — Allocations and Derived Financial Position

**Authorization gate**: Founder must resolve J.14 (allocation, partial-payment, and overpayment policy) and accept the J.3 evidence framework before Slice 2B implementation can be authorized.

| Item | Status |
|---|---|
| Allocation records | Requires J.14 resolution. |
| Per-transaction fund ceiling | Requires J.14 resolution. |
| Per-obligation balance calculation | Requires J.14 resolution. |
| Derived financial position | Requires J.14 resolution. |
| Concurrency and duplicate-allocation controls | Requires J.14 resolution. |
| Partial-payment behavior | Requires J.14 option selected (A, B, or C). |
| Overpayment handling | Requires J.14 option selected. |
| Activation integration | May require J.9 and J.3. |

**No implementation authorization is implied by the Slice 2A proposal.** Slice 2B is separately authorized.

### 12.3 Later Gates (Not Implied by Earlier Stages)

Each later gate requires its own explicit Founder authorization. No stage automatically authorizes the next.

| Gate | Decision | Dependency |
|---|---|---|
| J.4 attempts/retries | Founder defines retry limits, dunning, notifications. | After Slice 2A; J.4 unresolved. |
| J.5 disputes/reversals/chargebacks | Founder defines handling, escalation, reversal implications. | After Slice 2A; J.5 unresolved. |
| J.6 refunds | Founder defines authority, policy, partial-refund rules. | After Slice 2A; J.6 unresolved. |
| J.8 provider choice | Founder selects provider; integrates SDK/webhooks. | After Slice 2A (evidence model) + J.3. |
| J.9 activation conditions | Founder defines predicate and trigger (automatic vs. manual). | After Slice 2A + J.3 evidence framework. |
| J.10 manual payment-status authority | Founder defines authorized actor(s) for manual determinations. | After Slice 2A; required only if Option D allocation chosen. |
| J.11 evidence retention | Founder defines retention period and protection rules. | After Slice 2A evidence model. |
| J.12 post-activation events | Founder defines events after activation. | After J.9 activation is implemented. |
| Tax requirements | Founder defines jurisdiction, collection, recording. | After live payment processing begins. |

**Each stage requires its own explicit Founder authorization.** No stage automatically authorizes the next.

### 12.4 Roadmap Summary Table

| Stage | Technical Scope | Dependent Founder Decisions | Authorization Status |
|---|---|---|---|
| **1. Slice 2A design approval** | Evidence ledger framework; source identity; idempotency; decimal/currency; project isolation; audit privacy. | J.3 framework accepted (not a resolved Founder decision). | **Not authorized** — design proposal for Founder review. |
| **2. Slice 2A implementation authorization** | Synthetic implementation against `node:sqlite`; test fixtures; regression verification. | Stage 1 authorization + J.3 framework acceptance. | **Not authorized**. |
| **3. J.14 resolution** | Allocation, partial-payment, overpayment policy: Options A, B, C, or D. | Explicit Founder decision. | **Not resolved**. |
| **4. Slice 2B design approval** | Allocation model; per-transaction ceiling; per-obligation balance; derived position; idempotency contract. | J.14 resolved; J.3 framework accepted; J.10 only if Option D. | **Not authorized**. |
| **5. Slice 2B implementation authorization** | Allocation implementation on Slice 2A foundation; full test matrix; security review. | Stages 3 + 4 authorization. | **Not authorized**. |
| **6. Later gates (J.4–J.12, J.14)** | Provider selection, activation, retention, refunds, tax, etc. | Each its own Founder decision; none implied by earlier stages. | **Not authorized**. |

---

## 14. Outstanding Founder Decisions

The following Founder decisions must be resolved before the indicated stages can proceed. This proposal does not resolve any of them on the Founder's behalf.

| Decision | Question | Relevance | Status |
|---|---|---|---|
| **J.3** | Authoritative payment evidence source | Evidence model source-agnostic framework; Founder must choose provider confirmation, verified reconciliation, or authorized manual record (or accept source-agnostic default). | **Unresolved** — framework presented; Founder to decide. |
| **J.10** | Who may make manual payment-status determinations | Scope: if manual determination is later proposed (Option D for J.14), who may authorize it. Recommended: "Founder/internal capability only, least-privileged; never a customer capability." | **Unresolved** — only relevant if J.14 Option D chosen. |
| **J.14** | Allocation, partial-payment, and overpayment policy | Four coherent options (A: all-or-nothing; B: partial payments with balance; C: per-transaction ceiling; D: Founder-directed). Founder must select one. **This is the most critical pending decision for Slice 2B.** | **Unresolved** — four options presented for Founder review. |
| **J.9** | Exact project-activation conditions and trigger | Four-condition candidate predicate; manual-trigger-first plan. Founder must decide whether activation is automatic or manual, and the exact predicate conditions. | **Unresolved** — candidate presented; Founder to decide. |
| **J.4** | Failed payments, retry policy, retry limits, dunning, notifications | Founder defines retries, retry limits, dunning, customer notification. | **Unresolved** — not relevant for Slice 2A (no attempts subsystem). |
| **J.5** | Reversals, chargebacks, and disputes | Founder defines handling, escalation, whether reversal changes "satisfied" meaning. | **Unresolved** — not relevant for Slice 2A (no reversal subsystem). |
| **J.6** | Full and partial refunds — authority, policy, historical treatment | Founder defines authority and policy; this design keeps refund as forward events with amounts. | **Unresolved** — not relevant for Slice 2A; required for J.14 Option selection nuance. |
| **J.8** | Payment-provider selection and activation | Founder selects provider; design stays provider-neutral with opaque references until decision. | **Unresolved** — after Slice 2A; required for provider integration. |
| **J.11** | Retention and treatment of payment evidence | Founder defines retention period; no retention period invented here. | **Unresolved** — after Slice 2A evidence model is accepted. |
| **J.12** | Payment events after activation | Founder defines events after activation. | **Unresolved** — after activation is implemented. |

**Minimum Founder actions to unlock Slice 2A implementation:**
1. Accept the J.3 framework: provider-neutral, verification-gated evidence model with source-agnostic design, synthetic fixtures, fake verifier for testing.
2. (J.10 only needed if J.14 Option D is later chosen.) Define who may make manual payment-status determinations: "Founder/internal capability only, least-privileged; never a customer capability."

**Slice 2A does not require J.14 resolution.** Slice 2B does.

---

## 15. Explicit Exclusions and Final Implementation-Readiness Assessment

### 14.1 Explicit Exclusions from Slice 2A (reiterated)

The following are explicitly excluded from Slice 2A and will remain deferred to later slices or are out of scope:

- ❌ Customer evidence uploads or customer-originated payment submissions.
- ❌ Manual Founder/internal paid determinations (J.10; excluded from Slice 2A schema).
- ❌ Manual payment-status overrides (J.10; excluded from Slice 2A).
- ❌ Payment attempts, retry, dunning, or notification subsystem (J.4; unresolved).
- ❌ Allocation records or derived financial position (deferred to Slice 2B).
- ❌ Partial-payment acceptance or overpayment handling (J.14; unresolved).
- ❌ Derived obligation states beyond `proposed` (require J.14; deferred).
- ❌ Provider integration, webhook receivers, or API credentials.
- ❌ Customer-facing payment write capability (hard boundary; never permitted).
- ❌ Activation predicate or activation event (J.9; unresolved).
- ❌ Production data or live customer projects (synthetic only).
- ❌ Arbitrary five-table maximum or any table count imposed for its own sake.
- ❌ Mutable `status` columns on records described as append-only/immutable.
- ❌ Caller-controlled trust of source namespaces.
- ❌ Duplicate-allocation rule that rejects legitimate multiple allocations from one transaction.
- ❌ Snapshot-isolation claims for SQLite.
- ❌ Claims that synthetic fixtures prove a real payment occurred.
- ❌ Unresolved J.3/J.14 policies treated as Founder-approved.
- ❌ Inaccurate PR #54, rollback, `main`, or candidate-branch history.
- ❌ Contradiction between implementation approval status and Project Map wording.
- ❌ Claim that Slice 2A or Slice 2B is authorized for implementation.
- ❌ Source code, tests, migration, governance document, branch, commit, PR, or deployment changes.

### 14.2 Final Implementation-Readiness Verdict

| Slice | Implementation-Readiness | Reason |
|---|---|---|
| **Slice 2A** | **Design-proposal only — not authorized for implementation.** | Provides a decision-ready technical framework for a provider-neutral, verification-gated, append-only evidence ledger. Synthetic fixtures and fake verifier support testing without a live provider. No code changes, no repo modifications, no provider integration. Founder must accept the J.3 framework before implementation authorization can be considered. J.10 is only relevant if J.14 Option D is later chosen. All explicit exclusions are documented. |
| **Slice 2B** | **Design-proposal only — not authorized for implementation.** | Builds on Slice 2A foundation; requires J.14 resolution (allocation, partial-payment, overpayment policy) before implementation can be considered. Also depends on J.3 framework acceptance and J.10 only if Option D chosen. No code changes, no repo modifications, no provider integration. |

**Neither slice has received implementation authorization.** This proposal is documentation-only, presented for Founder review and decision. No repository or external-system state was modified in producing this deliverable.

---

## 16. Change Log — How Each Material Issue Was Corrected

| Issue | Original Flaw | Correction Applied |
|---|---|---|
| **A — Append-only behavior** | Evidence records included mutable statuses (`pending`, `accepted`, `conflicting`, `rejected`) contradicting the "immutable" designation. | Evidence records are strictly append-only immutable. Verification outcomes are represented by immutable `verification_result` append events that reference (but do not mutate) the evidence record. Derived position is computed from the full history, not stored as a mutable column. Conflicting duplicates are flagged, not silently overwritten. Failed verification is a separate `verification_result` record, not a mutation of evidence status. Prior history is preserved when corrections supersede earlier outcomes. |
| **B — Out-of-scope source kinds** | `customer_upload` and `manual_determination` were included in the Slice 2A source-kind model. | `customer_upload` and `manual_determination` are explicitly outside Slice 2A scope. Only `provider_webhook` and `provider_api_reconciliation` are implemented in Slice 2A. These are discussed as future possibilities but are explicitly excluded from the Slice 2A schema and implementation scope. J.10 is relevant if manual determination is later proposed; it is not resolved and no authorization mechanism is built before Founder resolution. |
| **C — Source identity and idempotency** | `evidence_id + source_kind` was the deduplication key; source namespace was caller-controlled; uniqueness boundary was unresolved; SQLite snapshot isolation was claimed. | Deduplication key is now `(source_kind, source_namespace, source_event_id)` — stable source identity using the provider's own event ID. Source namespace must be established through trusted server-side configuration; unknown/invalid namespaces fail verification. Uniqueness boundary is `(source_kind, source_namespace, source_event_id)` with a partial unique index in the database. Four duplicate/conflict scenarios are defined: identical duplicate, conflicting content, unknown namespace, malformed/unverified event. Database-enforced uniqueness + transaction-level safeguards; SQLite busy/locked handled by bounded retry (max 3 attempts, exponential backoff), not snapshot isolation. |
| **D — J.14 rewrite** | Prior options A–D were not internally consistent; overpayment policy was ambiguous; partial-payment behavior was undefined; manual determination was conflated with allocation policy. | Four coherent policy alternatives rewritten: Option A (all-or-nothing with running balance), Option B (partial payments with remaining balance), Option C (per-transaction ceiling with overpayment absorption), Option D (Founder-directed, requires J.10 + J.3). Each option clearly defines partial-payment acceptance, multi-obligation allocation, multiple-transactions-to-one-obligation, outstanding balances, overpayments, duplicate allocation, and allocation correction/reversal. No option is recommended as default. Slice 2B behaviors that depend on J.14 are explicitly identified. |
| **E — Allocation model and duplicate-allocation tests** | Incorrect rule that a transaction ID may only ever have one allocation record; arrays of allocation IDs used as substitute for normalized records; duplicate-allocation tests conflated legitimate multiple allocations with replays. | Distinct allocation-record types: duplicate replay of same request (idempotent, no second allocation), two distinct legitimate allocations from one transaction (policy-permitted), cumulative allocations per transaction (never exceed verified funds), allocations to obligation (per J.14 policy). Stable allocation-request identity or equivalent idempotency contract. No arrays of allocation IDs; fully normalized relational records. Slice 2A excludes allocations entirely (deferred to Slice 2B). |
| **F — Payment attempts, states, and SQLite concurrency** | Payment attempts/retry/subsystem introduced in Slice 2A; `failed` obligation state invented; SQLite snapshot isolation claimed; obligation states conflated with payment-attempt outcomes. | Payment attempts explicitly outside Slice 2A scope (J.4 unresolved). No `failed` obligation state (design explicit: `failed` is a payment-attempt outcome only, not an obligation state). Obligation states separated from financial-position calculations: `proposed` (Slice 2A only), others require J.14/J.9. SQLite concurrency: uniqueness constraints + transactional atomicity + bounded retry (no snapshot isolation claims). Which concurrency guarantees are required for Slice 2A and which are deferred to Slice 2B are explained. |

---

## Final Statement

**No repository or external-system state was modified** in the production of this proposal. The deliverable is complete proposal text only, presented above. All 11 required sections are included, all six material issues are addressed, and all authority boundaries are respected. The proposal is ready for Founder review and decision.

**Stop**: No further tool calls, no implementation, no repo modifications, no deployment. This is the final deliverable.