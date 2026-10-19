# Payments and Project Activation — Design Gate

Status: **Design approved — Founder approval recorded 2026-10-16. Implementation not approved.**
Author: product/design review
Date: 2026-10-12
Supersedes: none
Related: agreement/e-signature design gate (separate track); PR #50 branch `docs/payments-project-activation-design`

---

## 0. Status and scope (authoritative, read first)

This is the **Founder-approved provider-neutral design**. Founder approval for the design was recorded on 2026-10-16. This approval does **not** authorize implementation, production use, provider onboarding or activation, migration, schema change, route addition, UI work, or any customer-visible behavior.

The approved commercial decisions recorded in §J.1–J.2 are that the Founder sets each project's amount and currency, with no public pricing catalogue or automatic pricing, and that the three initial schedule structures are full upfront, deposit plus later payments, and milestone-linked payments. This document sets no actual project amount or currency value.

Nothing in this document changes the current commercial baseline, the current accepted-proposal behavior, the current signed-agreement behavior, agreement states, customer-facing stages, or `customerStageFor` and the resulting customer-facing stage output. Any future implementation requires separate approval and, where relevant, separate decisions.

Design approval is complete. Implementation, provider selection/activation, production use, and live customer-data processing remain separately gated. Candidate states and predicates remain candidates where the document says so; unresolved Founder policies are not assumed.

This approved design preserves the five review corrections, the useful conceptual sections of the original proposal, and the distinction between payment-attempt outcomes and obligation states.

Out of scope: provider integration, fees, taxes, refund and chargeback policy or execution, dunning, retry policy, invoicing style, receipts, ledger export, and any consequence of activation. The document does not set project-specific amount/currency values or due dates, choose a provider, settle evidence authority, or decide what happens after activation. The initial schedule types and pricing authority are recorded in §J.1–J.2; the Founder still selects the applicable structure for each project.

**Refund and chargeback policy** explicitly out of scope: their **policy, execution, and provider-specific processing** are out of scope. Their **conceptual representation as auditable, append-only events** remains within the design scope. No refund authority, eligibility rules, amounts, tax rules or effects on activation are invented.

---

## A. Purpose and the gap being closed

This design gate defines the minimum internal model needed to reason about
**payments** and **project activation** for projects whose commercial
arrangement is captured by the existing accepted-proposal / signed-agreement
baseline, without selecting a provider, setting project-specific amount/currency
values, resolving policies that remain open, or authorizing implementation.

The platform has implemented, and merged, the commercial workflow up to agreement
signing:

