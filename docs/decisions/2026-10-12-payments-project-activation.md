# Payments and Project Activation — Design Gate

**Status:** Draft — Founder review required. Not approved for implementation.  
**Date:** 2026-10-12  
**Founder approval:** Not approved. This draft records a proposed design for Founder review only.  
**Scope:** Provider-neutral conceptual design for the relationship between payment obligations, payment evidence, and project activation — with no provider selected, no pricing, no payment policy, and no legal-validity or regulatory-compliance claim.  
**Related:** Customer Platform Direction (Stage 4), Customer Platform Requirements (§7, §14, §15, §24), Customer Proposal Response (§9), Agreement and E-Signature (§18, §8.2), Customer Platform Founder Workspace, Repository and Documentation Conventions

> **Status note.** This is a **draft design gate**, not an approved decision. It is prepared for Founder and independent engineering review. It does **not** authorize implementation, provider selection, provider activation, pricing, deployment, live customer-data processing, or any commercial or legal policy. Every material business, pricing, provider, tax, refund, and activation-policy question is recorded in section J as **Founder decision required** rather than assumed. Preparing this draft resolves none of them.

---

## 1. Status

**Status: Draft — Founder review required. Not approved for implementation.**

This document proposes the smallest provider-neutral model that connects the already-implemented proposal and agreement workflow to the not-yet-implemented payment and activation stage. Four facts must be kept separate, and none implies the next:

- **The baseline commercial sequence is already approved.** `Proposal accepted → Agreement completed → Required payment conditions satisfied → Project activated` (Requirements §15; restated unchanged in Agreement §18). This design does not alter that sequence.
- **Nothing here is implemented.** No payment record, schedule, obligation, evidence, provider integration, or activation mechanism exists, and this design does not create one. A design is not a capability.
- **Nothing is priced, taxed, or legally decided.** Pricing, payment schedules, refunds, taxes, provider selection, and the exact activation conditions are separate Founder decisions (Requirements §14; section J below).
- **Merging a future implementation would not authorize production use.** As with the agreement slice, a merged payments/activation PR would not authorize deployment, provider activation, live customer-data processing, or any legal claim, and would not resolve any Founder decision in section J.

---

## A. Problem and scope

### A.1 The gap

The platform now implements, and has merged, the commercial workflow up to agreement signing:

- **Proposal acceptance** is an append-only, version-bound customer action recorded in `proposal_responses` (Customer Proposal Response, merged as PR #45). It is **application-level commercial evidence**, explicitly not a payment and explicitly not a signature (§9 of that decision: acceptance "does not create a payment obligation, schedule, or status" and is "not the commercial gate").
- **Agreement signing** is a separate, version-bound record with append-only signature evidence and immutable signed history (Agreement §7–§12, merged as PR #48). Its "agreement completed" signal is a **derived, read-only** boolean computed from append-only rows, never a stored mutable field (Agreement §18).

The next two links in the approved sequence — **required payment conditions satisfied** and **project activated** — are **not implemented**. There is no record of what a project owes, no evidence of what has been paid, and no activation event. This design proposes the conceptual model for those two links.

### A.2 Five distinct concepts the design must not conflate

The governing documents are explicit that these are separate concerns. The design preserves that separation:

| Concept | What it is | Governing source | What it is NOT |
|---|---|---|---|
| **Commercial approval** | The customer's acceptance of an exact proposal version — application-level commercial evidence. | Customer Proposal Response §9 | Not payment, not a signature, not activation. Creates no payment obligation. |
| **The agreement-signing record** | An append-only, version-bound signature on the current signable agreement version; "completed" is a derived read-only signal. | Agreement §8.2, §18 | Not payment, not activation. A signed version with a stale proposal baseline does not satisfy the signal. |
| **A payment obligation** | A configured, per-project expectation that a defined amount (in a Founder-defined unit) be paid under a schedule. *(Proposed, not implemented.)* | Requirements §14 | Not evidence of payment. Not a stage. |
| **Evidence payment conditions are satisfied** | Authoritative, auditable proof that the required obligations for a project are satisfied. *(Proposed, not implemented.)* | Requirements §15 | Not the obligation itself; not a provider callback taken on trust. |
| **The project-activation decision** | An auditable, atomically recorded transition that starts Delivery Onboarding. *(Proposed, not implemented.)* | Requirements §15, §16 | Not automatic side effect of a payment row; not reversible by a later payment event without a separate policy. |

The design's job is to connect these five with explicit, auditable boundaries — never to merge them.

### A.3 In scope / out of scope

**In scope (design only):** the conceptual records for payment configuration, obligations, payment-status evidence, payment-related events, and activation evidence; the candidate activation predicate; authorization and audit shape; the implementation-and-verification contract; the Founder decisions required.

**Out of scope:** any provider selection or integration; any real payment processing; any automatic activation implementation; any pricing, tax, refund, or dunning policy; any change to `customerStageFor`, customer-facing stages, or existing agreement behavior; any deactivation path; any legal or regulatory claim.

---

## B. Proposed domain model

These are **design proposals, not approved schema**. No migration, table, type, route, service, or UI component is created by this document. Each record is described by purpose, authoritative source, key references, immutability expectation, and audit implication.

A guiding principle carried from the existing slices: **prefer immutable version references over duplicated mutable commercial content.** The accepted proposal version and the signed agreement version already establish the commercial baseline; payment records should *reference* those immutable versions rather than restate their terms.

### B.1 `project_payment_configuration` *(proposed)*

- **Purpose:** the Founder-approved payment arrangement for one project (which of the §14 structures applies, and the obligations derived from it).
- **Authoritative source:** Founder/internal action only; never customer-writable.
- **Key references:** `project_id`; the **accepted proposal version** and **signed agreement version** that form the commercial baseline being paid for (immutable version identifiers, not copied content).
- **Immutability expectation:** a configuration is **amended by a new immutable version**, not mutated in place, once obligations have been issued against it — so the historical commercial basis is never silently rewritten. Before any obligation exists, a correction may be modeled as a replacement; this is a Founder policy question (section J.2).
- **Audit implication:** every configuration create/amend is an identifier-only audit event recording the actor, the project, and the baseline version identifiers.

### B.2 `payment_obligation` *(proposed)*

- **Purpose:** one discrete expected payment under the configuration (e.g. "deposit", "milestone 2 balance", "full amount").
- **Authoritative source:** derived from the configuration by a Founder/internal action; the obligation's own state machine is driven only by authoritative evidence (section D).
- **Key references:** `project_id`, `payment_configuration_version_id`, optional link to a scope/milestone version identifier (Requirements §14 links milestone payments to approved scope).
- **Immutability expectation:** the obligation's **definition** (what is owed, its baseline) is immutable once issued; only its **state** advances, and only via recorded transitions with evidence.
- **Audit implication:** creation and every state transition is an identifier-only audit event.

### B.3 `payment_evidence` *(proposed)*

- **Purpose:** the durable record that a payment (or a reversal/refund) was confirmed by an authoritative source.
- **Authoritative source:** determined by the Founder's evidence policy (section D). Candidate sources: provider confirmation (after verification), verified reconciliation, or an explicit authorized manual record.
- **Key references:** `obligation_id`, `project_id`, the evidence-source kind, and provider-side identifiers **as opaque references only**.
- **Immutability expectation:** append-only. A correction is a **new** evidence/reversal event, never an edit to an existing one.
- **Audit implication:** the evidence append and the resulting obligation-state change are recorded **in the same transaction**, mirroring the agreement slice's atomic signature/version/audit writes (Agreement §20.1).

### B.4 `payment_event` *(proposed)*

- **Purpose:** the append-only history of everything that happened to a payment — attempts, confirmations, failures, reversals, chargebacks, refunds, manual adjustments — so duplicate, delayed, or out-of-order events remain reconstructable.
- **Authoritative source:** the reconciliation process and authorized actors.
- **Key references:** `obligation_id`, `project_id`, an idempotency/deduplication key.
- **Immutability expectation:** strictly append-only; the current obligation state is **derived** from this history (mirroring how proposal standing is derived from append-only `proposal_responses`).
- **Audit implication:** this *is* the audit trail for payment; the identifier-only `audit_events` row (below) is the cross-cutting record.

### B.5 `project_activation` *(proposed)*

- **Purpose:** the single auditable record that a project met the activation predicate and Delivery Onboarding began (Requirements §16).
- **Authoritative source:** the activation decision (section F), whether performed automatically later or manually by the Founder.
- **Key references:** `project_id`; the accepted proposal version; the signed agreement version; the set of obligation identifiers whose evidence satisfied the conditions.
- **Immutability expectation:** append-only, one activation record per project (a partial unique index, mirroring the single-acceptance guard in Customer Proposal Response). Deactivation is **not** part of this record and is not implied (section E.6).
- **Audit implication:** the activation event is written **atomically with** the predicate evaluation's inputs, so a later reader can reconstruct exactly which evidence satisfied which obligations at activation time.

### B.6 Relationship to the existing audit store

The current `audit_events` table (verified in `website/lib/platform/sqlite-store.ts`) already carries `organization_id`, `person_id`, `project_id`, `type`, `occurred_at`, and a `metadata` column, appended via `appendAuditEvent` and read per-project via `listAuditEventsForProject`. Payment and activation events would reuse this **identifier-only** pattern: metadata carries identifiers and enum states, **never** amounts-with-customer-identities beyond what is required, never card/bank data, never provider secrets (Requirements §24; direction ADR exclusions).

---

## C. Payment schedules and obligations

### C.1 What the requirements already allow

Requirements §14 lists the **possible approved structures**: full upfront; deposit plus later payments; milestone-linked payments; another Founder-approved arrangement. This design **does not select one** and **invents no monetary values.**

### C.2 What can stay configurable and provider-neutral

- The **set of obligations** and their ordering are data derived from whichever structure the Founder approves; the model does not hard-code a schedule shape.
- Obligations reference **scope/milestone version identifiers** rather than embedding amounts, so milestone-linked schedules work without schema assumptions about money.
- The model is provider-neutral: an obligation and its evidence carry **opaque provider references**, never a chosen provider's field names.

### C.3 What requires Founder approval

The **choice of structure per project**, the **currency/unit**, the **amounts**, whether an obligation can be edited after issuance, and whether late/failed obligations block anything are all Founder decisions (section J.2, J.4). The design holds the model open for each without presuming an answer.

### C.4 Candidate obligation lifecycle states *(proposed only)*

These are **proposed states with distinct semantics**, deliberately not collapsed:

| State | Proposed meaning | Transition evidence required |
|---|---|---|
| `expected` | The obligation exists under the configuration; nothing is owed yet (e.g. a future milestone). | Configuration version issuance. |
| `due` | The obligation is now payable under the schedule. | A recorded schedule/trigger event, or Founder action. |
| `pending_confirmation` | A payment attempt is known but **not** yet authoritatively confirmed. | A payment attempt / pending evidence record. |
| `confirmed` | Authoritative evidence (section D) confirms the obligation is satisfied. | Authoritative evidence append + atomic state change. |
| `failed` | A payment attempt failed or was abandoned. | Failure evidence / provider or reconciliation record. |
| `reversed` | A previously confirmed payment was reversed (chargeback/reversal). | Reversal evidence append; **never** an edit to the confirmation. |
| `refunded` | A confirmed payment was refunded (full or partial). | Refund evidence append; partial amounts recorded as distinct evidence. |

`confirmed → reversed` and `confirmed → refunded` are **evidence-driven transitions recorded forward**, never rewrites of the original confirmation — preserving an accurate audit trail (section E). Whether `reversed`/`refunded` change what "satisfied" means for an **already-activated** project is a Founder policy decision (section J.12), not an automatic behavior.

---

## D. Payment-status evidence and reconciliation

### D.1 What the system must hold before treating an obligation satisfied

At minimum: an obligation identifier, a determination that it is satisfied, the **evidence source kind**, an idempotency/deduplication key, and a timestamp — enough for a later reader to reconstruct *why* the obligation was considered satisfied and *who or what* determined it, without exposing raw payment credentials (Requirements §14: "must not store raw payment credentials").

### D.2 Candidate evidence sources compared

| Source | Trust boundary | Strength | Risk |
|---|---|---|---|
| **Provider confirmation** | External system; must be **verified** (signature/authenticity, amount, currency, obligation match) before trust. | Machine-verifiable, real-time. | A provider callback must **never** be treated as automatically trusted (section 6); replay, forgery, out-of-order delivery. |
| **Verified reconciliation** | Internal process comparing provider records to obligations. | Catches missed/late callbacks. | Batch timing; depends on a trustworthy provider export. |
| **Authorized manual record** | A named Founder/authorized actor explicitly marking an obligation satisfied. | Handles off-platform / exceptional payments. | Highest misuse risk; must be least-privileged, audited, and rare. |

This design **does not declare any source authoritative.** Choosing the operating policy and provider boundary is a Founder decision (section J.3, J.8, J.10). The conceptual design only requires that whichever source is approved carries the evidence fields above and is append-only.

### D.3 Idempotency, duplicates, retries, concurrency

- **Duplicate events:** every inbound confirmation carries an idempotency key (provider event id, or reconciliation batch+obligation key). A duplicate is recorded as a recognized no-op, not a second state change — mirroring the action-key idempotency already used for signing and proposal responses.
- **Retries and delays:** because `payment_event` is append-only and state is **derived**, an out-of-order or late confirmation can be reconciled without corrupting history; the derived state is recomputed from the full event set.
- **Consistency under concurrency:** the evidence append and the derived obligation-state change occur in **one transaction** (mirroring Agreement §20.1's atomic signature/version/audit requirement), so a concurrent second confirmation cannot double-satisfy an obligation (a one-satisfaction guard is proposed, like the single-acceptance partial unique index).

---

## E. Failed, reversed, disputed, and refunded payments

This section explains lifecycle consequences **without inventing business policy.** Each item names the decision the Founder must make.

### E.1 Failed or abandoned attempts
A failed attempt records a `failed` payment event and leaves the obligation `due` (or `pending_confirmation → failed`). Whether a customer may **retry**, how many times, and whether repeated failure blocks anything are Founder decisions (J.4). The design only requires the failure be recorded, not silently dropped.

### E.2 Duplicate or delayed confirmations
Handled by idempotency and derived state (D.3). A delayed confirmation that arrives after a manual determination must be **reconciled**, not allowed to silently overwrite; the reconciliation outcome is a recorded event.

### E.3 Reversals / chargebacks after apparent success
A reversal is a **new forward event** (`confirmed → reversed`) with its own evidence; the original confirmation is never edited. Whether a reversal re-open[s] an obligation, blocks further work, or is purely financial is a Founder decision (J.5, J.12).

### E.4 Full and partial refunds
A refund is a forward event; **partial refunds** are recorded as distinct evidence against the same obligation so the net position is reconstructable. Refund authority, partial-refund policy, and historical treatment are Founder decisions (J.6). No refund is modeled as automatic.

### E.5 Retry and reconciliation procedures
Reconciliation is the process of matching provider/manual evidence to obligations and recording the outcome. Its cadence, authority, and how disputes are escalated are Founder operational decisions (J.4, J.5, J.10).

### E.6 Effect on projects already activated — and no automatic deactivation
**This design introduces no deactivation path.** Consistent with Agreement §18 ("a newer accepted proposal version, or publishing a new agreement version, must not, by itself, deactivate … an already activated project"), a payment reversal, refund, or later commercial event likewise **must not silently trigger deactivation or rewrite historical evidence.** The effect of such an event on an activated project requires an **explicit Founder-approved policy** (J.12). The proposed model therefore keeps **activation** (append-only, section B.5) and **payment status** (derived, section B.4) as separate auditable concerns: a later payment event changes payment status; it does not, by itself, change activation. If the Founder someday wants a deactivation/suspension concept, it is a **separate, explicit decision** — not a side effect of this design.

---

## F. Exact project-activation predicate

### F.1 Candidate predicate (derived from the approved sequence)

> **Activate a project if, and only if, all of the following hold together in one consistent snapshot:**
> 1. **Accepted proposal version:** the project has a current accepted proposal version (Customer Proposal Response; standing derived from append-only `proposal_responses`).
> 2. **Signed agreement version:** the project's **current** agreement version is `signed` — i.e. the derived "agreement completed" signal is true (Agreement §8.2, §18). A signed version whose accepted-proposal baseline is **stale** does **not** satisfy this.
> 3. **Payment conditions satisfied:** every obligation required by the project's payment configuration is `confirmed` (or otherwise Founder-defined as "satisfied"), each backed by authoritative evidence (section D).
> 4. **Atomic activation event:** the activation record is written in the same transaction that evaluated the predicate, referencing the exact proposal version, agreement version, and obligation identifiers that satisfied it.

Conditions 1 and 2 are supported by **already-approved** sources (Customer Proposal Response §9; Agreement §8.2/§18). Condition 3's meaning of "satisfied" and condition 4's exact trigger are **Founder decisions** (J.3, J.9).

### F.2 Repeated evaluation, duplicates, concurrency, traceability

- **Repeated evaluation is safe.** Because the activation record is append-only with a one-per-project guard, re-evaluating the predicate after activation is a no-op, not a second activation.
- **Duplicate triggers** are absorbed by the same guard plus an idempotency key.
- **Concurrent changes:** the predicate is evaluated and the activation written **inside one transaction**, so a concurrent new proposal acceptance, new agreement version, or new obligation cannot interleave to produce a partial activation; the snapshot is consistent.
- **Historical traceability:** because activation references the exact proposal/agreement/obligation identifiers, a later reader can reconstruct precisely what was true at activation — even though the derived "agreement completed" signal or payment state may since have changed (Agreement §18 notes the signal can legitimately become false later).

### F.3 Automatic activation — how it could be safe, without authorizing it

Requirements §15 says the application **should** activate automatically when configured conditions are satisfied. This design notes, **without authorizing or building it**, that a future automatic activator would have to: evaluate the predicate server-side only; write the activation atomically with its evidence; be idempotent under retries; never trust a client-supplied trigger; and never run in production until the applicable Founder decisions (J.3, J.8, J.9) and production gates are approved. **This design authorizes none of that.**

---

## G. Authorization and audit

### G.1 Proposed permissions (no new customer capabilities)

| Action | Proposed actor | Rationale |
|---|---|---|
| Payment **configuration** create/amend | Founder/internal capability only | Commercial/monetary configuration is Founder authority (direction ADR; founder-workspace ADR). |
| Manual obligation determination (mark satisfied / adjust) | Founder/internal capability only, least-privileged | Highest misuse risk (D.2); never a customer capability. |
| **Customer-visible payment status** read | Authorized customer with project access | Read-only status; a customer may see what is owed/paid, never edit it. |
| **Activation** (future automatic or manual) | Server-authoritative decision; manual override Founder-only | Must never be a client-supplied command. |

**No customer role may mark an obligation as paid.** This design grants customers **no new write capability**; customers can at most read their own payment status through the existing project-access authorization.

### G.2 Project isolation and the caller-supplied-identifier rule

The existing pattern — verified in `website/lib/platform/projects.ts` — is that a caller-supplied identifier is **never** proof of access: `resolveProjectIdByReference` resolves a reference **within the caller's organization** and then calls `requireProjectAccess` ("Authorize before disclosing the internal id") before returning a project id. Payment and activation operations reuse exactly this pattern: a reference is resolved and access re-checked server-side on **every** read and write (mirroring Customer Proposal Response's per-call authorization restatement and Agreement §13).

### G.3 Founder/internal authority stays distinct from customer authority

Following the founder-workspace ADR, internal payment operations belong on the **internal surface** (`/internal/...`, `/api/internal/...`), authorized against the dedicated `founder` capability attached to a Person — never a customer route with hidden controls. Internal payment/activation fields are internal-only and never leak into customer projections.

### G.4 Actor, preconditions, evidence, failure handling (per material transition)

For **configuration**, **obligation issuance**, **evidence append / state change**, **manual determination**, and **activation**: each names the actor (Founder capability, authorized customer read, or trusted reconciliation process), its preconditions (baseline versions current, access re-checked, predicate satisfied for activation), its identifier-only audit evidence, and its failure handling (reject and record nothing partial, as in the atomic-write patterns already used). Details are elaborated per slice in section I.

### G.5 Audit integrity

Every material transition appends an identifier-only `audit_events` row (type, actor, project, timestamp, identifier metadata) **in the same transaction** as the state change it describes — matching the existing two-layer evidence contract where the audit append and the record write succeed or roll back together.

---

## H. Security, privacy, and operational boundaries

- **Least privilege:** only the Founder capability configures payments or makes manual determinations; customers get read-only status through existing access checks.
- **Minimal stored evidence:** store obligation linkage, evidence-source kind, opaque provider references, and derived state — **never** raw card numbers, security codes, banking credentials, or provider secrets (Requirements §14; direction ADR exclusions; public-repository rules).
- **Secret handling:** any future provider secret lives only in server-side environment configuration, never in application records or this public repository (direction ADR).
- **Audit integrity:** append-only events plus transactional coupling to state changes; no in-place edits to evidence.
- **Retention:** payment-evidence retention is **not** decided here (J.11); no retention period is invented, mirroring how the agreement slice deferred retention to a later decision (Agreement §15).
- **Reconciliation & failure recovery:** derived state from append-only events allows reconstruction after partial failures; reconciliation is idempotent (D.3).
- **No compliance claim:** this design makes **no** legal or regulatory-compliance claim (PCI, tax, consumer-protection, etc.). Provider-specific security requirements and legal obligations remain for later legal/security review (Agreement §17 boundary carried forward).

---

## I. Implementation and verification contract

This is the **proposed** smallest later sequence. **Design approval ≠ implementation approval.** Nothing here is implemented by this document, and the first future implementation must not process real payments or activate live projects until the applicable business decisions (section J) and production gates are approved.

Each slice is a thin vertical slice with its own acceptance criteria, delivered provider-neutrally against synthetic data first:

1. **Payment configuration + obligations (provider-neutral, no real money).**
   *Criteria:* Founder-only configuration create/amend with immutable baseline references; obligation issuance; authorization tests (customer cannot configure); audit tests (identifier-only events); regression tests proving proposal/agreement/stage behavior unchanged.
2. **Payment evidence + obligation state machine (still synthetic).**
   *Criteria:* append-only evidence; derived obligation state; idempotency under duplicate events; atomic evidence+state+audit writes (transaction tests); one-satisfaction guard under concurrency.
3. **Customer read-only payment status.**
   *Criteria:* authorized-customer read; project isolation (IDOR regression restated); no new customer write capability; internal fields never exposed.
4. **Activation predicate + activation record (manual Founder trigger first, not automatic).**
   *Criteria:* predicate gating tests (each of the four conditions, including stale-agreement-baseline rejection); one-activation guard; atomic activation-with-evidence; historical traceability test; regression proving `customerStageFor` and stages unchanged.
5. **(Later, only after J.3/J.8/J.9 + production gates) provider integration and/or automatic activation.**
   *Criteria:* provider verification (never trusting callbacks blindly); replay/forgery protection; production gating; no live activation until explicitly authorized.

**Regression checks across all slices:** agreement creation/publication/signing, stale-baseline rejection, idempotency/replay, audit evidence, proposal acceptance, and `customerStageFor` stage derivation must all continue to pass unchanged.

---

## J. Founder decisions required

`Decision question` — `Why it matters` — `Options (where the governing docs support them)` — `Consequences / risks` — `What can be designed now without deciding` — `What it blocks`.

| # | Decision question | Why it matters | Options (where supported) | Consequences / risks | Designable now without deciding | Blocks |
|---|---|---|---|---|---|---|
| **J.1** | Pricing and commercial authority. | Sets what is owed and who may set it; a **material business decision** reserved to the Founder (README; project map). | Not enumerated in governing docs — Founder defines. | Under/over-pricing; unauthorized discounts. | The obligation/config model with amounts as Founder-set data. | Implementation, production use. |
| **J.2** | Payment schedule & permitted arrangements. | Determines obligation structure per project. | Requirements §14: full upfront; deposit + later; milestone-linked; another Founder-approved arrangement. | Rigid model vs. unsupported flexibility. | Config→obligations model open to all four shapes. | Implementation. |
| **J.3** | Definition of "satisfied" obligations & authoritative evidence. | The core of the activation predicate (F.1.3). | §D.2: provider confirmation (verified); verified reconciliation; authorized manual record. | Trusting the wrong source; fraud; double-satisfaction. | Evidence model with source kind + idempotency, source-agnostic. | Implementation, provider activation, production use. |
| **J.4** | Failed payments & retry policy. | Affects customers and whether failure blocks progress. | Not enumerated — Founder defines retries/dunning. | Lost revenue vs. customer friction. | `failed` state + recorded failure events. | Implementation, production use. |
| **J.5** | Reversals, chargebacks, disputes. | Post-success events that can undo confirmed payments. | Not enumerated — Founder defines handling & escalation. | Financial loss; disputed activated projects. | Forward-only reversal events; no auto-deactivation (E.6). | Implementation, production use. |
| **J.6** | Refund authority, partial refunds, historical treatment. | Who may refund and how partial refunds are recorded. | Not enumerated — Founder defines authority + policy. | Unauthorized refunds; unclear net position. | Partial-refund evidence model (forward events). | Implementation, production use. |
| **J.7** | Tax treatment & responsibilities. | Collection, recording, jurisdiction. | Not enumerated; Requirements §14 defers taxes. | Non-compliance exposure (a legal matter, not designed here). | Amount/unit fields left Founder-defined; no tax logic. | Implementation, production use. |
| **J.8** | Payment-provider selection & activation. | Determines the real integration and trust boundary. | Not selected; design stays provider-neutral. | Vendor lock-in; security posture. | Opaque provider references; provider-neutral evidence. | Provider activation, production use. |
| **J.9** | Exact project-activation conditions. | The precise predicate (F.1) and its trigger. | Requirements §15: varies by approved commercial configuration. | Wrong gating; premature/late activation. | Four-condition predicate as a **candidate**; manual-trigger-first plan. | Implementation (activation slice), production use. |
| **J.10** | Who may make/override a manual payment-status determination. | Manual marks are the highest-misuse path (D.2). | Not enumerated — Founder defines the authorized actor(s). | Misattribution; fraud. | Founder-only, least-privileged, audited manual-determination model. | Implementation. |
| **J.11** | Retention & treatment of payment evidence. | How long evidence is kept and how it is protected. | Not enumerated; mirrors Agreement §15 deferral. | Over- or under-retention. | Append-only evidence with retention left undefined. | Production use. |
| **J.12** | Policy for payment events after activation. | Reversal/refund after a project is live — **must not silently deactivate** (Agreement §18). | Not enumerated — Founder defines the explicit policy. | Silent deactivation risk if left implicit. | Separate activation (append-only) from payment status (derived); **no** deactivation path. | Production use; any future suspension concept. |

**Recommendation (awaiting Founder approval, not a decision):** keep activation **append-only and forward-only**, and keep payment status **derived from append-only events**, so that no later payment event can silently rewrite history or deactivate a project. This is a technical-safety recommendation only; the business policy remains J.12.

---

## Consequences

- Establishes a coherent, provider-neutral conceptual model linking the merged proposal/agreement workflow to the future payment/activation stage, without selecting a provider, inventing pricing, or deciding any policy.
- Preserves every existing boundary: the approved sequence, version-bound baselines, separate payment vs. activation concerns, project-scoped authorization, identifier-only transactional audit, and no change to `customerStageFor` or agreement behavior.
- Introduces **no** deactivation path; a later payment event cannot silently reverse activation.
- Leaves twelve material decisions (J.1–J.12) explicitly to the Founder, none resolved by technical convenience.

## Boundaries and exclusions

This design does **not**: select or activate a provider; set pricing, taxes, refunds, or any payment policy; authorize deployment, production use, or live customer-data processing; change `customerStageFor`, customer-facing stages, or existing agreement behavior; introduce a deactivation path; or claim legal validity or regulatory compliance. Each is a separate later decision.

## Status

**Draft — Founder review required. Not approved for implementation.** Prepared 2026-10-12 for Founder and independent engineering review. Preparing this draft authorizes nothing. Implementation requires a separate, later task and the Founder decisions in section J.
