# Payments Project Activation — Design Draft

**Status:** Draft — design draft under review  
**Date:** 2026-10-12  
**Founder approval:** not yet recorded  

**Scope:** Smallest durable payments-project-activation model and workflow — payment-to-activation binding, obligation tracking, concurrency controls, audit-events design, and the boundary to project activation — with no provider selected and no legal-validity claim. This design is **provider-neutral**, keeps every unresolved business and legal question as **Founder decision required**, and marks no assumed answers.

**Related:** Customer Platform Direction, Customer Platform Requirements, Customer Platform Foundation, Proposal Foundation, Customer Proposal Review, Customer Proposal Response, Agreement and E-Signature (2026-10-07)

> **Status note.** This is a **design draft**. It authorizes no implementation by itself, creates, deploys, and activates nothing. The Founder has resolved Q1–Q3 of the agreement design; implementation of payments activation remains a separate later task and is subject to the verification contract and remaining production/provider gates recorded here. It defines the smallest durable payments model the platform needs, preserves the accepted separation between payment acceptance and project activation, and marks every unresolved business, legal, and provider question as **Founder decision required** rather than assuming an answer. Nothing described here is implemented, deployed, activated, or legally certified, and no live customer data is processed.

## 1. Status

**Status: Draft — design draft under review.**

This document is the design draft for the Payments Project Activation slice. It authorizes no implementation by itself, creates, deploys, and activates nothing. The Founder has now resolved Q1, Q2, and Q3 of the agreement design; implementation remains a separate later task and is subject to the verification contract and remaining production/provider gates recorded here. Three facts must be kept separate, and none implies the next:

- **The design is draft.** It is under review; implementation remains a separate later task and must follow the verification contract and remaining production/provider gates.
- **Nothing is implemented.** No payment model, table, route, endpoint, service, or UI exists, and this design does not create one. A proposed or even accepted design is not a capability.
- **Nothing is legally decided.** Legal validity, jurisdiction-specific requirements, provider selection, and document-retention policy are explicitly **not** decided here. Each is a separate later decision, and each must be resolved before production activation.

The unresolved business and legal questions are listed openly in section 21. This design deliberately does **not** invent answers to make itself look complete.

## 2. Context

Four accepted decisions and one approved requirements document establish the ground this design stands on.

**Customer Platform Direction** (`docs/decisions/2026-10-04-customer-platform-direction.md`, Approved 2026-10-04) defines the long-term customer-facing application and the organization-centric model — person → organization → projects — with project-specific customer access and an internal Founder workspace.

**Proposal Foundation** (`docs/decisions/2026-10-05-proposal-foundation.md`, Accepted 2026-10-05) gives the platform one proposal per project, immutable numbered versions, exactly two version statuses (`draft`, `published`), Founder-only authoring, and an explicit, audited publication act. It lists agreement/e-signature as a non-goal that requires a later, separate decision.