- **Proposal acceptance** is an append-only, version-bound customer action recorded
  in `proposal_responses` (Customer Proposal Response, merged as PR #45). It is
  **application-level commercial evidence**, explicitly not a payment and explicitly
  not a signature. The decision behind it states that acceptance "does not create a
  payment obligation, schedule, or status" and is "not the commercial gate."
- **Agreement signing** is a separate, version-bound record with append-only
  signature evidence and immutable signed history (Agreement and E-Signature,
  merged as PR #48). Its "agreement completed" signal is a **derived, read-only**
  boolean computed from append-only rows, never a stored mutable field.

The next two links in the approved sequence — **required payment conditions
satisfied** and **project activated** — are **not implemented**. There is no record
of what a project owes, no evidence of what has been paid, and no activation event.
This design proposes the conceptual model for those two links.

It is written so a reviewer can challenge the model itself before any
implementation direction is chosen.

---

## B. Conceptual model

### B.1 Payment configuration as the anchored commercial baseline

A **payment configuration** is the internal representation of the commercial
baseline a project is currently being activated against. It is **not** a new
commercial event and **not** a replacement for the accepted proposal or the
applicable signed agreement.

A payment configuration is anchored to the **exact current** commercial baseline:

- it references the **exact current accepted proposal version**, and
- it references the **exact current applicable signed agreement version**.

For the activation predicate to be satisfied, the effective configuration version
under evaluation must reference **that exact current** accepted-proposal version
and **that exact current** applicable signed-agreement version.

A configuration also declares the set of **required obligations** that belong to
that configuration version. The activation predicate verifies that **all**
required obligations are members of the configuration version being evaluated,
not merely that some obligations exist somewhere.

A configuration is the internal artifact being evaluated for activation. It is not
claimed to be the current commercial source of truth for pricing or obligations;
it must be reconstructable from the current accepted proposal and the current
applicable signed agreement, and it can become stale as soon as either of those
changes.

A configuration becomes **stale** when the current accepted proposal version or
the current applicable signed agreement version changes after the configuration
was created. A stale configuration cannot satisfy the activation gate, because the
activation predicate requires the effective configuration to reference the exact
current versions. A stale configuration is therefore unusable as the evaluated
baseline; it is not rewritten, and it does not silently become current again.

A replacement configuration is represented as a **new** configuration version that
references the then-current accepted proposal version and then-current applicable
signed agreement version, with its own required-obligations membership. Older
configuration versions are preserved as historical records. Previously issued
obligations are not silently mutated. Payment evidence and payment history are not
rewritten to make an old configuration look current.

If the current accepted proposal or the current applicable signed agreement is
edited, replaced, superseded, or otherwise changed, the configuration that was
anchored to the previous versions becomes stale by definition. This is a
correlation rule, not an automatic business action: the model does not say what
happens next commercially. It only says a stale configuration cannot pass the
activation gate.

At the point of activation, the server-side activation operation must revalidate
this baseline: it must confirm that the configuration being evaluated still
references the exact current accepted proposal version and the exact current
applicable signed agreement version, and that all required obligations still
belong to that configuration version. Activation is not valid against a snapshot
taken earlier.

This is an approved design rule within the design gate. It does not decide amendment, cancellation, replacement, changes to an issued obligation, activation-trigger choice, or post-activation commercial behavior; those matters remain subject to the applicable separate decisions.

### B.2 Obligations (what must be paid)

A **payment obligation** is a unit of commercial requirement within the current
baseline that can be paid, allocated, and eventually satisfied or otherwise
resolved. It is internal accounting terminology, not a customer-facing term and
not necessarily the same as any customer-facing label.

Each immutable configuration version or immutable obligation record stores the
obligation's **expected monetary amount** and **currency** as the expected values
for that obligation. These are the values a payment must be compared against when
determining whether that specific obligation is satisfied. They are stored where
the obligation is defined, not reconstructed from unrelated records.

Obligations are identified by stable internal identifiers. The obligation identity
is separate from the payment evidence that may later satisfy it.

The set of obligations, their ordering, and the due schedule depend on the project structure the Founder selects from the three initial structures recorded in §J.2. The Founder sets the exact amount and currency per project as recorded in §J.1. This design does not invent monetary values or due dates. Project-level schedule timing, post-issuance edits, and the policy governing partial payments remain subject to the applicable explicit decisions.

This section deliberately does not define refund policy, partial-payment policy,
overpayment handling, late fees, taxes, retry policy, or anything that changes the
expected amount after issuance.

### B.3 Payments as evidence-backed events

A **payment** is not an amount floating freely in the system. A payment is an
event that is tied to evidence from the payment provider or reconciliation source
and that can be allocated against obligation(s).

The payment model has three related but distinct concepts, all internal:

- **payment attempt / transaction** — one attempt to move funds, with provider
  outcome, timestamps, and provider identifiers;
- **allocation** — the link between a payment and one or more obligations it is
  applied to, including how much of the payment is applied to each obligation;
- **refund / reversal** — a later event that returns funds or reverses a prior
  payment outcome, tied back to the original event where applicable.

These are separate concepts so the financial position can be reconstructed without
pretending that a single provider message magically satisfies an obligation.

Provider source evidence is the verified external record of **what the provider
reported**: provider identifiers, provider outcome, and provider timestamps. An
original provider payload may also arrive as external input, but receiving a payload
does not mean the complete payload is retained. This is the record that says **what
the provider reported**. It is distinct from the internal normalized payment record,
which is the internal representation derived from that evidence.

Default retention of provider evidence is limited to **verified, minimum-necessary
evidence fields** and a **stable source reference** sufficient for reconciliation and
traceability. Retaining a complete raw provider payload is not required by this
design. If such retention is ever justified, its necessity, access controls,
protected storage, and retention must be decided separately before it is introduced.
Do not choose a provider or invent a retention period.

Normalized business events are the internal records used for obligation/financial
reasoning. They are derived from, and traceable to, the provider source evidence,
but they are not a second independent claim about the provider outcome.

Do not copy raw provider payloads, credentials, or sensitive financial content into
the cross-cutting audit metadata. (See §H.)

`audit_events` remains identifier-only and must not contain raw provider payloads,
monetary amounts, currency values, credentials, or sensitive financial content.

### B.4 One authoritative source for payment/obligation state

This document proposes **one** authoritative internal record for derived
payment/obligation state, not two overlapping stores that can disagree.

The authoritative record is the append-only internal payment ledger of normalized,
evidence-backed payment events, with the derived obligation state computed from it
where needed. If the implementation later materializes derived obligation state for
performance, that materialized view is derived from the ledger and is not an
independent source of truth.

Provider source evidence and normalized business events may be stored separately
**only** when each normalized event explicitly references its supporting evidence
by stable identifier, so the chain of derivation is always reconstructable. When
they are stored separately, the normalized event must carry a reference to the
evidence record it was derived from. The evidence record is the source of truth for
**what the provider reported**; the normalized ledger is the source of truth for
**what the system has accepted as an internal payment event** for obligation and
financial reasoning.

This is proposed, not mandated. If the team instead chooses a single combined
append-only ledger containing both evidence and normalized event fields, that is
also acceptable, provided there is still exactly one authoritative source for the
derived state and no second store can claim a conflicting version of the same
outcome.

### B.5 Lifecycle semantics (distinct, not conflated)

The following are intentionally distinct concepts. They are not synonyms.

- **Prospect acceptance** — the customer accepted the current published proposal
  version. This is an agreement/commercial step, not a payment.
- **Agreement signing** — an applicable signed agreement version exists and is
  signed by the required party. This is an agreement step, not a payment.
- **Payment** — provider evidence supports that funds moved (or an attempt was
  made). This is a payment event.
- **Activation** — the internal activation predicate is satisfied and the
  activation event is recorded. This is an internal gate, not a provider callback,
  and not an automatic consequence of acceptance or signing.

Do not use these interchangeably in the document or in any later implementation
discussion.

Also distinct: a **payment attempt outcome**, the **aggregate paid/outstanding
financial position**, and the **obligation state**. A failed payment attempt is an
attempt outcome. It is not an obligation state, and it does not by itself mean the
obligation has permanently failed or been satisfied.

### B.6 Audit boundary

Cross-cutting `audit_events` is an **identifier-only** metadata store. It stores
permitted identifiers, event type, and necessary enum states only.

`audit_events` does **not** store:

- monetary amounts,
- currency values,
- provider payloads,
- raw credentials,
- or any other sensitive financial content.

Those values and the verified evidence remain in the appropriate protected domain
records, not duplicated in audit metadata.

Audit records must remain transactionally coupled to the material writes they
describe, so an accepted event, its derived obligation state if materialized, and
its audit entry are consistent.

### B.7 Customer-facing stages are unchanged by this model

This model is internal. It does not introduce, remove, or alter
`customerStageFor` or any customer-facing stage. Agreement states, project intake
states, and the existing mapping to customer-facing stages remain as they are. Any
later customer-facing change would be a separate decision.

---

## C. Payment obligations, schedules, and lifecycle (approved design; candidate states remain open)

### C.1 What the requirements already allow

The requirements allow several possible commercial structures for what a project owes and when. The Founder has decided that the initial design supports these three structures; this does not choose one for any particular project or invent monetary values or due dates.

The initial supported structures are:

- full amount up front;
- a deposit plus later payments;
- milestone-linked payments tied to approved scope or milestone versions.

The Founder selects the applicable structure for each project and sets its amount and currency. Due timing, whether obligations can be edited after issuance, and other commercial policies remain subject to their applicable decisions. Any additional payment structure requires separate Founder approval.

### C.2 What can stay configurable and provider-neutral

- The **set of obligations** and their ordering are derived from whichever structure
  the Founder approves; the model does not hard-code a schedule shape or a fixed
  number of installments.
- Obligations reference **scope/milestone version identifiers** rather than embedding
  amounts, so milestone-linked schedules work without schema assumptions about money
  or milestone shape.
- The model is provider-neutral: an obligation and its evidence carry **opaque
  provider references**, never a chosen provider's field names.
- Amounts and currencies are stored where the obligation is defined. They are not
  reconstructed from unrelated records, and they are not adjusted by the system
  without an explicit Founder-approved policy.

### C.3 Candidate obligation states (approved design; states remain candidates)

These are **proposed** internal obligation states with distinct semantics. They are
not agreement states, not customer-facing terms, and not a finalized policy. States
are illustrative of separate concerns, deliberately not collapsed.

| State | Proposed meaning | Transition evidence required |
| --- | --- | --- |
| `proposed` | Obligation exists as part of a configuration version, not yet payable/relevant in the active flow. | Configuration modeling only; no payment status implied. |
| `due` | Obligation is currently expected to be paid. | Baseline schedule/trigger says it applies now. |
| `partially_paid` | Some allocated payment exists, but the obligation is not yet fully satisfied. | Partial payment allocated; remaining balance still owed by the obligation. |
| `paid` | Obligation has been satisfied by allocated payment evidence. | Allocation + evidence satisfy expected amount/currency per the relevant Founder decision. |
| `disputed` | The obligation is contested; no payment-relevant conclusion is assumed here. | Unresolved Founder decision what this implies. |
| `reversed` | A prior satisfied obligation is reversed by a refund/reversal that the model treats as removing that satisfaction. | Reversal outcome; distinct from "refunded". |

There is **no `failed` obligation state** in this design. `failed` is a
**payment-attempt outcome**, not an obligation state. Section C.4 and the
unresolved-decisions list in this design make that explicit and remove the
remaining contradiction from the prior draft.

Candidate states above overlap in naming with payment-attempt outcomes and with
refund/reversal concepts. That is exactly what this section is flagging. Do not
merge them.

In particular:

- A **payment attempt** can be `successful`, `failed`, `pending`, `errored`, or
  whatever the provider/reconciliation evidence supports. That is an **attempt
  outcome**, not an obligation state.
- An **obligation** can be `due`, `partially_paid`, `paid`, `disputed`,
  `reversed`, or unresolved in some later-defined way.
- The **aggregate financial position** is the sum of allocations relative to
  expected amounts, tracked per obligation and across obligations; it is a derived
  view, not a magic field on the attempt.

If an obligation is disputed, that does not by itself mean the payment did not occur
or that the obligation is "failed". If a payment attempt failed, that does not by
itself mean the obligation is satisfied or permanently failed. The attempt outcome
and the obligation state are distinct columns in the model.

Retry limits, retry scheduling, dunning, notifications, and any "give up" policy are
unresolved Founder decisions, not part of this lifecycle.

### C.4 What requires Founder approval here

The **choice of structure per project**, the **currency/unit**, the **amounts**, the
**schedule/trigger logic** that moves an obligation into `due`, whether an obligation
can be edited after issuance, and whether late or failed obligations block anything are
all Founder decisions. The design holds the model open for each of them without
presuming an answer.

---

## D. Payment evidence and reconciliation (provider-neutral)

### D.1 Evidence types, conceptually

The model is provider-neutral. It does not depend on one provider's webhook schema,
one provider's reconciliation API, or one provider's certainty semantics.

Evidence can come from different sources with different certainty:

- provider webhook/callback;
- provider API pull/reconciliation;
- internal reconciliation with the provider's reported outcome;
- customer-uploaded or manually recorded evidence where allowed (if ever).

Each evidence record is identified by its source and its provider/source identifiers.
Evidence is verified before it is used to support a payment event. A provider callback
is not automatically trusted as authoritative without verification within the
system's own boundary.

This document does not require a specific verification mechanism; it requires that
the rule exist.

### D.2 Comparing evidence to the obligation

Before a payment can count as confirming payment against an obligation, the payment
evidence amount and currency are compared to **that specific obligation's** expected
amount and currency.

That is:

- the obligation defines expected amount and currency;
- the payment evidence defines amount and currency as reported by the provider or
  reconciliation source;
- the system compares the two before treating the payment as allocated to that
  obligation.

The system does **not** match payments to obligations by amount alone, by order alone,
or by proximity in time alone. Allocation is explicit.

### D.3 Attempts, allocations, and refunds

- A **payment attempt** is one provider/reconciliation outcome. It may succeed, fail,
  or be pending.
- An **allocation** applies part or all of a successful payment to one or more
  obligations, with explicit amounts per obligation.
- A **refund/reversal** is a separate later event, tied to the original payment where
  applicable. It can be partial or full.

No amount or financial detail is stored in identifier-only audit metadata.

Original payment evidence and original refund/reversal evidence are preserved as
append-only history. A refund does not erase the original payment record; it adds a
reversible record that can be traced back.

### D.4 Partial payments and partial refunds

A partial payment is a payment whose allocated amount is less than the obligation's
expected amount. It leaves the obligation in a not-fully-satisfied state, for example
`partially_paid` if that state is adopted.

A partial refund is a refund whose amount is less than the originally allocated amount.
It does **not** mean the entire obligation is refunded.

The `refunded` state, if used, must be defined so a partial refund cannot be mistaken
for a complete refund of the obligation. In this design, the safe approach is to keep
refund as an event and amount relative to the specific allocation or obligation, and to
avoid using a single boolean `refunded` that implies complete satisfaction reversal
unless the exact meaning is stated.

Impact of partial payments and partial refunds on obligation satisfaction remains
dependent on an explicit Founder-approved policy. This document does not invent that
policy.

If additional records are needed per concept (one record per attempt, one per
allocation, one per refund), that is allowed if justified. If a concept can be
represented without a separate record, say so. The guiding rule is reconstructability
and no conflicting duplicate source of truth.

### D.5 Idempotency and deduplication

The model must be able to receive the same external event more than once. Repeated
delivery must be handled by idempotent processing keyed on a provider/source event
identifier, so a duplicate is recognized and does not create a second payment event or
a second allocation that double counts.

The deduplication scope is the provider/source event identity for that evidence source.
Internal normalized events may be deduplicated against already-accepted external
evidence.

This does **not** mean "last write wins" silently. If the same provider event is
received again, the system should recognize the prior accepted outcome and not rewrite
it. If different evidence conflicts with prior accepted evidence, that is a
reconciliation conflict to be handled explicitly, not by overwriting earlier records.

**Concurrency controls:** the system must prevent replay or duplicate processing of
the same payment event/allocation, and prevent the same funds from being counted
more than once. Allocation limits apply **per individual transaction**: for each
verified transaction, the total of all allocations attributed to that transaction
must not exceed that transaction's verified available funds, and no portion of the
same funds may be allocated more than once. The system must track which portions of
each transaction have been allocated and ensure that re-allocation of
already-allocated funds is rejected.

**Permit multiple legitimate allocations and partial payments:** multiple legitimate
allocations and partial payments against an outstanding obligation are permitted
where the approved policy allows them. A single obligation may receive allocations
from multiple transactions, and a single transaction may be allocated across multiple
obligations, up to the verified amount of each transaction and the remaining balance
of each obligation. Partial payments that fall short of the full expected amount are
permitted where the approved policy allows them, and the remaining balance is
carried forward.

**Prevent duplicate project-activation records:** project activation must be gated on a derived "obligations-satisfied" signal that is computed from the immutable rows, never stored as a mutable project field. The activation predicate in §F.2 requires every required obligation to be satisfied against its own expected amount and currency. The "obligations-satisfied" signal must reflect that per-obligation evaluation: it becomes true only when each required obligation has been individually evaluated against its own expected amount, expected currency, and remaining balance, and satisfied under the applicable approved policy. A project-wide aggregate must not substitute for checking every required obligation. Allocation limits are enforced per individual transaction: the allocations attributed to each verified transaction must stay within that transaction's verified available funds, with no replay or double-counting of any portion. A single obligation may receive legitimate allocations from multiple transactions where the approved policy allows them, and legitimate partial payments with per-obligation remaining balances remain representable. The signal is a read-only commercial gate/condition, never a command, and duplicate activation records must be prevented independently of payment allocation controls.

### D.6 Delayed, duplicated, out-of-order, conflicting events

- Delayed events: accepted if they are within the system's reconciliation/temporal
  rules, and correlated to the correct obligation/version. No silent mutation of earlier
  records.
- Duplicated events: deduplicated, as above.
- Out-of-order events: applied in a way that preserves the append-only history and does
  not erase prior attempts. Later events do not rewrite earlier ones.
- Conflicting events: flagged for reconciliation. The earlier accepted record is not
  silently overwritten. Reconciliation outcome is itself recorded.

Transactional consistency: an accepted payment event, any derived obligation state (if
materialized), and its audit entry must be written in a consistent transaction so the
system does not end up with an accepted event and no corresponding audit entry, or an
audit entry with no accepted event.

---

## E. Failed, reversed, disputed, and refunded payments (outcome model, no policy invented)

This section explains lifecycle outcomes **without inventing business policy.** Each
item names the decision the Founder must make; none is resolved here.

### E.1 Failed or abandoned attempts

A failed payment attempt records a `failed` **attempt outcome** and leaves the
obligation in whatever state the model defines for not-yet-satisfied obligations. It
does not, by itself, change the obligation into a `failed` obligation state, because
this design does not have one.

Whether a customer may **retry**, how many times, and whether repeated failure blocks
anything are Founder decisions. The design only requires the failure be recorded as an
attempt outcome, not silently dropped.

### E.2 Duplicate or delayed confirmations

Handled by idempotency and derived state (§D.5, §D.6). A delayed confirmation that
arrives after another determination must be **reconciled**, not allowed to silently
overwrite; the reconciliation outcome is a recorded event.

### E.3 Reversals / chargebacks after apparent success

A reversal is a **new forward event** tied to the original payment where applicable,
with its own evidence; the original payment record is never edited. Whether a reversal
re-opens an obligation, blocks further work, or is purely financial is a Founder
decision. It is not automatic.

### E.4 Full and partial refunds

A refund is a forward event; **partial refunds** are recorded as distinct evidence
against the same allocation or obligation so the net position is reconstructable. Refund
authority, partial-refund policy, and historical treatment are Founder decisions. No
refund is modeled as automatic.

### E.5 Retry and reconciliation procedures

Reconciliation is the process of matching provider/manual evidence to obligations and
recording the outcome. Its cadence, authority, and how disputes are escalated are
Founder operational decisions. They are not encoded here.

### E.6 Effect on projects already activated — and no automatic deactivation

**This design introduces no deactivation path.** Consistent with the agreement track's
boundary that a later commercial event must not, by itself, deactivate or rewrite
historical evidence for an already activated project, a payment reversal, refund, failed
attempt, or later commercial event likewise **must not silently trigger deactivation or
rewrite historical evidence.**

The effect of such an event on an activated project requires an **explicit
Founder-approved policy**, not an automatic side effect. The proposed model therefore
keeps **activation** (append-only, §F) and **payment status** (derived, §B.4) as
separate auditable concerns: a later payment event changes payment status; it does not,
by itself, change activation.

If the Founder someday wants a deactivation or suspension concept, it is a
**separate, explicit decision** — not a side effect of this design.

---

## F. Activation predicate (candidate)

### F.1 Activation as an internal gate

Activation is an internal event recorded when the activation predicate is satisfied. It
is not the same as acceptance, not the same as signing, and not a provider callback.

### F.2 Candidate activation predicate (candidate; conditions and trigger open per §J.9)

1. The project's **current accepted proposal version** is the exact version referenced
   by the effective payment configuration version being evaluated.
2. The project's **current applicable signed agreement version** is the exact version
   referenced by the effective payment configuration version being evaluated.
3. The effective payment configuration version's required obligations are exactly the
   obligations that belong to that configuration version, and all required obligations
   are present in that version.
4. The required obligations are satisfied according to the relevant payment, allocation,
   and evidence rules, compared against each obligation's expected amount and currency.

A configuration that references a stale accepted proposal or stale applicable signed
agreement does not satisfy (1) or (2), and is therefore not eligible for activation.

A configuration whose required-obligations set is incomplete or mismatched does not
satisfy (3).

An obligation that is due but not satisfied does not satisfy (4). A failed payment
attempt does **not** by itself satisfy or void an obligation; it is an attempt outcome.
Retry policy, dunning, and how many attempts are allowed are unresolved Founder
decisions and are **not** encoded here.

The activation predicate is evaluated against the validated current references and
required obligations at evaluation time. The server-side activation operation revalidates
this baseline at the point of activation, as described in §B.1.

If the predicate is satisfied, the activation event is written atomically together with
the validation context and its audit entry. If not, no activation event is written and no
activating consequence occurs.

This predicate does not say what happens after activation. It only says what must be true
before the activation event can be recorded.

### F.3 Repeated evaluation, duplicates, concurrency, traceability

- **Repeated evaluation is safe.** Because the activation record is append-only with a
  one-per-project guard, re-evaluating the predicate after activation is a no-op, not a
  second activation.
- **Duplicate triggers** are absorbed by the same guard plus an idempotency key.
- **Concurrent changes:** the predicate is evaluated and the activation written **inside
  one transaction**, so a concurrent new proposal acceptance, new agreement version, or
  new obligation cannot interleave to produce a partial activation; the snapshot is
  consistent.
- **Historical traceability:** because activation references the exact proposal/agreement
  /obligation identifiers, a later reader can reconstruct precisely what was true at
  activation — even though the derived "agreement completed" signal or payment state may
  since have changed.

### F.4 Automatic activation — how it could be safe, without authorizing it

This design notes, **without authorizing or building it**, that a future automatic
activator would have to: evaluate the predicate server-side only; write the activation
atomically with its evidence; be idempotent under retries; never trust a client-supplied
trigger; and never run in production until the applicable Founder decisions and production
gates are approved. **This design authorizes none of that.**

---

## G. Authorization and audit

### G.1 Proposed permissions (no new customer capabilities)

| Action | Proposed actor | Rationale |
| --- | --- | --- |
| Payment **configuration** create/amend | Founder/internal capability only | Commercial/monetary configuration is Founder authority. |
| Manual obligation determination (mark satisfied / adjust) | Founder/internal capability only, least-privileged | Highest misuse risk; never a customer capability. |
| **Customer-visible payment status** read | Authorized customer with project access | Read-only status through existing project access. A customer may see what is owed/paid, never edit it. |
| **Activation** (future automatic or manual) | Server-authoritative decision; manual override Founder-only | Must never be a client-supplied command. |

**No customer role may mark an obligation as paid.** This design grants customers **no
new write capability**; customers can at most read their own payment status through the
existing project-access authorization.

### G.2 Project isolation and the caller-supplied-identifier rule

The existing pattern is that a caller-supplied identifier is **never** proof of access:
a reference is resolved **within the caller's organization** and then access is checked
server-side before any internal project id is used. Payment and activation operations
reuse exactly this pattern: a reference is resolved and access re-checked server-side on
**every** read and write.

A customer cannot reach another project's payment configuration, obligations, evidence, or
activation record by supplying an id or reference they were never granted. Authorization
is not delegated to the caller.

### G.3 Founder/internal authority stays distinct from customer authority

Internal payment operations belong on the **internal surface**, authorized against the
dedicated internal capability attached to a Person — never a customer route with hidden
controls. Internal payment/activation fields are internal-only and never leak into
customer projections.

### G.4 Actor, preconditions, evidence, failure handling (per material transition)

For **configuration**, **obligation issuance**, **evidence append / state change**,
**manual determination**, and **activation**:

- the actor is named (Founder/internal capability, authorized customer read, or trusted
  reconciliation process);
- the preconditions are named (baseline versions current, access re-checked, predicate
  satisfied for activation);
- the identifier-only audit evidence is named (type, actor, project, timestamp,
  identifier metadata);
- the failure handling is named (reject and record nothing partial, as in the
  atomic-write patterns already used).

Details are elaborated per slice in §I.

### G.5 Audit integrity

Every material transition appends an identifier-only `audit_events` row (type, actor,
project, timestamp, identifier metadata) **in the same transaction** as the state change
it describes — matching the existing contract where the audit append and the record write
succeed or roll back together.

---

## H. Security, privacy, and operational boundaries

- **Least privilege:** only the Founder/internal capability configures payments or makes
  manual determinations; customers get read-only status through existing access checks.
- **Minimal stored evidence:** store obligation linkage, evidence-source kind, opaque
  provider references, and derived state — **never** raw card numbers, security codes,
  banking credentials, or provider secrets.
- **Secret handling:** any future provider secret lives only in server-side environment
  configuration, never in application records or this public repository.
- **Audit integrity:** append-only events plus transactional coupling to state changes;
  no in-place edits to evidence.
- **Minimal evidence collection:** collect only what is needed to reconstruct why an
  obligation was considered satisfied and who or what determined it. Do not hoard raw
  provider payloads into cross-cutting metadata.
- **Retention:** payment-evidence retention is **not** decided here; no retention period is
  invented. It is left as an unresolved decision.
- **Reconciliation & failure recovery:** derived state from append-only events allows
  reconstruction after partial failures; reconciliation is idempotent.
- **No compliance claim:** this design makes **no** legal or regulatory-compliance claim
  (PCI, tax, consumer-protection, etc.). Provider-specific security requirements and legal
  obligations remain for later legal/security review.

---

## I. Implementation and verification contract (proposed, not implemented)

This is the **proposed** smallest later sequence. **Design approval ≠ implementation
approval.** Nothing here is implemented by this document, and no first implementation may
process real payments or activate live projects until the applicable business decisions
and production gates are approved.

Each slice is a thin vertical slice with its own acceptance criteria, delivered
provider-neutrally against synthetic data first:

1. **Payment configuration + obligations (provider-neutral, no real money).**
   *Criteria:* Founder-only configuration create/amend with immutable baseline
   references; obligation issuance; authorization tests (customer cannot configure);
   project-isolation tests (IDOR regression restated, one project cannot reach another's
   payment data); audit tests (identifier-only events); regression tests proving
   proposal/agreement/stage behavior unchanged.

2. **Payment evidence + obligation state machine (still synthetic).**
   *Criteria:* append-only evidence; derived obligation state; amount/currency comparison
   against the specific obligation; idempotency under duplicate events; atomic
   evidence+state+audit writes (transaction tests); one-satisfaction guard under
   concurrency; no overwrite of earlier evidence.

3. **Customer read-only payment status.**
   *Criteria:* authorized-customer read; project isolation (cannot read another project's
   status); no new customer write capability; internal fields never exposed.

4. **Activation predicate + activation record (manual Founder trigger first, not
   automatic).**
   *Criteria:* predicate gating tests (each of the four conditions, including stale
   accepted-proposal/baseline rejection); stale signed-agreement-baseline rejection;
   required-obligations membership enforcement; one-activation guard; atomic
   activation-with-evidence; historical traceability test; regression proving
   `customerStageFor` and stages unchanged; no automatic deactivation path introduced.

5. **(Later, only after the applicable founder decisions + production gates) provider
   integration and/or automatic activation.**
   *Criteria:* provider verification (never trusting callbacks blindly); replay/forgery
   protection; production gating; no live activation until explicitly authorized.

**Cross-cutting and regression checks across all slices:** agreement
creation/publication/signing, stale-baseline rejection, idempotency/replay, transaction
consistency, audit integrity, proposal acceptance, and `customerStageFor` stage
derivation must all continue to pass unchanged.

---

## J. Founder decisions — resolved and outstanding

This is the live register of Founder decisions. **J.1 and J.2 are resolved** by Founder approval recorded on 2026-10-16 and are summarised below. **J.3–J.12 remain unresolved**; they must not be silently decided by this design or by an implementation agent. Each row records the question, why it matters, decision/options, consequences/risks, what can be designed now, and what remains blocked.

| # | Decision question | Why it matters | Options (where supported or defensible from existing direction) | Consequences / risks | Designable now without deciding | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| **J.1** | Pricing and commercial authority. | Sets what is owed and who may set it; this is a material business decision reserved to the Founder. | **Resolved — Founder approval recorded 2026-10-16:** Founder sets the amount and currency per project; no public pricing catalogue or automatic pricing. | Under/over-pricing; unauthorized discounts. | Founder-entered per-project amount/currency fields anchored to the applicable commercial baseline. | Does not block the initial configuration/obligation slice once separately authorized; production use remains gated by other decisions. |
| **J.2** | Payment schedule & permitted arrangements. | Determines obligation structure per project. | **Resolved — Founder approval recorded 2026-10-16:** initial supported structures are full upfront, deposit plus later payments, and milestone-linked payments. Any additional structure requires separate Founder approval. | Rigid model vs. unsupported flexibility. | Provider-neutral configuration and obligations covering the three initial structures; the Founder selects the structure per project. | Does not block the initial configuration/obligation slice once separately authorized; additional structures and later slices remain gated as applicable. |
| **J.3** | Authoritative payment evidence and its verification. | The core of the activation predicate and obligation satisfaction. | Candidate sources: provider confirmation after verification; verified reconciliation; authorized manual record. This design does not declare any source authoritative. | Trusting the wrong source; fraud; double-satisfaction. | Evidence model with source kind + idempotency, source-agnostic. | Payment-evidence/state-machine slice, provider activation, production use; not the initial configuration/obligation-only slice. |
| **J.4** | Failed payments, retry policy, retry limits, dunning, and notifications. | Affects customers and whether failure blocks progress. | Not enumerated — Founder defines retries, retry limits, dunning, and customer notification. | Lost revenue vs. customer friction; silent "give up" behavior if left implicit. | `failed` as a payment-attempt outcome only; recorded failure events; no obligation-state meaning invented. | Payment-attempt/retry/notification behavior and production payment use; not the initial configuration/obligation-only slice. |
| **J.5** | Reversals, chargebacks, and disputes. | Post-success events that can undo confirmed payments. | Not enumerated — Founder defines handling, escalation, and whether reversal changes what "satisfied" means for an activated project. | Financial loss; disputed activated projects; conflicting evidence. | Forward-only reversal events; no auto-deactivation; reconciliation recorded as an event. | Reversal/chargeback/dispute behavior and production use; not the initial configuration/obligation-only slice. |
| **J.6** | Full and partial refunds — authority, policy, and historical treatment. | Who may refund, whether partial refunds are allowed, and how they are recorded. | Not enumerated — Founder defines authority and policy. This design keeps refund as an event with an amount, and makes sure a partial refund cannot be mistaken for a complete refund. | Unauthorized refunds; unclear net position. | Partial-refund evidence model as forward events; no invented refund policy. | Refund handling and production use; not the initial configuration/obligation-only slice. |
| **J.7** | Tax treatment and responsibilities. | Collection, recording, and jurisdiction. | Not enumerated; the requirements defer taxes. | Non-compliance exposure (a legal matter, not designed here). | Amount/unit fields left Founder-defined; no tax logic invented. | Tax-related payment processing and production use; not the initial configuration/obligation-only slice. |
| **J.8** | Payment-provider selection and activation. | Determines the real integration and the trust boundary. | Not selected; design stays provider-neutral with opaque provider references. | Vendor lock-in; security posture; verification burden. | Opaque provider references; provider-neutral evidence model. | Provider activation, production use. |
| **J.9** | Exact project-activation conditions and their trigger. | The precise predicate and whether activation is automatic or manual. | Requirements allow the trigger to vary by approved commercial configuration. This design offers a four-condition candidate predicate and a manual-trigger-first plan. | Wrong gating; premature or late activation. | Four-condition predicate as a **candidate**; manual-trigger-first implementation plan. | Activation implementation and production activation; not the initial configuration/obligation-only slice. |
| **J.10** | Who may make or override a manual payment-status determination. | Manual marks are the highest-misuse path. | Not enumerated — Founder defines the authorized actor(s). | Misattribution; fraud. | Founder-only, least-privileged, audited manual-determination model. | Any manual payment-status determination or override; not the initial configuration/obligation-only slice. |
| **J.11** | Retention and treatment of payment evidence. | How long evidence is kept and how it is protected. | Not enumerated; mirrors the agreement track's deferral of retention. | Over- or under-retention. | Append-only evidence with retention left undefined. | Production evidence retention/use; not the initial configuration/obligation-only slice. |
| **J.12** | Policy for payment events after activation. | Reversal/refund/failed event after a project is live — must not silently deactivate or rewrite history. | Not enumerated — Founder defines the explicit policy. | Silent deactivation risk if left implicit. | Separate activation (append-only) from payment status (derived); **no** deactivation path. | Any defined post-activation response policy and production use; not the initial configuration/obligation-only slice. |

### Initial slice readiness and remaining blockers

The Founder decisions in J.1 and J.2 are resolved as of 2026-10-16. A first **provider-neutral Payment Configuration + Obligations** implementation slice may be considered for separate implementation approval, limited to synthetic/test data. Its scope should be Founder-only creation/amendment of configuration versions, per-project amount/currency inputs, obligation issuance for the three supported schedule structures, and tests for current-baseline binding, authorization, project isolation, immutability, and identifier-only transactional audit.

That initial slice must exclude payment evidence ingestion or verification, real payment attempts, retry/refund/reversal/dispute handling, provider integration, customer payment UI, activation records or triggers, deployment, and all live customer-data processing. This paragraph is a readiness assessment, **not implementation authorization**.

The remaining Founder decisions block the relevant later slices:
- **J.3** must be resolved before implementing authoritative payment evidence and payment-state transitions.
- **J.4–J.7** must be resolved before implementing the applicable retry/failure, reversal/dispute, refund, or tax-related payment behaviors.
- **J.8** and the applicable security review must be resolved before provider integration or activation.
- **J.9** must be resolved before implementing project activation or its trigger.
- **J.10** must be resolved before any manual payment-status determination or override is built.
- **J.11** must be resolved before production payment-evidence retention/use.
- **J.12** must be resolved before defining post-activation payment-event behavior or any future suspension/deactivation concept.
- Production use additionally requires applicable legal/security review, retention/deletion decisions, production gates, and separate explicit Founder authorization.

**Technical-safety note (not a business decision):** keep activation **append-only and
forward-only**, and keep payment status **derived from append-only events**, so that no
later payment event can silently rewrite history or deactivate a project. The business
policy for what that means after activation remains J.12.

---

## K. Proposed boundaries (non-implementation)

This section is deliberately non-implementation. It records proposed boundaries so later
work does not accidentally expand scope.

Implementation excluded here:

- no payment provider integration,
- no provider webhook handler,
- no payment schema,
- no payment migration,
- no payment routes,
- no payment services,
- no payment UI,
- no payment tests,
- no activation implementation,
- no activation UI,
- no customer-facing stage change,
- no change to agreement behavior,
- no change to `customerStageFor` output,
- no automatic activation built or authorized now,
- no manual activation built or authorized now,
- no actual project-specific amount or currency value, tax, fee, refund, chargeback,
  retry, dunning, or post-activation policy is set by this document.
- the three initial schedule structures and per-project pricing authority are recorded
  in §J.1–J.2; the applicable structure remains Founder-selected per project.

Also excluded: deployment, provider activation, live customer data, and any commercial
policy not already explicitly identified as unresolved.

### K.1 Status, approval, and production-use separation

The following are separate, sequential gates. Passing one does **not** pass the next:

1. **Design approval** — this document, reviewed and approved as a design by the Founder.
2. **Implementation approval** — separate approval to build any slice at all.
3. **Business/policy approval** — the unresolved decisions in §J resolved before the
   relevant slice can be meaningful.
4. **Provider selection and activation** — only after J.8 and the applicable security
   review.
5. **Production use** — only after all applicable gates, including production gating and
   no live activation until explicitly authorized.

This document satisfies gate 1: the design was approved by the Founder on 2026-10-16.
J.1 and J.2 are resolved for the initial provider-neutral configuration/obligation
slice. Gate 2 (implementation approval), applicable later business/policy gates,
provider selection/activation, and production use have **not** been approved. This
status statement does not authorize implementation.

---

## L. Implications for the current codebase (factual, not a design decision)

This section records factual context only. It is not approval of any design.

The codebase currently has:

- a customer proposal surface that returns the current published proposal version for a
  project the customer may access, and treats "no published proposal" and "only drafts"
  as indistinguishable to the customer (`website/lib/platform/customer-proposals.ts`);
- an audit-events table used as a cross-cutting identifier-only metadata store
  (`website/lib/platform/sqlite-store.ts`);
- existing proposal and agreement lifecycle and state concepts in the
  agreement/e-signature track.

These are cited as context for the proposed model, not as endorsement.

---

## M. What this document does and does not do

**It does:**

- propose a provider-neutral conceptual model linking the merged proposal/agreement
  workflow to the future payment/activation stage;
- preserve the five review corrections already delivered on this PR;
- preserve the existing boundaries: approved sequence, version-bound baselines, separate
  payment versus activation concerns, project-scoped authorization, identifier-only
  transactional audit, and no change to `customerStageFor` or agreement behavior;
- introduce **no** deactivation path, and state that a later payment event cannot silently
  reverse activation;
- record J.1 and J.2 as resolved by Founder approval on 2026-10-16 and leave J.3–J.12 unresolved until separately decided.

**It does not:**

- select or activate a provider;
- set any actual project-specific amount or currency value, taxes, refunds, charges,
  retries, dunning, or other unresolved payment policy; pricing authority and the
  initial supported schedule structures are recorded in §J.1–J.2;
- authorize deployment, production use, or live customer-data processing;
- change `customerStageFor`, customer-facing stages, or existing agreement behavior;
- introduce any automatic activation or automatic deactivation;
- claim legal validity or regulatory compliance;
- answer any question in §J on the Founder's behalf.

---

## Appendix: edits relative to the prior drafts on this PR

**Relative to the original PR #50 draft (`8c8fb26`):**

The original draft had more sections than the immediately preceding revised version: a
status note and status section; a problem/scope section with the five-concept table and
in/out scope; a proposed domain-model section with named conceptual records
(`project_payment_configuration`, `payment_obligation`, `payment_evidence`, `payment_event`,
`project_activation`) and the relationship to the existing audit store; a payment
schedules and obligations section; a richer candidate lifecycle; a fuller evidence and
reconciliation section; a dedicated failed/reversed/disputed/refunded section with an
explicit no-automatic-deactivation statement; an exact activation predicate section with
repeated-evaluation, concurrency, and traceability notes plus a non-authorization note on
automatic activation; an authorization and audit section covering permissions, project
isolation and the caller-supplied-identifier rule, founder/internal authority separation,
actor/preconditions/evidence/failure handling, and audit integrity; a security/privacy and
operational boundaries section; an implementation and verification contract section; a
detailed Founder-decision table; and separate consequences, boundaries/exclusions, and
status conclusions.

This revision restores that substance as the authoritative content of this document, while
keeping the five corrections delivered in the prior revision.

**Relative to the immediately preceding revised version (`e71f43f`):**

- The document is reorganized so the restored sections are present and coherent with the
  five corrections, rather than omitted.
- Authorization and audit are restored as §G, including Founder/internal versus customer
  authority, project-specific access checks on every operation, the rule that
  caller-supplied project identifiers do not prove authorization, actor/preconditions/
  evidence/failure handling for material transitions, and transactional coupling between
  domain writes and audit records.
- Security, privacy, and operational boundaries are restored as §H, including least
  privilege, minimal evidence collection, secret handling, retention left unresolved,
  reconciliation and failure recovery, and no unsupported compliance claim.
- Implementation and verification contract is restored as §I, with a staged future
  sequence, explicit acceptance criteria, and planned tests for authorization, project
  isolation, idempotency/replay, transaction consistency, audit integrity, activation
  gating, stale baseline rejection, concurrency, and regressions, plus the separation
  between design approval, implementation approval, provider activation, and production use.
- A detailed Founder-decision table (§J) is restored, covering pricing and commercial
  authority; payment schedules; authoritative payment evidence; failed payments/retries;
  reversals/chargebacks/disputes; full and partial refunds; tax treatment; provider
  selection/activation; exact activation conditions; manual payment-status authority; evidence
  retention; and post-activation payment-event policy, each with question, why it matters,
  supported options, consequences/risks, what is designable now, and what it blocks.
- The failed-state contradiction is removed: `failed` is no longer a candidate obligation
  state, is defined as a payment-attempt outcome only, is absent from the lifecycle table
  as an obligation state, and the unresolved-decisions list no longer asks whether `failed`
  should be an obligation state. All examples, summaries, cross-references, and the appendix
  express the same model.
- The lifecycle-table note `Configuration/obstacle modeling only` is corrected so it reads as
  a plain descriptive note about the `proposed` state rather than as a typo-like fragment.

**What was deliberately not restored:**

- No obsolete statements or old contradictions were restored just to match the earlier text.
- No superseded wording that conflicted with the five corrections was preserved.
- No implementation, schema, route, service, UI, or test was added or changed.
- No provider was selected, no project-specific price/currency value or unresolved
  payment policy was set, and no legal conclusion or unapproved Founder decision was added.

No implementation, schema, route, service, UI, or test was added or changed.
