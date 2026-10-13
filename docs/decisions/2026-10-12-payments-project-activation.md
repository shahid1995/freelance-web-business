# Payments and Project Activation — Design Gate

Status: **Draft — pending Founder review. Not approved for implementation.**
Author: product/design review
Date: 2026-10-12
Supersedes: none
Related: agreement/e-signature design gate (separate track); PR #50 branch `docs/payments-project-activation-design`

---

## 0. Status and scope (authoritative, read first)

This is a **proposal only**. It is not approved, not accepted, not signed off, and
does not authorize implementation, production use, provider onboarding, migration,
schema change, route addition, UI work, or any customer-visible behavior. It does
not choose a payment provider, pricing, currency, tax treatment, refund policy,
retry/dunning policy, or any post-activation consequence.

Nothing in this document changes the current commercial baseline, the current
accepted-proposal behavior, the current signed-agreement behavior, agreement
states, customer-facing stages, or `customerStageFor` and the resulting
customer-facing stage output. Any future implementation would require separate
approval and, where relevant, separate decisions.

All draft framing here must remain draft until a Founder explicitly approves it.

---

## A. Purpose

This design gate defines the minimum internal model needed to reason about
**payments** and **project activation** for projects whose commercial
arrangement is captured by the existing accepted-proposal / signed-agreement
baseline, without committing the repository to any provider, price, policy, or
implementation.

It is written so a reviewer can challenge the model itself before any
implementation direction is chosen.

Issue: we do not yet have a shared, coherent internal definition of which
commercial facts are authoritative for activating a project, how a payment is
known to exist, how an obligation is known to be satisfied, and how those facts
are recorded so that financial position can be reconstructed without inventing
policy.

Desired outcome: a single, provider-neutral draft model that distinguishes the
commercial baseline, the payment evidence, the obligation state, and the audit
boundary, and that states clearly what is left as an unresolved Founder decision.

Out of scope for this doc: provider integration, fees, taxes, refunds,
chargebacks, dunning, retry policy, invoicing style, receipts, ledger export,
and any consequence of activation.

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

This section is a proposed design rule, draft and subject to Founder review. It
does not decide amendment, cancellation, replacement, price changes, currency
changes, obligation changes, or post-activation commercial behavior.

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

This section deliberately does not define refund policy, partial-payment policy,
overpayment handling, late fees, taxes, or anything that changes the expected
amount after issuance.

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

Provider source evidence is the verified external record: provider identifiers,
provider outcome, provider timestamps, and provider payload as received. This is
the record that says **what the provider reported**. It is distinct from the
internal normalized payment record, which is the internal representation derived
from that evidence.

Normalized business events are the internal records used for obligation/financial
reasoning. They are derived from, and traceable to, the provider source evidence,
but they are not a second independent claim about the provider outcome.

Do not copy raw provider payloads, credentials, or sensitive financial content into
the cross-cutting audit metadata. (See §B.6.)

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

Also distinct: a payment attempt outcome, the aggregate paid/outstanding
financial position, and the obligation state. A failed attempt is an attempt
outcome. It does not by itself mean the obligation has permanently failed.

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
`customerStageFor` or any customer-facing stage. Agreement states, project
intake states, and the existing mapping to customer-facing stages remain as they
are. Any later customer-facing change would be a separate decision.

---

## C. Payment obligation lifecycle (candidate states, draft)

This is a **candidate** lifecycle for internal obligation state. States are not
agreement states. The list is illustrative of distinct semantics, not a finalized
policy.

| State | Meaning | Trigger and notes |
| --- | --- | --- |
| `proposed` | Obligation exists as part of a configuration version, not yet payable/relevant in the active flow. | Configuration/obstacle modeling only. |
| `due` | Obligation is currently expected to be paid. | Baseline says it applies now. |
| `paid` | Obligation has been satisfied by allocated payment evidence. | Allocation + evidence satisfy expected amount/currency per the relevant decision. |
| `partially_paid` | Some allocated payment exists, but the obligation is not yet fully satisfied. | Partial payment allocated; remaining balance still owed by the obligation. |
| `disputed` | The obligation is contested; no payment-relevant conclusion is assumed here. | Unresolved Founder decision what this implies. |
| `reversed` | A prior satisfied obligation is reversed by a refund/reversal that the model treats as removing that satisfaction. | Reversal outcome; distinct from " refunded ". |
| `failed` | **This is an obligation lifecycle state only if explicitly adopted as such later.** In the current draft, do **not** treat `failed` as an obligation state. Failed is an **attempt** outcome, not an obligation state. | See §E.1 and §C clarification. |

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