**Customer Proposal Review** (`docs/decisions/2026-10-06-customer-proposal-review.md`, Accepted 2026-10-06; implemented and merged as PR #43) lets an authorized customer read the current published proposal version. Its non-goals list agreement/e-signature as a separate later decision.

**Customer Proposal Response** (`docs/decisions/2026-10-06-customer-proposal-response.md`, Accepted and implemented 2026-10-06; implemented and merged as PR #45) adds the two version-bound customer actions — Request Changes and Accept Proposal — with an append-only `proposal_responses` table and identifier-only audit events. Section 9 of that decision is explicit that acceptance is **application-level evidence only**, is **not a legal signature**, creates no agreement, and makes no claim of legal validity, and that agreement/e-signature remains a separate future capability with its own undecided requirements.

**The approved requirements** (`docs/website/customer-platform-requirements.md`) describe the workflow this design belongs to and the baseline commercial gate:

> **Proposal accepted → Agreement completed → Required payment conditions satisfied → Project activated** (§15)

and require, for agreement (§13):

> - identifiable agreement version;
> - signatory identity;
> - organization/project association;
> - timestamp;
> - signed state;
> - immutable or tamper-evident historical record;
> - secure retention.

Section 13 states that legal validity, provider selection, document retention, and jurisdiction-specific requirements require separate decisions before production activation. Section 24 requires agreement/signature state to appear in audit history. Section 27 requires least-privilege authorization, project-specific access, secure storage, and explicit retention/deletion rules before production use. Section 28 lists provider-specific e-signature implementation among deferred capabilities.

This document is the separate decision §13 calls for — a **design** decision, not a provider decision, not a legal decision, and not an implementation.

It defines the payments boundary inside the commercial gate: from accepted proposal through activation, without implementing payment providers, without deciding payment policy, and without claiming legal validity.

## 3. Problem

After a customer accepts a proposal and a payment is received, the platform must record the binding from payment to obligation(s) and determine when project activation is permitted. Without a clear design, two real risks emerge:

1. **Double-counting or lost track of funds.** If concurrency controls are absent, the same funds may be counted more than once across allocations, or allocations may be replayed, leading to incorrect obligation balances and erroneous activation.

2. **Activation without proper evidence.** If the boundary from payment to activation is ambiguous, the platform may activate a project based on incomplete or unverified payment evidence, or may fail to activate when payment conditions are genuinely satisfied.

This design defines the minimal model needed to bind a verified transaction to its allocated obligations, track remaining balances, and gates project activation on the completion of those obligations — while keeping every policy decision (pricing, refunds, fees, partial-payment rules) explicitly unresolved and visible as Founder decisions.

## 4. Goals

- Define the **payment-to-activation binding**: how a verified transaction from a payment source binds to one or more obligations, and under what conditions project activation may occur.
- Define **obligation tracking**: each obligation's expected amount, remaining outstanding balance, and how allocations from transactions reduce that balance.
- Define **concurrency controls** that prevent replay or duplicate processing of the same payment event/allocation, prevent funds from being counted more than once, and permit multiple legitimate allocations and partial payments where the approved policy allows them.
- Define **audit-events** for material payment actions, following the established identifier-only, append-only, transactionally consistent principles.
- Separate **application retention**, **security**, **legal retention**, and **jurisdiction-specific** concerns, and identify the decisions still required.
- Keep the architecture **provider-neutral** and keep **provider selection** a later decision.
- State the **legal boundary** plainly: application-level payment evidence is not a determination of legal validity.
- Define the **downstream boundary** to project activation without implementing activation.
- Keep **customer-facing project stages** (`customerStageFor`) unchanged.
- Keep the design **provider-neutral** and **policy-unresolved**: no pricing, no refund rules, no fee rules, no partial-payment policy, no legal claims.

## 5. Non-goals

Not in this design, not authorized by it, and each requiring its own approved decision before implementation:

- payment-provider selection or integration;
- automatic project activation;
- pricing, fee, or tax rules;
- refund or chargeback policy or execution;
- legal certification, legal advice, or any assertion of legal validity, enforceability, or admissibility;
- jurisdiction-specific legal-compliance implementation;
- a document-management system (storage, folders, versioning of arbitrary files);
- customer messaging or chat;
- notifications and email-provider activation;
- production deployment;
- live customer data;
- AI/LLM drafting, review, or qualification;
- unrelated project-workflow changes;
- any change to the customer-facing project stage or to `customerStageFor`;
- inventing numeric values or business rules for overpayments, fees, discounts, or partial payments.

## 6. Existing invariants

This design must preserve, and must be read together with, the invariants the platform already relies on, adapted for the payments slice:

- **I1.** Payment versions are immutable and append-only; changing what a payment record says means writing the next version.
- **I2.** At most one allocation exists per `transaction_id` + `obligation_id` pair, enforced by the database.
- **I3.** Customer authorization is the existing project-access model: organization Owner/Admin organization-wide, ordinary members only for explicitly assigned projects, and the `founder` internal capability is never a customer path.
- **I4.** A service never trusts a caller-supplied project id as proof of access; authorization runs inside the service on every call.
- **I5.** Reading performed by a customer is non-mutating and creates no audit event.
- **I6.** Audit metadata carries identifiers, never sensitive content, and is written in the same transaction as the material state it records.
- **I7.** No customer-facing project stage changes as a side effect of a commercial record; `customerStageFor` is untouched by this slice (per the no-automatic-deactivation boundary).
- **I8.** The public repository contains no passwords, keys, session data, confidential customer information, or sensitive payment information.
- **I9.** `audit_events` remains identifier-only and excludes amounts, currency, provider payloads, credentials and sensitive financial content.
- **I10.** `Failed` is a payment-attempt outcome only, not an obligation state.
- **I11.** There is one authoritative source for derived payment/obligation state, with source evidence traceability, deduplication and conflict reconciliation.
- **I12.** Amount/currency and partial-refund representation remain explicit, with policy decisions unresolved.

## 7. Domain model

The model is deliberately parallel to, and separate from, the agreement model. It adds a payment identity, its immutable versions, its allocation records, and its append-only audit events. It introduces no new identity system.

### 7.1 Payment identity

A **payment** is the stable identity of a received transaction for one project. It is organizational and long-lived; its content lives in its versions.

- Exactly one payment per project, mirroring the one-proposal-per-project rule from Proposal Foundation.
- A payment belongs to exactly one organization and exactly one project, and must never be retrievable through another project's reference.
- A payment is created by the Founder/internal authority upon receipt of a verified transaction; it is never created by a customer.
- A payment references the **exact accepted proposal version** it is based on. It may not be based on a draft, an unpublished version, or a merely published but unaccepted version. An accepted version is the commercial baseline.

### 7.2 Payment version identity

A **payment version** is one immutable expression of a transaction at a point in time.

- Versions are numbered oldest-first, 1-based, unique within the payment, and never renumbered.
- A version carries an explicit status (`draft`, `published`, `verified`, `reversed`).
- A `verified` version is immutable and terminal for the purposes of this design.

### 7.3 Relationship to an accepted proposal

**A payment version references an exact, immutable proposal version as its baseline.** It never copies that content in a way that could drift, and it never mutates the proposal.

- A payment version stores the baseline as identifiers only: the `proposal_id`, the `proposal_version_id`, and the version number of the accepted version it is based on.
- The proposal and its versions are **never** modified by this slice. There is no update or delete path to a proposal or a proposal version here.
- Because proposal versions are immutable (I1), an exact `proposal_version_id` reference is a stable historical pointer: a later proposal version can never silently rewrite what a historical payment was based on.

### 7.4 What the model deliberately does not store

Following the existing evidence principle, the payment model stores **no**:

- customer-facing project stage or lifecycle field;
- payment amount, schedule, status, or provider reference as assumed policy;
- signature image, handwriting, biometric, or identity-document data;
- provider-specific envelope, certificate, or audit-trail payloads;
- proposal or agreement content duplicated into audit metadata;
- any "legal validity" flag or claim;
- complete raw provider payloads (clarification 2);
- amounts or currency beyond the verified transaction amount (clarification 4).

### 7.5 Obligation identity

An **obligation** is the stable identity of a payable amount owed by a project to another party. It is organizational and long-lived; its content lives in its versioned state.

- Exactly one obligation per project initially; additional obligations may exist per project depending on the business case.
- An obligation belongs to exactly one organization and exactly one project, and must never be retrievable through another project's reference.
- An obligation is created by the Founder/internal authority; it is never created by a customer.
- An obligation carries an **expected amount** (the total originally agreed) and a **remaining outstanding balance**, both explicitly represented in currency.

### 7.6 What the model deliberately does not store

- partial-refund policy or executed refund amounts as stored policy;
- provider-specific payloads beyond verified evidence fields (clarification 2);
- any assumption that one payment maps to one obligation only (clarification 3).

## 8. Lifecycle and state model

The state model is deliberately small. It has one status field on the payment version and derives everything else.

### 8.1 Payment version states

A payment version has exactly one status:

| Status | Meaning |
| --- | --- |
| `draft` | Created by the Founder/internal authority; not visible to any customer; not signable. |
| `published` | Made visible to authorized customers for the project; eligible to be the current verified version. A version stops being the current signable version once a later `published` version exists. |
| `verified` | The Founder-approved condition has been satisfied: the transaction has been verified against its evidence. A `verified` version is never `published` again, is never a current signable version, and is terminal and immutable. |
| `reversed` | A reversal or refund linked to the original transaction has been recorded. A `reversed` version is terminal and immutable. |

A version has **exactly one** status at a time. A version that has been `reversed` has status `reversed`; it is **never** simultaneously `verified` and `reversed`, and it never returns to `draft` or `published`. The three states are mutually exclusive.

There is deliberately **no** stored `pending`, `awaiting_verification`, `expired`, `declined`, or `cancelled` state. Both staleness and reversal are **derived** concepts, not stored: a `verified` version whose baseline is no longer the current accepted proposal version is **stale**, and any version — `verified` or `reversed` — stops being the current payment version once its accepted proposal baseline is no longer the project's current accepted version.

### 8.2 Current payment version, current signable version, and signed history (derived)

Three distinct concepts are derived from the immutable version and signature rows. None of them is stored, and none of them changes the status of a version.

- **Current payment version.** The highest-numbered payment version that is **applicable to a customer** and based on the project's current commercial baseline — that is, the highest-numbered version whose status is `published` or `verified` **and** whose accepted proposal baseline matches the project's currently accepted proposal version. A `draft` is an internal, unpublished working version; it is not the current payment version until it is published. A `published` or `verified` version whose baseline is no longer the current accepted proposal version is **stale**: it remains signed history or an unpublished-candidate version as the case may be, but it is **not** the current payment version. The current payment version is therefore either `published` (awaiting verification) or `verified` (completed for that version), and there is no current payment version until a version based on the current accepted proposal version is published. This keeps **signed history** and the **current commercial payment** distinct: a stale verified version is not the current payment version, though it is never edited or deleted.
- **Current signable version.** The highest-numbered `published` payment version whose accepted proposal baseline matches the project's **currently accepted proposal version** (§7.3). It must also satisfy the existing signability rules: a `draft` is never signable, a `verified` version is never signable again, and a version whose baseline has changed is **stale** and never signable. When the current payment version is `published`, the current signable version is that same version and the payment is awaiting verification. When the current payment version is `verified`, or there is no current payment version (no version is based on the current accepted proposal version), there is no current signable version: nothing can be verified until a new payment version based on the current accepted proposal version is published and verified.
- **Signed history.** Every `verified` version remains `verified` forever, whether or not later versions exist and whether or not its baseline is still current, and remains readable and auditable. A stale verified version is still verified history: it must never be edited or deleted, and verification of one version never changes the status or content of any other version.

Consequences of the three states, stated explicitly:

- Because a version has exactly one status at a time, no version is ever simultaneously `published` and `verified`. "The current published version is verified" is therefore not a valid description in this model; the accurate statement is "the current payment version is `verified`".
- When the current payment version is `verified`, the payment has completed verification **for that version**.
- When a later `published` version exists, that later version becomes the current signable version and requires its own verification. The earlier version is either already `verified` (terminal, part of verified history) or unsigned and simply no longer the current signable version. There is no stored `reversed` state: "reversed" is only the derived fact that a version is no longer the highest-numbered `verified` version.
- A version can stop being the current signable version for **two distinct derived reasons**, and the design keeps them separate:
  - **stale** — the project's accepted proposal version has changed, so the version's `proposal_version_id` is no longer the current accepted baseline.
  - **reversed** — a reversal or refund has been linked to the original transaction.
  Both are **derived, not stored**; both leave the version's status and content untouched; and neither ever edits or re-derives historical verified evidence.
- A newer accepted proposal version can make the current payment version stale. If the project's accepted proposal version changes, any payment version bound to the older accepted version — including a `verified` one — ceases to be the current payment version, so there is no current payment version until a new version based on the current accepted proposal version is published and verified. The stale verified version remains verified history and immutable; nothing about it is mutated, deactivated, or rolled back.
- An earlier `verified` version never changes state.
- A newer `draft` does not pretend to be signable, does not change the current signable version, and does not modify historical verified evidence.
- Standing is always derived from the immutable version and signature rows, never from a mutable per-project payment field.

### 8.3 Immutability

- A `verified` version is immutable: there is no update or delete path for it, its `verified` status never changes, and it never returns to `draft` or `published`.
- A written record row is append-only: the store exposes no update and no delete method for it.
- A later commercial change that alters the payment's meaning requires a **new payment version**, never an edit of an existing one. This mirrors the proposal rule that changing what a document says means writing the next version.

### 8.4 Version numbering

Version numbers are deterministic, oldest-first, and allocated by the store inside the writing transaction, exactly as proposal versions are. A version number is never reused and never renumbered after the fact.

## 9. Concurrency and partial payments

Section I currently uses "one-satisfaction guard under concurrency." This section clarifies the concurrency controls that must hold:

### 9.1 Replay and duplicate prevention

Concurrency controls must:

- **prevent replay or duplicate processing of the same payment event/allocation**: each payment event must be uniquely identifiable (e.g., by provider transaction ID, provider reference, or idempotency key) and the system must detect and reject duplicate submissions. A replayed operation must return the previously recorded result rather than creating a second allocation.
- **prevent the same funds from being counted more than once**: the total of all allocations across all obligations must not exceed the verified transaction amount, and must not double-count any portion of the transaction. The system must track which portions of the transaction have been allocated and ensure that re-allocation of already-allocated funds is rejected.

### 9.2 Permit multiple legitimate allocations and partial payments

- **permit multiple legitimate allocations and partial payments against an outstanding obligation where the approved policy allows them**: a single obligation may receive allocations from multiple transactions, and a single transaction may be allocated across multiple obligations, up to the verified amount of each transaction and the remaining balance of each obligation. Partial payments that fall short of the full expected amount are permitted where the approved policy allows, and the remaining balance is carried forward.
- **prevent duplicate project-activation records independently of payment allocation controls**: project activation must be gated on a derived "obligations-satisfied" signal that is computed from the immutable rows, never stored as a mutable project field. The signal becomes true only when the sum of all allocations across all obligations for a given project meets the approved policy threshold — but **this policy decision is unresolved** and must be a Founder decision. The signal must not be computable from a single allocation alone, nor from stored project state that could be out of sync with the append-only rows.

### 9.3 Prevent duplicate project-activation records

- Project activation must be prevented from being recorded more than once independently of payment allocation controls. The "obligations-satisfied" signal is derived from the immutable payment/obligation rows; it must not be stored as a project field that could be set or reset without an append-only write. If the signal becomes false (e.g., because a reversal or new allocation changes the balance), the project must not be automatically deactivated, suspended, or rolled back — any such behavior requires a **separate Founder-approved activation/commercial decision**. The signal is a read-only commercial gate/condition, never a command.

## 10. Transaction and allocation amounts

Clarify the distinction between:

- **the verified transaction amount reported by the payment/reconciliation source**: the amount that the payment provider has confirmed, recorded as the verified transaction amount on the payment version. This is the source of truth for all allocations.
- **amounts allocated from that transaction to individual obligations**: each allocation records how much of the verified transaction is being applied to a specific obligation. Allocation amounts must be explicitly represented and must not exceed the verified transaction amount or the remaining balance of the obligation being allocated against.
- **each obligation's expected amount and remaining outstanding balance**: each obligation carries an expected amount (the total originally agreed) and a remaining outstanding balance, both explicitly represented in currency. The remaining balance is computed as `expected_amount - sum(allocation amounts to this obligation)`. This computation is derived from the immutable rows, never stored as a mutable field that could go out of sync.
- **refunds or reversals linked to the original transaction/allocation**: a reversal or refund is a separately recorded event linked to the original transaction. It reduces the available verified amount for future allocations. The linked reversal is identified by a reference to the original transaction/allocation, and its effect is derived from the rows — it is not assumed or implicitly subtracted without an explicit record.

**Allocation totals must not silently double-count or exceed the available transaction funds after relevant adjustments.** The sum of all allocation amounts across all obligations for a given transaction must be ≤ the verified transaction amount, adjusted for any linked reversals/refunds. This constraint is enforced by the service on every allocation write, in the same transaction that takes the write lock before its first read.

**Currency conversion, fees, overpayments, partial-payment policy and refund consequences are unresolved where they require Founder decisions.** Do not invent numeric values or business rules.

## 11. Evidence, immutability, and tamper-evidence boundary

The minimum evidence for a verified payment is the append-only payment version row defined in section 7, written in the same transaction as the version's transition to `verified`.

Application-level guarantees this design requires:

- **append-only**: no update and no delete path for a payment version row;
- **identifier-only audit metadata** (corollary of I9): metadata carries identifiers and state only — organization, project, payment version, proposal version reference, the acting person, and the action or new status. It **never** contains agreement text, proposal content, a signature image, or any identity-verification artifact;
- **transactional**: the payment version write, its audit event, and the `verified` transition are one atomic write, so neither layer exists without the other;
- **non-mutating reads**: viewing a payment or a signature writes nothing and creates no audit event;
- **no silent rewrite**: a verified historical record is never overwritten, re-pointed to a different proposal version, or re-derived from mutable state;
- **idempotent replay**: a replayed operation returns the previously recorded result rather than being rejected, because the service resolves the idempotency key *before* any terminal-state rejection. The unique index is the last-resort guard against a second row, **not** the retry mechanism.

**What this is not.** Append-only storage, a transaction, and a stored timestamp are *application* integrity measures. They do **not**, by themselves, create legal validity, enforceability, admissibility, non-repudiation, or a qualified electronic signature. Cryptographic tamper-evidence, trusted timestamping, long-term validation, and qualified signature requirements are **provider and legal decisions** (to be resolved at later gates Q5–Q8) and are deliberately not chosen here.

## 12. Repeat verification and superseding payments

This section defines what must happen over time. It must never silently overwrite prior verified history.

- **A customer/processor verifies.** The verification is recorded against the exact current signable version (§8.2). Under the design, one verified version completes that version and changes its status to `verified`.
- **A replayed submission.** The idempotency key is resolved **before** any state check. A retry of an already-successful verification operation returns the recorded result — one row, one audit event, the same deterministic outcome — even though the version is now `verified`. A *fresh* submission (a new key) against an already-`verified` version is rejected and writes nothing. Replay never creates a second verification row.
- **A payment version stops being the current signable version.** A later `published` version becomes the current signable version (derived, §8.2), and the earlier version is either already `verified` (terminal, part of verified history) or unsigned and no longer the current signable version. Nothing is deleted or edited, and no stored state changes.
- **The accepted proposal baseline changes after a payment version is published.** If a newer proposal version is accepted, any payment version still bound to the older accepted proposal version becomes **stale** and stops being signable (§7.3, §8.2). A verification attempt against it is rejected and writes nothing — there is no silent rebinding to the new proposal version — and the stale version remains immutable historical data. If the stale version was already `verified`, it remains verified history but is no longer the current payment version, so "payment verified" is false until a new version based on the current accepted proposal version is published and verified. The Founder publishes that new payment version, which becomes the current signable version.
- **A new payment version is created.** It is a new numbered, immutable version. All earlier versions and signatures remain readable and auditable, unchanged.
- **A commercial change occurs after verification.** The change requires a **new payment version** based on the current accepted proposal version. The verified earlier version is never edited; history shows exactly what was verified, when, and by whom.
- **The accepted proposal baseline changes.** A new payment version binds to the newly accepted proposal version. Prior payment versions remain bound to the exact proposal versions they referenced, so later proposal changes cannot silently rewrite historical payment evidence.

The platform's **current payment standing** is derived from the immutable rows, never stored. It is computed over the **current payment version** (§8.2 — the highest-numbered `published` or `verified` version whose accepted proposal baseline matches the project's current accepted proposal version):

- if the current payment version is `verified`, the payment has completed verification **for that version**;
- if the current payment version is `published`, that version is the current signable version and the payment is awaiting verification;
- if there is no current payment version — because no version has been published, or because every `published`/`verified` version is bound to an older accepted proposal baseline — the payment is not verified and nothing is signable; a new version based on the current accepted proposal version is required, and any stale version is never rebound or mutated.

A `verified` version is never described as "published and verified": its status is `verified`, and it remains verified history. What "the current payment" means for downstream activation is defined in section 18 and is **derived**, never a stored project field.

## 13. Customer authorization and project isolation

- Authorization for viewing and verifying is the existing project-access model (I3), evaluated inside the service on every call (I4).
- A customer can never view or verify a payment belonging to a project they cannot access. A caller-supplied project or payment id is never proof of access — the Customer Proposal Review and Response IDOR lessons are restated for this slice.
- An organization Owner/Admin sees the payment for a project in their own organization; a customer from another organization cannot reach it, and the result is indistinguishable from a project that does not exist.
- Ordinary members with an explicit assignment see what the design allows them to see, but whether they may **verify** is the Founder decision.
- The `founder` internal capability remains an internal authoring path and is never a customer verifying path.
- Revoking a grant blocks the next submission immediately, because access is re-evaluated per call.

## 14. Audit events

Material payment actions create append-only audit events, following the established principles (I6, I9): identifiers only, no sensitive content, written in the same transaction as the material state, and no content duplication.

| Event | Recorded when |
| --- | --- |
| `payment.verified` | A verification is recorded against a version. |
| `payment.reversed` | A reversal or refund linked to the original transaction has been recorded. |
| `payment.allocated` | An allocation from a transaction to an obligation has been recorded. |

Rules:

- Metadata carries **identifiers and state only** — organization, project, payment version, version number, the accepted proposal version reference, the acting person, and the action or new status. It **never** contains agreement text, proposal content, a signature image, or any identity-verification artifact.
- The audit event is appended in the **same transaction** as the payment version row and the version's `verified`/`reversed` transition.
- Reading a payment or an allocation is non-mutating and creates **no** audit event (I5).
- The audit event is **not** a substitute for the payment version record. The append-only payment version row is the primary evidence; the audit event is the activity trail.
- This design does not require a new Founder UI. The existing internal project Activity history already renders audit event types and needs no change; if a dedicated internal payment surface is later wanted, that is a separate decision (section 19).

## 15. Retention and security boundary

The requirements call for **secure retention** (§13) and for explicit retention/deletion rules before production use (§27). This design separates four distinct concerns and does not conflate them.

**Application historical-record requirements (decided here).**

- A payment version row and a verified payment version are retained for the life of the project record; they are never hard-deleted by an application path in this slice.
- Historical verified records remain readable so that project history stays auditable.
- This is an **application** retention behavior, not a legal retention period.

**Security requirements (decided here).**

- Verified records and payment content are stored server-side behind the existing authorization model, with least privilege and project-specific access (I3, §27).
- No provider secret or raw payload is stored unless a later provider/legal decision requires it and defines how it is protected.
- The public repository continues to exclude keys, session data, confidential customer information, and sensitive payment information (I8).

**Legal / document-retention requirements — *Founder / legal decision required*.**

- The legally required retention **period**, any mandated deletion, and the admissibility posture of retained records are **not** decided here.
- No retention period is invented. **Q7.**

**Jurisdiction-specific requirements — *Founder / legal decision required*.**

- Which jurisdictions apply, and what they require for a valid electronic payment record and retention, are **not** decided here. **Q8.**

Production activation requires Q7 and Q8 to be resolved, plus the provider choice (section 16). This design defines only the application-level historical and security requirements.

## 16. Provider boundary

**No payment provider is selected, evaluated as a dependency, or integrated by this design.** No vendor — the marketplace names, any considered alternative, or any equivalent — becomes an implementation dependency merely because it exists.

- The design is **provider-neutral**. The payment model and the verification record are defined in terms the platform already owns: organization, project, accepted proposal version, payment version, person, action, timestamp, verified amount.
- A future provider may be integrated later behind a port in the same way the existing email delivery is placed behind a provider-neutral port with a local sink — but that integration and its provider are a **separate later decision**.
- The provider decision must also resolve what additional evidence the provider contributes (certificates, trusted timestamps, long-term validation) and how that is stored without duplicating content into audit metadata.
- **Q5. Provider selection is required before any production verification flow that depends on it.** Until then, no provider is a dependency.

## 17. Legal boundary

This document is **not** legal advice and makes **no** claim that the workflow it describes is legally binding, enforceable, admissible, or valid in any jurisdiction.

- Accept Proposal is application-level commercial evidence and is **not** a legal signature (Customer Proposal Response §9). This design does not change that.
- An application-level payment record produced by this model is evidence that an authenticated, authorized person performed a verification action against an exact payment version at a timestamp. It is **not**, by itself, a determination of legal validity.
- Jurisdiction-specific legal requirements require separate legal review and a Founder decision before production activation. **Q8.**
- Production activation must not occur until the legal questions in section 21 are resolved. This design deliberately leaves them open.

## 18. Downstream relationship to project activation

The approved commercial gate is unchanged:

> **Proposal accepted → Agreement completed → Required payment conditions satisfied → Project activated** (§15)

This design defines **only the payment boundary** inside that chain. It does **not** implement payment or activation, and it does **not** introduce a new customer-facing project stage.

- **What this slice may expose to downstream systems later.** A derived, read-only signal that the project has a **current payment version** whose status is `verified` (§8.2) — a "payment verified" boolean plus the identifying version number and timestamp — computed from the append-only rows, never stored as a mutable project field. The signal is true only when a current payment version exists **and** that version is `verified`; it never queries for a version that is simultaneously `published` and `verified`, which the state model forbids. Because "current payment version" requires the version's accepted proposal baseline to match the project's current accepted proposal version, a verified version with a stale baseline does **not** satisfy the signal.
- **What downstream may rely on.** A later activation design may consult that derived signal as the "Payment verified" condition. "Verified" means there is a current payment version (§8.2) and it carries a verification. It must not treat proposal acceptance alone as verified, and it must not treat an unsigned version or a **stale** version as verified. A verified version that is no longer the current payment version — for example because a newer accepted proposal version made its baseline stale — stays verified history and is never reported as unverified, but it does not make the payment-verified signal true.
- **What a verification signal becoming false does and does not mean.** The signal can become false in two ways, both expected and correct:
  - **A newly published payment version.** A new version requires its own verification (§8.2, §12), so verified Payment v1 then published Payment v2 gives a current version that is not yet verified.
  - **A newly accepted proposal version that makes the verified version stale.** If Proposal v2 is accepted after Payment v1 (based on Proposal v1) was verified, Payment v1 becomes **stale** and is no longer the current payment version, so "payment verified" is false until a new version based on Proposal v2 is published and verified. In both cases the earlier verified version stays immutable verified history and the signal simply reports that no *current* version is verified.
  - The verification signal is a **read-only commercial gate/condition**, never a command. Nothing consumes it as an instruction to change state.
  - A newer accepted proposal version, or publishing a new payment version, must **not**, by itself, deactivate, suspend, roll back, or otherwise revoke an already activated project, and must not change `customerStageFor`. Any such behavior requires a **separate Founder-approved activation/commercial decision**. This design defines none of it.
- **What this slice does not do.** No payment record, no payment status, no payment provider, no activation, no deactivation, no suspension, no rollback, and no stage change. `customerStageFor` and the customer-facing stages remain exactly as accepted elsewhere (I7).
- **The ordering and the exact "required payment conditions" remain a separate decision.** §15 already fixes the sequence; the specific conditions are a later Founder decision, not part of this design.

Whether verification should be gated on payment, or payment on verification, is **not** changed by this design. §15's approved order stands.

## 19. Notifications

Notifications and email-provider activation are **out of scope**. This design requires none of them, activates no provider, and adds no template or send path. A customer learns a payment awaits verification by viewing the project, exactly as they learn a proposal awaits a response. Whether to notify by email is a later decision with its own provider decision.

## 20. Verification contract and acceptance gate

### 20.1 Verification contract

Before an implementation of this design can be considered complete, focused tests must cover, against the real services and store:

**Authorization and isolation**

- an unauthenticated caller cannot view or verify;
- a customer without project access cannot view or verify;
- a customer from another organization cannot reach the payment (result indistinguishable from not found);
- an ordinary member's ability to verify matches the design's authorization model exactly, and a member who may not verify is rejected;
- the `founder` internal capability is never a customer verifying path;
- a revoked grant blocks the next submission.

**Version binding and state**

- a verification binds to the exact payment version and accepted proposal version shown to the customer;
- a stale submission against a version that is no longer the current signable version (§8.2) is rejected and writes nothing;
- a `draft` version is never signable, is never the current signable version, and is never the current payment version until it is published;
- only a `published` version is signable, and a `verified` version is never signable again;
- no version is ever simultaneously `published` and `verified`: the current payment version is either `published` (awaiting verification) or `verified` (completed for that version), never both.

**Immutability/evidence guarantees** (use the now-settled principles):

- **signature cardinality** — one authorized verification completes each payment version; a partial unique index may guard against a second row;
- a replayed idempotency key records exactly one verification and one audit event;
- a duplicate idempotency key cannot create a second row;
- the idempotency key is resolved **before** the terminal-state check: a replay of an already-successful verification operation returns the recorded result even though the version is now `verified`, while a fresh submission against a `verified` version is rejected;
- the payment version row, its `verified` transition, and the audit event are atomic (a failure in one rolls back all);
- audit metadata contains identifiers only and never agreement text, proposal content, or any identity artifact;
- reading a payment or a signature writes nothing and creates no audit event.

**Supersession and repetition**

- a later published version becomes the current signable version and requires its own verification, without changing the status or content of any earlier verified version;
- earlier verified versions remain readable, remain `verified`, and are unchanged;
- a commercial change produces a new version rather than modifying a verified one;
- a customer verifies a later version as a separate verification, preserving earlier history;
- no assertion queries for a version that is both `published` and `verified`; the derived completion signal references the current payment version's own `verified` status;
- publishing a newer payment version does not change `customerStageFor` and does not authorize automatic project deactivation, suspension, rollback, or revocation of an activated project;
- the derived "payment verified" signal may become false when a newer payment version is published, and that change is a read-only condition, not a deactivation command.

### 20.2 Acceptance gate

Implementation of this design may proceed only when the decisions that materially determine **what is built** are resolved. The open questions in section 21 fall into three tiers.

**Required before implementation:**

The Founder has resolved Q1, Q2, and Q3 of the agreement design on 2026-10-07. Implementation may now proceed as a separate implementation task based on this approved design and its settled choices. Implementation must satisfy the authorization, version-binding, immutability/evidence, supersession, and signing-verification requirements in §20.1.

**Required before production or provider-dependent operation:**

- **Q4 — legal framework** targeted, and any required signature standard;
- **Q5 — e-signature/provider** selection, before any provider-dependent verification flow is operated;
- **Q6 — identity-proofing** strength;
- **Q7 — document-retention period** and secure-retention policy;
- **Q8 — applicable jurisdictions** and their requirements.

These are production, legal, and provider gates. They are **not** required merely to build and test the provider-neutral application model against synthetic data, and the core model may remain provider-neutral without selecting a vendor.

**May remain deferred / explicitly out of scope for the first implementation:**

- **Q9 — decline/withdraw/expiry/reminders.** Deferrable only if the first implementation **explicitly excludes** them.
- **Q10 — customer view/download of payment details.** Deferrable only if customer view/download is **explicitly out of scope** for the first slice.

Deferring Q9 or Q10 is not a decision on the question: both remain **Founder decision required** and must be recorded before the corresponding behavior is built.

Additional standing conditions:

1. no provider is activated, no deployment occurs, and no live customer data is processed without separate authorization;
2. `customerStageFor` and the customer-facing stages remain unchanged;
3. a verified payment version whose accepted proposal baseline is no longer the current accepted proposal baseline is rejected at verification time — the design enforces the exact baseline and never rebinds;
4. publishing a new payment version does not change `customerStageFor` and does not deactivate an activated project (any such behavior is a separate Founder-approved decision).

A merged implementation PR would not authorize production deployment, live customer-data operation, provider activation, payment implementation, automatic project activation, or legal certification, would not assert legal validity, and would not resolve any of Q1–Q10.

## 21. Open questions requiring Founder decision

Q1–Q3 have been resolved by the Founder on 2026-10-07 of the agreement design. The remaining open questions are Q4–Q10 and continue to be marked **Founder decision required**; the corresponding behavior must not be treated as decided until those later gates are resolved.

| # | Question | Status | Notes |
|---|---|---|---|
| Q1 | **Who may verify, and does the verification require a countersignature?** | **Resolved — Founder decision 2026-10-07** | One authorized customer verifier is sufficient; Founder countersignature is not required by default. Q1-A applies: one verification record completes the payment version. |
| Q2 | **Must the payment restate/embed the accepted proposal terms, or may it reference the exact accepted version?** | **Resolved — Founder decision 2026-10-07** | The payment binds to the exact accepted Proposal version and may contain additional contractual terms. The exact baseline remains immutable and cannot be rebound. |
| Q3 | **Is one payment per obligation sufficient, or are multiple concurrent payments/allocations needed?** | **Resolved — Founder decision 2026-10-07** | One primary payment per project initially; additional payment types may be introduced later as related records if actually needed. |
| Q4 | **What legal framework (if any) is targeted**, and is any specific payment standard required? | **Founder / legal decision required** | §17 makes no legal claim. |
| Q5 | **Which payment provider (if any) is selected**, and what evidence does it add? | **Founder decision required** | §16 keeps the design provider-neutral; provider selection is separate and is required before a production verification flow depending on it. |
| Q6 | **How strong must payee identity proofing be?** | **Founder / legal decision required** | §9.1 records authenticated-session identity only and claims no legal sufficiency. |
| Q7 | **What document-retention period and secure-retention policy applies?** | **Founder / legal decision required** | §15 defines application retention only; no legal period is invented. |
| Q8 | **Which jurisdictions apply, and what do they require** for a valid electronic payment record and retention? | **Founder / legal decision required** | §15, §17. Production activation requires these resolved. |
| Q9 | **Is a decline/withdraw action, expiry, or reminder ever required?** | **Founder decision required** | §19 keeps them out of the smallest slice. |
| Q10 | **Should payment details be viewable/downloadable by the customer?** | **Founder decision required** | Not decided here; view access is not implied by the verification record. |

The following are **design/implementation-level** details that do **not** require a further Founder decision if the design is approved, and may be settled by the implementing task without changing any business rule:

1. exact table and column names, index choices, and query tuning within §7 and §14;
2. exact customer-facing wording (subject to the no-legal-claim boundary in §17);
3. whether the payment surface is a separate page or a panel on the existing project proposal page;
4. notice codes and their wording;
5. whether the derived "payment verified" signal is computed on read or exposed as a store method.

**Review suggestions deliberately not adopted.** Two `LOW` review suggestions are **not required** by this design and are intentionally left unchanged:

- **Adding a `proposal_response_id` to the verification record.** Unnecessary: the verification already stores the exact accepted proposal baseline (`proposal_id`, `proposal_version_id`, version number; §7.3, §9.1), which is what the baseline check needs. The verification is a payment-level action, not a proposal-response action, and binding it to a specific response row would couple payment evidence to a record it does not depend on.
- **Renaming the `payment.verified` audit event to `payment_version.verified`.** Unnecessary: the event's identifiers-only metadata already carries the payment version identifier and version number (§14), and `payment.verified` stays coherent with `payment.created` and `payment_version.published`.

## 22. Consequences

- The platform gains a small, provider-neutral, append-only payment model that is **separate** from the proposal and never mutates it.
- Accept Proposal keeps its accepted meaning: application-level commercial evidence, explicitly not a signature (Customer Proposal Response §9). The distinction **Accept ≠ Verify** is now structural, not just documentary.
- Verified history cannot be silently overwritten: it is append-only, single per version, bound to an exact accepted proposal version, and never re-derived from mutable state.
- A payment version whose accepted baseline becomes stale stops being the current payment version, so the payment-verified signal becomes false, without mutating, deactivating, suspending, or rolling back anything.
- The commercial gate becomes implementable in steps: acceptance exists today; a completed-payment signal becomes available when this slice is implemented; activation remains later, separate decisions whose ordering §15 already fixes.
- The design deliberately carries open business and legal questions rather than hidden assumptions, so the Founder's decisions are visible and can be recorded before production activation.
- Nothing is deployed, no provider is activated, and no live customer data is processed by approving this design.

## 23. Alternatives considered

**Treat proposal acceptance as the verification.** Rejected. It would claim legal effect the platform does not have, silently rewrite the accepted evidence, and contradict the accepted Customer Proposal Response decision.

**Store payment state on the project row.** Rejected. A mutable per-project payment field would let a later change rewrite history; derived standing from immutable versions and signatures is required for auditability.

**Make verified versions mutable with an amendment flag.** Rejected. It would allow silent rewriting of what was verified; a commercial change must produce a new numbered version instead.

**Copy the accepted proposal content into each payment version.** Rejected as the default. The approved design binds each payment version to the exact accepted proposal version and permits additional contractual terms in the payment itself; proposal content is not duplicated merely to create another mutable copy.

**Select a payment provider now.** Rejected. Provider selection is a separate decision, and §13 of the requirements says so; baking a vendor into the design would pre-empt it.

**Assert legal validity or enforceability.** Rejected. The design makes no legal claim and routes that to separate legal review (Q4, Q8).

**Add expiry, reminders, and decline states now.** Rejected for the smallest slice. The state model stays at `draft` / `published` / `verified`; "stale" (the accepted proposal baseline changed) and "reversed" (a refund or refund has been linked) are only derived concepts, never a stored state (Q9).

**Introduce a new verifier role or identity system.** Rejected. The approved Q1 choice reuses the existing person, organization, and project-access model and requires one authorized customer verifier without a default Founder countersignature.

**Add a customer JSON endpoint or a new Founder UI.** Rejected for this design. The existing platform conventions and internal Activity history are sufficient; any dedicated surface is a later decision.

**Advance the customer project stage to "Payment verified".** Rejected. It would duplicate the accepted stage model; `customerStageFor` stays unchanged (I7).

**Allow allocations to exceed the verified transaction amount.** Rejected. Allocation totals must not silently double-count or exceed the available transaction funds after relevant adjustments (clarification 4).

**Treat one payment as necessarily mapping to one obligation only.** Rejected. The design permits multiple legitimate allocations and partial payments against an outstanding obligation where the approved policy allows them (clarification 3).

## 24. Approval

**Status: Draft — design draft under review.**

This document records the design draft for Payments Project Activation. It is a design decision, not an implementation, and it records the resolved Q1–Q3 choices and the remaining business/legal questions in section 21.

Approval covers the design, including:

- one primary payment per project initially, with additional payment types allowed later as related records if actually needed;
- exact accepted proposal version binding, with additional contractual terms permitted in the payment;
- one authorized customer verifier per payment version, with no default Founder countersignature and Q1-A single-verification completion;
- immutable numbered payment versions with exactly three/four version states (`draft`, `published`, `verified`, `reversed`), derived current-version semantics, and immutable verified history;
- append-only verification records, authorization re-checks, idempotent verifying, atomic verification/audit/state writes, and no provider raw payload duplication;
- provider-neutral architecture, no legal-validity claim, and the payment/activation boundary unchanged;
- Q4–Q10 remain separate later decisions and production/provider/legal gates.

Approval does **not** authorize production deployment, live customer-data operation, provider activation, payment implementation, automatic project activation, or legal certification.

Following approval and the Founder decisions recorded here, implementation of this design is a separate, later task that must satisfy the verification contract in §20.1 and the remaining production/provider gates in §15–§17 and §21.