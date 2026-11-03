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
| `verified_at` | number (epoch ms) | Timestamp when verification passed. |
| `verified_by` | person ID | System process or Founder-authorized actor. |
| `status` | — **see Issue A** | See Issue A correction below. |
| `project_id` | string | Project reference; all reads/writes scoped by project. |
| `obligation_ids` | UUID[] | Referenced obligations; normalized relational model (Issue E). |

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
2. **Verification attempt/result** — append-only `verification_result` record: `verification_id` PK, `evidence_id` FK, `outcome` enum `["passed", "failed", "rejected"]`, `verified_at`, `verified_by`, `project_id`. Written in same transaction as evidence record.
3. **Accepted normalized internal event** — the evidence record itself (`evidence_id`, `source_kind`, `source_namespace`, `source_event_id`, `amount`, `currency`, `project_id`, `obligation_ids`). This is the authoritative ledger entry. It is never mutated.

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
| **Partial payment acceptance** | No — obligation satisfied only when full expected amount allocated. Partial allocations are rejected; obligation remains in `due` state. |
| **One transaction allocated across multiple obligations** | Yes — a single transaction may be split across multiple obligations, up to each obligation's full expected amount. |
| **Multiple transactions allocated to one obligation** | Yes — successive allocations accumulate toward the full expected amount; remaining balance tracked. |
| **Outstanding balances** | Calculated as `expected_amount - SUM(allocated_amount)` from ledger; not stored as mutable column. |
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

#### Option D: Founder-Directed Allocation (requires J.10 + J.3 manual determination)

| Behavior | Description |
|---|---|
| **Partial payment acceptance** | Yes — Founder manually allocates evidence across obligations. |
| **One transaction allocated across multiple obligations** | Yes — Founder decides distribution per allocation. |
| **Multiple transactions allocated to one obligation** | Yes — Founder directive. |
| **Outstanding balances** | Founder-determined; may be tracked or not per policy. |
| **Overpayments** | Founder directive: roll, refund, absorb, or other explicitly approved treatment. |
| **Duplicate allocation** | Founder-authorized re-allocation only; system rejects unauthorized re-allocation. |
| **Allocation correction/reversal** | Founder-directed correction via new append-only records. |

**Note**: Option D requires J.10 (who may make manual determinations) and J.3 (evidence source authority) to be resolved first. It is not available for Slice 2A (which has no manual determination). It is a later-slice option.

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
| `payment_evidence` | Immutable normalized synthetic evidence records. PK = `evidence_id`. Fields: `evidence_id`, `source_kind`, `source_namespace`, `source_event_id`, `amount`, `currency`, `verified_at`, `verified_by`, `project_id`, `obligation_ids`, `created_at`. |
| `verification_result` | Immutable verification outcomes. PK = `verification_id`. Fields: `verification_id`, `evidence_id` FK, `outcome` enum `["passed", "failed", "rejected"]`, `verified_at`, `verified_by`, `project_id`. Written in same transaction as `payment_evidence`. |
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

**Slice 2A deduplication key**: `(source_kind, source_namespace, source_event_id)` — stable source identity using the provider's own event ID combined with the trusted namespace. This is the deduplication key defined in §C and Issue C.

- **Duplicate replay of the same source event**: Must be idempotent and must not create another `payment_evidence` record. The database uniqueness constraint `(source_kind, source_namespace, source_event_id, project_id)` with `INSERT OR IGNORE` ensures this. A second delivery returns a reference to the previously accepted `evidence_id`; no new record is written; no double-counting.
- **Source namespace must be established through trusted server-side configuration or an equivalent trusted source-registration mechanism.** It must not be accepted as arbitrary caller-controlled input. Unknown, unregistered, or invalid source namespaces must fail verification (Issue C.2).
- **Uniqueness boundary**: `(source_kind, source_namespace, source_event_id, project_id)` w