If an obligation is disputed, that does not by itself mean the payment did not
occur or that the obligation is `failed`. If a payment attempt failed, that does
not by itself mean the obligation is satisfied or permanently failed. The attempt
outcome and the obligation state are distinct columns in the model.

Retry limits, dunning, retry scheduling, notifications, and any "give up" policy
are unresolved Founder decisions, not part of this lifecycle.

---

## D. Payment evidence and reconciliation (provider-neutral)

### D.1 Evidence types, conceptually

The model is provider-neutral. It does not depend on one provider's webhook
schema, one provider's reconciliation API, or one provider's certainty semantics.

Evidence can come from different sources with different certainty:

- provider webhook/callback;
- provider API pull/reconciliation;
- internal reconciliation with the provider's reported outcome;
- customer-uploaded or manually recorded evidence where allowed (if ever).

Each evidence record is identified by its source and its provider/source
identifiers. Evidence is verified before it is used to support a payment event.
A provider callback is not automatically trusted as authoritative without
verification within the system's own boundary.

This document does not require a specific verification mechanism; it requires that
the rule exist.

### D.2 Comparing evidence to the obligation

Before a payment can count as confirming payment against an obligation, the
payment evidence amount and currency are compared to **that specific obligation's**
expected amount and currency.

That is:

- the obligation defines expected amount and currency;
- the payment evidence defines amount and currency as reported by the provider or
  reconciliation source;
- the system compares the two before treating the payment as allocated to that
  obligation.

The system does **not** match payments to obligations by amount alone, by order
alone, or by proximity in time alone. Allocation is explicit.

### D.3 Attempts, allocations, and refunds

- A **payment attempt** is one provider/reconciliation outcome. It may succeed or
  fail or be pending.
- An **allocation** applies part or all of a successful payment to one or more
  obligations, with explicit amounts per obligation.
- A **refund/reversal** is a separate later event, tied to the original payment
  where applicable. It can be partial or full.

No amount or financial detail is stored in identifier-only audit metadata.

Original payment evidence and original refund evidence are preserved as
append-only history. A refund does not erase the original payment record; it adds
a reversible record that can be traced back.

### D.4 Partial payments and partial refunds

A partial payment is a payment whose allocated amount is less than the obligation's
expected amount. It leaves the obligation in a not-fully-satisfied state, for
example `partially_paid` if that state is adopted.

A partial refund is a refund whose amount is less than the originally allocated
amount. It does **not** mean the entire obligation is refunded.

The `refunded` state, if used, must be defined so a partial refund cannot be
mistaken for a complete refund of the obligation. In this draft, the safe approach
is to keep refund as an event and amount relative to the specific allocation or
obligation, and to avoid using a single boolean `refunded` that implies complete
satisfaction reversal unless the exact meaning is stated.

Impact of partial payments/refunds on obligation satisfaction remains dependent on
an explicit Founder-approved policy. This document does not invent that policy.

If additional records are needed per concept (one record per attempt, one per
allocation, one per refund), that is allowed if justified. If a concept can be
represented without a separate record, say so. The guiding rule is
reconstructability and no conflicting duplicate source of truth.

### D.5 Idempotency and deduplication

The model must be able to receive the same external event more than once.
Repeated delivery must be handled by idempotent processing keyed on a
provider/source event identifier, so a duplicate is recognized and does not create
a second payment event or a second allocation that double counts.

The deduplication scope is the provider/source event identity for that evidence
source. Internal normalized events may be deduplicated against already-accepted
external evidence.

This does **not** mean "last write wins" silently. If the same provider event is
received again, the system should recognize the prior accepted outcome and not
rewrite it. If different evidence conflicts with prior accepted evidence, that is a
reconciliation conflict to be handled explicitly, not by overwriting earlier
records.

### D.6 Delayed, duplicated, out-of-order, conflicting events

- Delayed events: accepted if they are within the system's reconciliation/temporal
  rules, and correlated to the correct obligation/version. No silent mutation of
  earlier records.
- Duplicated events: deduplicated, as above.
- Out-of-order events: applied in a way that preserves the append-only history and
  does not erase prior attempts. Later events do not rewrite earlier ones.
- Conflicting events: flagged for reconciliation. The earlier accepted record is
  not silently overwritten. Reconciliation outcome is itself recorded.

Transactional consistency: an accepted payment event, any derived obligation state
(if materialized), and its audit entry must be written in a consistent transaction
so the system does not end up with an accepted event and no corresponding audit
entry, or an audit entry with no accepted event.

---

## E. Activation predicate (candidate)

### E.1 Activation as an internal gate

Activation is an internal event recorded when the activation predicate is
satisfied. It is not the same as acceptance, not the same as signing, and not a
provider callback.

Candidate activation predicate (draft, subject to Founder review):

1. The project's **current accepted proposal version** is the exact version
   referenced by the effective payment configuration version being evaluated.
2. The project's **current applicable signed agreement version** is the exact
   version referenced by the effective payment configuration version being
   evaluated.
3. The effective payment configuration version's required obligations are exactly
   the obligations that belong to that configuration version, and all required
   obligations are present in that version.
4. The required obligations are satisfied according to the relevant payment,
   allocation, and evidence rules, compared against each obligation's expected
   amount and currency.

A configuration that references a stale accepted proposal or stale applicable
signed agreement does not satisfy (1) or (2), and is therefore not eligible for
activation.

A configuration whose required-obligations set is incomplete or mismatched does not
satisfy (3).

An obligation that is due but not satisfied does not satisfy (4). A failed payment
attempt does **not** by itself satisfy or void an obligation; it is an attempt
outcome. Retry policy, dunning, and how many attempts are allowed are unresolved
Founder decisions and are **not** encoded here.

The activation predicate is evaluated against the validated current references and
required obligations at evaluation time. The server-side activation operation
revalidates this baseline at the point of activation, as described in §B.1.

If the predicate is satisfied, the activation event is written atomically together
with the validation context and its audit entry. If not, no activation event is
written and no activating consequence occurs.

This predicate does not say what happens after activation. It only says what must
be true before the activation event can be recorded.

---

## F. Activation, staleness, and replacement (non-contradictory wording)

- Activation binds to the exact current commercial baseline through the effective
  payment configuration version, which must reference the exact current accepted
  proposal version and the exact current applicable signed agreement version.
- The effective configuration version must include all required obligations.
- If the current accepted proposal or current applicable signed agreement changes,
  any configuration version anchored to the prior versions becomes stale.
- A stale configuration cannot satisfy the activation gate, because the activation
  predicate requires the exact current references.
- A replacement configuration is a new configuration version referencing the then
  current baseline, with its own required obligations. It does not rewrite prior
  configuration versions, prior obligations, or prior payment history.
- Previously issued obligations are not silently mutated.
- Payment evidence and payment history are append-only; later events do not erase
  or rewrite earlier ones.

These rules are proposed, draft, and subject to Founder review. They do not specify
amendment, cancellation, price change, currency change, or any commercial
replacement workflow. They only describe how a configuration can stop being current
and how a replacement would be represented without corrupting history.

---

## G. Proposed boundaries (non-implementation)

This section is deliberately non-implementation. It records proposed boundaries so
later work does not accidentally expand scope.

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
- no change to `customerStageFor` output.

Also excluded: fee/tax/refund/chargeback/retry/dunning policy, invoicing,
receipts, ledger export, and any post-activation behavior.

### G.1 Out of scope for this design gate

Same list as above, restated for clarity: provider choice, payment implementation,
schemas, migrations, routes, services, UI, tests, deployment, provider activation,
live customer data, and any commercial policy not already explicitly identified as
unresolved.

---

## H. Implications for current codebase probe (factual, not a design decision)

The codebase currently has:

- a customer proposal surface that returns the current published proposal version
  for a project the customer may access, and treats "no published proposal" and
  "only drafts" as indistinguishable to the customer (`website/lib/platform/customer-proposals.ts`);
- an audit-events table used as a cross-cutting identifier-only metadata store
  (`website/lib/platform/sqlite-store.ts`);
- existing proposal and agreement lifecycle and state concepts in the
  agreement/e-signature track.

These are cited as factual context for the proposed model, not as approval of any
design here.

---

## I. Unresolved decisions (explicit list, draft)

The following are **unresolved Founder decisions**, not implicit model choices:

1. Whether `refunded` is an obligation state at all, and if so exactly what it
   means versus partial refund versus reversal.
2. Whether partial payments and partial refunds are allowed, and their exact
   effect on obligation satisfaction.
3. Whether `failed` is ever an obligation state, or only ever an attempt outcome.
4. Retry limits, retry scheduling, dunning, and customer notification policy.
5. Evidence verification mechanism details and acceptable sources.
6. Exact list of permitted audit_events metadata fields.
7. Whether provider source evidence and normalized events are stored separately or
   in one combined ledger.
8. Idempotency key scope beyond provider/source event identity.
9. Handling of refunds/reversals in activation predicate semantics.
10. Any post-activation consequences, if any.
11. Any amendment/replacement/cancellation commercial workflow.
12. Any currency, pricing, tax, fee, or refund policy.

This list is deliberately long. The point is to avoid hiding policy gaps inside
the model.

---

## J. Proposed Founder decisions (for review, not decided here)

These are proposed, not decided. Each is a candidate Founder decision.

- **J.1** Activate only against the exact current accepted proposal version and the
  exact current applicable signed agreement version, through a payment
  configuration version that references both.
- **J.2** Treat stale configurations as ineligible for activation; do not silently
  reuse them.
- **J.3** Represent replacement configurations as new versions referencing the then
  current baseline, with no silent mutation of prior obligations or payment history.
- **J.4** Store expected monetary amount and currency on the obligation/configuration
  where they are defined, and compare payment evidence amount/currency to that
  specific obligation before counting payment as confirmed.
- **J.5** Adopt one authoritative append-only internal record for derived
  payment/obligation state, with provider source evidence either embedded or
  referenced by stable identifier.
- **J.6** Keep payment attempt outcomes distinct from obligation states and from
  aggregate financial position.
- **J.7** Preserve original payment and refund evidence as append-only; refund adds
  a reversible record rather than erasing the original.
- **J.8** Make `refunded`, if used, unambiguously not equivalent to a complete
  refund unless exactly defined that way.
- **J.9** Deduplicate repeated external events by provider/source event identity;
  do not silently overwrite accepted evidence.
- **J.10** Treat `audit_events` as identifier-only metadata; do not store monetary
  amounts, currency, provider payloads, credentials, or sensitive financial content
  there.
- **J.11** Maintain transactional consistency among accepted events, derived
  obligation state if materialized, and audit entries.
- **J.12** Delay all retry, dunning, refund policy, tax, fee, currency, and
  post-activation consequence decisions until separately approved.

---

## Appendix: edits relative to the prior draft

The prior draft's §B.3 and §B.4 overlapped; this revision resolves that by making
§B.3 the provider-neutral event evidence model and §B.4 the single-source-of-truth
statement with explicit evidence-reference rules.

The prior draft conflated `failed` as an obligation state in §C.4 with
"failed attempt leaves obligation due" in §E.1; this revision separates attempt
outcome from obligation state and updates the lifecycle table, §C, §E.1, and
cross-references accordingly.

The prior draft did not anchor activation to the exact current accepted proposal
and applicable signed agreement versions; this revision adds that requirement in
§B.1 and §E.1 and adds staleness/replacement semantics in §F.

The prior draft did not clearly anchor expected amount/currency to obligations or
describe allocation and partial-refund semantics; this revision adds that in
§B.2, §D.2, §D.4, and §C.

The prior draft left the audit boundary underspecified; this revision makes
§B.6 explicit that audit_events is identifier-only and excludes monetary amounts,
currency, provider payloads, credentials, and sensitive financial content.

No implementation, schema, route, service, UI, or test was added or changed.
