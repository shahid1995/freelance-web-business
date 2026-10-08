# Agreement and E-Signature — Design Gate

**Status:** Approved — Founder approval recorded 2026-10-07  
**Date:** 2026-10-07  
**Founder approval:** Approved — 2026-10-07  
**Scope:** Smallest durable agreement and e-signature model and workflow — agreement identity, agreement versioning, signatory identity, signature evidence and immutability, and the boundary to payment and activation — with no provider selected and no legal-validity claim  
**Related:** Customer Platform Direction, Customer Platform Requirements (§10, §13, §15, §24, §26, §27, §28), Customer Platform Foundation, Proposal Foundation, Customer Proposal Review, Customer Proposal Response

> **Status note.** This is an **approved design gate**. Founder approval was recorded on 2026-10-07. It authorizes the design as the basis for later implementation planning, but it does **not** authorize provider selection or production activation, and does not resolve any remaining legal or business question. It defines the smallest durable agreement/e-signature model the platform needs, preserves the accepted separation between **Accept Proposal** (application-level commercial evidence) and **Sign Agreement**, and marks every unresolved business, legal, and provider question as **Founder decision required** rather than assuming an answer. Nothing described here is implemented, deployed, activated, or legally certified, and no live customer data is processed.

## 1. Status

**Status: Approved — Founder approval recorded 2026-10-07.**

This document is the Founder-approved design for the Agreement and E-signature slice. It authorizes no implementation by itself, creates, deploys, and activates nothing. The Founder has now resolved Q1, Q2, and Q3; implementation remains a separate later task and is subject to the verification contract and remaining production/provider gates recorded here.

Three facts must be kept separate, and none implies the next:

- **The design is approved.** Founder approval was recorded on 2026-10-07. Q1, Q2, and Q3 are now resolved; implementation remains a separate later task and must follow the verification contract and remaining production/provider gates.
- **Nothing is implemented.** No agreement model, table, route, endpoint,
  service, or UI exists, and this design does not create one. A proposed or even
  accepted design is not a capability.
- **Nothing is legally decided.** Legal validity, jurisdiction-specific
  requirements, document-retention policy, and provider selection are
  explicitly **not** decided here. Each is a separate later decision, and each
  must be resolved before production activation (section 15, section 16,
  section 17, section 21).

The unresolved business and legal questions are listed openly in section 21. This
design deliberately does **not** invent answers to make itself look complete.

## 2. Context

Four accepted decisions and one approved requirements document establish the
ground this design stands on.

**Customer Platform Direction**
(`docs/decisions/2026-10-04-customer-platform-direction.md`, Approved
2026-10-04) defines the long-term customer-facing application and the
organization-centric model — person → organization → projects — with
project-specific customer access and an internal Founder workspace.

**Proposal Foundation**
(`docs/decisions/2026-10-05-proposal-foundation.md`, Accepted 2026-10-05) gives
the platform one proposal per project, immutable numbered versions, exactly two
version statuses (`draft`, `published`), Founder-only authoring, and an
explicit, audited publication act. It lists agreement/e-signature as a non-goal
that requires a later, separate decision.

**Customer Proposal Review**
(`docs/decisions/2026-10-06-customer-proposal-review.md`, Accepted
2026-10-06; implemented and merged as PR #43) lets an authorized customer read
the current published proposal version. Its non-goals list agreement/e-signature
as a separate later decision.

**Customer Proposal Response**
(`docs/decisions/2026-10-06-customer-proposal-response.md`, Accepted and
implemented 2026-10-06; implemented and merged as PR #45) adds the two
version-bound customer actions — Request Changes and Accept Proposal — with an
append-only `proposal_responses` table and identifier-only audit events.
Section 9 of that decision is explicit that acceptance is **application-level
evidence only**, is **not a legal signature**, creates no agreement, and makes no
claim of legal validity, and that agreement/e-signature remains a separate
future capability with its own undecided requirements.

**The approved requirements**
(`docs/website/customer-platform-requirements.md`) describe the workflow this
design belongs to and the baseline commercial gate:

> **Proposal accepted → Agreement completed → Required payment conditions
> satisfied → Project activated** (§15)

and require, for an agreement (§13):

> - identifiable agreement version;
> - signatory identity;
> - organization/project association;
> - timestamp;
> - signed state;
> - immutable or tamper-evident historical record;
> - secure retention.

Section 13 states that legal validity, provider selection, document retention,
and jurisdiction-specific requirements require separate decisions before
production activation. Section 24 requires agreement/signature state to appear
in audit history. Section 27 requires least-privilege authorization,
project-specific access, secure storage, and explicit retention/deletion rules
before production use. Section 28 lists provider-specific e-signature
implementation among deferred capabilities.

This document is the separate decision §13 calls for — a **design** decision,
not a provider decision, not a legal decision, and not an implementation.

## 3. Problem

After a customer accepts a proposal, the platform has application-level evidence
of that acceptance but no way to record the **agreement** that the commercial
work depends on. The requirements place a completed agreement in the commercial
gate before payment and activation, and require an identifiable, signable,
tamper-evident record of who signed what and when.

Designing that badly would create two real risks:

1. **Collapsing acceptance into signing.** If "Accept Proposal" is treated as a
   signature, the platform would claim a legal effect it does not have, and
   would silently rewrite the meaning of the accepted evidence.
2. **Building an unaccountable document system.** If signed records can be
   edited or overwritten, or if the record depends on a mutable proposal, the
   platform loses the historical agreement evidence it is supposed to keep, and
   the choice of a vendor or a legal theory would be baked in before the Founder
   and legal review have decided them.

This design solves both by defining a small, provider-neutral, append-only
agreement model that is separate from — and never mutates — the proposal, and by
leaving every business, legal, and provider question open and visible.

## 4. Goals

- Define what an **agreement** is and how it relates to a project, its
  organization, the accepted proposal, and an exact proposal version — without
  ever mutating the proposal.
- Define **agreement versioning** and a deliberately small version state model.
- Define the **identity of the signatory** and the evidence a completed
  signature records, reusing the existing authenticated customer identity and
  organization/project authorization model.
- Make the **signer-authority** question explicit and mark what requires Founder
  approval instead of assuming it.
- Define the **smallest useful signature workflow**.
- Define **evidence and immutability** requirements so signed history cannot be
  silently overwritten, while making no claim that a storage technique creates
  legal validity.
- Define what happens on **repeat signing and superseding agreements**.
- Keep **customer authorization** on the existing project-access model with no
  bypass.
- Define the **audit events** for material agreement actions, following the
  established identifier-only, append-only, transactionally consistent
  principles.
- Separate **application retention**, **security**, **legal retention**, and
  **jurisdiction-specific** concerns, and identify the decisions still required.
- Keep the architecture **provider-neutral** and keep **provider selection** a
  later decision.
- State the **legal boundary** plainly: application-level signature evidence is
  not a determination of legal validity.
- Define the **downstream boundary** to payment and activation without
  implementing either.

## 5. Non-goals

Not in this design, not authorized by it, and each requiring its own approved
decision before implementation:

- payment implementation;
- automatic project activation;
- payment-provider selection;
- e-signature provider integration or selection;
- legal certification, legal advice, or any assertion of legal validity,
  enforceability, or admissibility;
- jurisdiction-specific legal-compliance implementation;
- contract/clause template library;
- a document-management system (storage, folders, versioning of arbitrary files);
- customer messaging or chat;
- notifications and email-provider activation;
- production deployment;
- live customer data;
- AI/LLM drafting, review, or qualification;
- unrelated project-workflow changes;
- any change to the customer-facing project stage or to `customerStageFor`.

## 6. Existing invariants

This design must preserve, and must be read together with, the invariants the
platform already relies on:

- **I1.** Proposal versions are immutable and append-only; changing what a
  proposal says means writing the next version.
- **I2.** At most one acceptance exists per `proposal_version_id`, enforced by
  the database.
- **I3.** Customer authorization is the existing project-access model:
  organization Owner/Admin organization-wide, ordinary members only for
  explicitly assigned projects, and the `founder` internal capability is never a
  customer path.
- **I4.** A service never trusts a caller-supplied project id as proof of
  access; authorization runs inside the service on every call.
- **I5.** Reading performed by a customer is non-mutating and creates no audit
  event.
- **I6.** Audit metadata carries identifiers, never sensitive content, and is
  written in the same transaction as the material state it records.
- **I7.** No customer-facing project stage changes as a side effect of a
  commercial record; `customerStageFor` is untouched by this slice.
- **I8.** The public repository contains no passwords, keys, session data,
  confidential customer information, or sensitive payment information.

## 7. Domain model

The model is deliberately parallel to, and separate from, the proposal model.
It adds an agreement identity, its immutable versions, and its append-only
signatures. It introduces no new identity system.

### 7.1 Agreement identity

An **agreement** is the stable identity of the commercial agreement for one
project. It is organizational and long-lived; its content lives in its versions.

- Exactly one agreement per project, mirroring the one-proposal-per-project rule
  from Proposal Foundation.
- An agreement belongs to exactly one organization and exactly one project, and
  must never be retrievable through another project's reference.
- An agreement is created by the Founder/internal authority; it is never created
  by a customer.

The Founder has decided that the platform will have **one primary agreement per project initially**. Additional agreement types may be introduced later as related records if an actual business need requires them; that expansion is additive and does not change this initial identity/versioning model.

### 7.2 Agreement version identity

An **agreement version** is one immutable expression of the agreement's terms at
a point in time.

- Versions are numbered oldest-first, 1-based, unique within the agreement, and
  never renumbered.
- A version binds to the **exact accepted proposal version** it is based on (see
  7.3). It does not bind to "the proposal" as a moving thing.
- A version carries an explicit status (§8).
- A signed version is immutable and terminal (§8.3).

### 7.3 Relationship to an accepted proposal

**An agreement version references an exact, immutable proposal version as its
baseline. It never copies that content in a way that could drift, and it never
mutates the proposal.**

Concretely:

- An agreement version stores the baseline as identifiers only: the
  `proposal_id`, the `proposal_version_id`, and the customer-visible
  `version_number` of the accepted version it is based on.
- The proposal and its versions are **never** modified by this slice. There is
  no update or delete path to a proposal or a proposal version here.
- Because proposal versions are immutable (I1), an exact `proposal_version_id`
  reference is a stable historical pointer: a later proposal version can never
  silently rewrite what a historical agreement was based on.
- The agreement may additionally carry **Founder-authored agreement text** for
  terms the proposal does not state. That text belongs to the agreement version,
  not to the proposal.
- The Founder has decided that an agreement version **binds to the exact accepted proposal version** and may contain **additional contractual terms** that belong to the agreement. This does not claim that reference alone satisfies any legal requirement and does not permit rebinding to a different proposal version.
- An agreement version may only be based on a proposal version that is
  **accepted** under Customer Proposal Response. It may not be based on a draft,
  an unpublished version, or a merely published but unaccepted version. An
  accepted version is the commercial baseline.
- **The baseline must remain the project's current accepted proposal version to
  stay signable.** An agreement version is eligible for signing only while its
  `proposal_version_id` still equals the project's **currently accepted proposal
  version** — the accepted version the project holds now, derived from the
  acceptance rows defined by Customer Proposal Response, never stored on the
  agreement or the project. If a newer proposal version is accepted after the
  agreement version was published, the agreement version's baseline is **stale**:
  it stops being signable, is never silently rebound to the new proposal
  version, and remains immutable historical data.
- **Stale is not a stored state.** A stale baseline is a **derived** fact,
  exactly like supersession (§8.2). It never changes an agreement version's
  status and never edits a version or a signature.
- **The exact baseline rule is now settled by Q2.** The agreement version binds
  to the exact accepted proposal version and may contain additional contractual
  terms; it is never silently rebound to a different proposal version.

### 7.4 What the model deliberately does not store

Following the existing evidence principle, the agreement model stores **no**:

- customer-facing project stage or lifecycle field;
- payment amount, schedule, status, or provider reference;
- signature image, handwriting, biometric, or identity-document data;
- provider-specific envelope, certificate, or audit-trail payloads;
- proposal or agreement content duplicated into audit metadata;
- any "legal validity" flag or claim.

## 8. Lifecycle and state model

The state model is deliberately small. It has one status field on the agreement
version and derives everything else.

### 8.1 Agreement version states

An agreement version has exactly one status:

| Status | Meaning |
| --- | --- |
| `draft` | Created by the Founder/internal authority; not visible to any customer; not signable. |
| `published` | Made visible to authorized customers for the project; eligible to be the current signable version (§8.2). A version stops being the current signable version once a later `published` version exists. |
| `signed` | The Founder-approved Q1-A completion condition has been satisfied: one authorized customer signature has been recorded against this exact agreement version. A `signed` version is never `published` again, is never a current signable version, and is terminal and immutable. |

Publication is a separate, explicit, Founder-only act, exactly as it is for a
proposal. Creating a `draft` version does not make it signable, and publishing
a version does not mean anyone has signed it.

A version has **exactly one** status at a time. A version that has been signed
has status `signed`; it is **never** simultaneously `published` and `signed`,
and it never returns to `draft` or `published`. The three states are mutually
exclusive, and the derived concepts in §8.2 are computed from them.

There is deliberately **no** stored `pending`, `awaiting_signature`,
`expired`, `declined`, `cancelled`, `superseded`, `stale`, or `void` state.
Both supersession and staleness are **derived** (§8.2), not stored: an unsigned
`published` version stops being the current signable version once a later
`published` version exists, and any version — `published` or `signed` — stops
being the current agreement version (and so stops being signable) once its
accepted proposal baseline is no longer the project's current accepted version.
Notifications, reminders, and expiry are out of scope (section 19).

### 8.2 Current agreement version, current signable version, and signed history (derived)

Three distinct concepts are derived from the immutable version and signature
rows. None of them is stored, and none of them changes the status of a version.

- **Current agreement version.** The highest-numbered agreement version that is
  *applicable to a customer* **and based on the project's current commercial
  baseline** — that is, the highest-numbered version whose status is `published`
  or `signed` **and** whose accepted proposal baseline matches the project's
  currently accepted proposal version (§7.3). A `draft` is an internal,
  unpublished working version; it is not the current agreement version until it
  is published. A `published` or `signed` version whose baseline is no longer
  the current accepted proposal version is **stale**: it remains signed history
  or an unpublished-candidate version as the case may be, but it is **not** the
  current agreement version. The current agreement version is therefore either
  `published` (awaiting signature) or `signed` (completed for that version), and
  there is no current agreement version until a version based on the current
  accepted proposal version is published. This keeps **signed history** and the
  **current commercial agreement** distinct: a stale signed version is not the
  current agreement version, though it is never edited or deleted.
- **Current signable version.** The highest-numbered `published` agreement
  version whose accepted proposal baseline matches the project's **currently
  accepted proposal version** (§7.3). It must also satisfy the existing
  signability rules: a `draft` is never signable, a `signed` version is never
  signable again, and a version whose baseline has changed is **stale** and never
  signable. When the current agreement version is `published`, the current
  signable version is that same version and the agreement is awaiting signature.
  When the current agreement version is `signed`, or there is no current
  agreement version (no version is based on the current accepted proposal
  version), there is no current signable version: nothing can be signed until a
  new agreement version based on the current accepted proposal version is
  published.
- **Signed history.** Every `signed` version remains `signed` forever, whether
  or not later versions exist and whether or not its baseline is still current,
  and remains readable and auditable. A stale signed version is still signed
  history: it must never be edited or deleted, and signing one version never
  changes the status or content of any other version.

Consequences of the three states, stated explicitly:

- Because a version has exactly one status at a time, no version is ever
  simultaneously `published` and `signed`. "The current published version is
  signed" is therefore not a valid description in this model; the accurate
  statement is "the current agreement version is `signed`".
- When the current agreement version is `signed`, the agreement has completed
  signing **for that version**.
- When a later `published` version exists, that later version becomes the
  current signable version and requires its own signature. The earlier version
  is either already `signed` (terminal, part of signed history) or unsigned and
  simply no longer the current signable version. There is no stored
  `superseded` state: "superseded" is only the derived fact that a version is no
  longer the highest-numbered `published` version.
- A version can stop being the current signable version for **two distinct
  derived reasons**, and the design keeps them separate:
  - **superseded** — a later `published` agreement version exists, so the
    earlier version is no longer the highest-numbered `published` version;
  - **stale** — the project's accepted proposal version has changed, so the
    version's `proposal_version_id` is no longer the current accepted baseline.
  Both are **derived, not stored**; both leave the version's status and content
  untouched; and neither ever edits or re-derives historical signed evidence.
- A newer accepted proposal version can make the current agreement version
  stale. If the project's accepted proposal version changes, any agreement
  version bound to the older accepted version — including a `signed` one —
  ceases to be the current agreement version, so there is no current agreement
  version until a new version based on the current accepted proposal version is
  published. The stale signed version remains signed history and immutable;
  nothing about it is mutated, deactivated, or rolled back.
- An earlier `signed` version never changes state.
- A newer `draft` does not pretend to be signable, does not change the current
  signable version, and does not modify historical signed evidence.
- Standing is always derived from the immutable version and signature rows,
  never from a mutable per-project agreement field.

The terms "current agreement version", "current signable version", and "signed
history" are used throughout this document with exactly these meanings.

### 8.3 Immutability

- A `signed` version is immutable: there is no update or delete path for it, its
  `signed` status never changes, and it never returns to `draft` or `published`.
- A written signature row is append-only: the store exposes no update and no
  delete method for it.
- A later commercial change that alters the agreement's meaning requires a
  **new agreement version**, never an edit of an existing one. This mirrors the
  proposal rule that changing what a document says means writing the next
  version.
- - **Q1-A is now the settled model.** Exactly one authorized customer signature completes an agreement version. A one-signature-per-version uniqueness rule may be used as a last-resort integrity guard, and the version becomes `signed` when that signature is recorded. Founder countersignature is not required by default.

### 8.4 Version numbering

Version numbers are deterministic, oldest-first, and allocated by the store
inside the writing transaction, exactly as proposal versions are. A version
number is never reused and never renumbered after the fact.

## 9. Signatory identity and who may sign

### 9.1 What a signature records

A **signature** is an append-only record that an identified, authenticated
person, acting under an authorized role, signed one exact agreement version. It
records, at minimum:

- the **person** identity of the signatory (the existing customer `Person`);
- the **organization** and **project** the agreement belongs to;
- the **agreement** and the **exact agreement version** (with its version
  number);
- the **accepted proposal baseline**: `proposal_id`, `proposal_version_id`, and
  its version number;
- the **authority exercised** at signing time (the signer's organization/project
  role, captured as evidence, not re-derived later);
- the **action** (`signed`) and the **signature purpose/order**, where a
  multi-signature model is in force;
- the **timestamp**;
- an idempotency key so a retried or replayed submission records exactly one
  signature.

**Signature-cardinality rule — Founder decision Q1-A.** One authorized customer signer is sufficient. Exactly one signature record per agreement version completes the version; the version becomes `signed` after that signature, and a one-signature-per-version uniqueness rule may be used as a last-resort integrity guard. Founder countersignature is not required by default.

- The record deliberately does **not** contain a signature image, a document scan,
  biometric data, an identity document, or any provider artifact. Those — and any
  stronger identity verification — are provider and legal decisions
  (section 16, section 17, section 21).

Identity here means the **platform's authenticated identity**: the person who
holds the session and is authorized for the project at the moment of signing.
The strength of identity proofing is a separate question (§21, Q6), and this
design makes no claim that authenticated-session identity is legally sufficient.

### 9.2 Who may sign

This is a **material business decision**, and this design does **not** silently
assume that every project member may sign.

The existing role model is:

- **Organization Owner/Admin** — organization-wide administrative authority,
  and the only role permitted to **Accept Proposal** (Customer Proposal
  Response §9);
- **ordinary project member** — access only to explicitly assigned projects,
  permitted to Request Changes but **not** to Accept;
- **Founder / internal capability** — the internal authoring path, never a
  customer path.

**Founder decision — signer model:** one authorized customer signer is permitted, using the existing server-side organization/project authorization model. **Founder countersignature is not required by default.** This decision does not create a new identity system or bypass the existing authorization checks.

What is a **design/implementation rule** (settled by this design if approved):

- authorization runs inside the signing service on every call, against live
  access rows (I4);
- the `founder` internal capability is never a customer signing path;
- a customer can never sign an agreement for a project they cannot access
  (section 13).

The Q1 decision is now recorded: one authorized customer signer is sufficient, and Founder countersignature is not required by default. The rule must be **server-enforced on every submission**, never inferred from the presence of a UI control.

### 9.3 Authorization reuse

Signing reuses the existing customer authorization model unchanged:

- the same organization membership and role evaluation;
- the same project-access rows and `requireProjectAccess`-style check;
- the same rule that authorization is re-evaluated on every call, so a revoked
  grant blocks the next submission;
- no new role, no new identity system, no customer-facing endpoint that bypasses
  the service.

## 10. Signature workflow

The smallest useful workflow, described as application behavior only. No UI or
API is defined or implemented here.

1. **Agreement presented.** For the current signable version (§8.2), an
   authorized customer for the project can see that an agreement exists and is
   awaiting signature. This is a read and is non-mutating; it creates no audit
   event.
2. **Signature intent.** The customer expresses intent to sign by submitting an
   explicit action against the **exact version they were shown**, carrying an
   idempotency key. Intent is **not** a stored state: the submission either
   completes a signature or is rejected and writes nothing.
3. **Server validation inside one transaction.** The service, in a single
   transaction that takes the write lock before its first read:
   - authorizes the caller against live access rows;
   - applies the signer-authority rule (section 9.2);
   - **resolves the idempotency key before any state rejection**: if the key
     already recorded this exact signing operation, it returns the recorded
     deterministic result (even though the version is now `signed`); if the key
     conflicts with a different operation or context, it rejects
     deterministically;
   - re-derives the **current signable version** of the agreement (§8.2);
   - re-derives the project's **currently accepted proposal version** and
     verifies the agreement version's `proposal_version_id` still matches it —
     a changed baseline is a **stale** version (§7.3, §8.2);
   - rejects a **stale version** — either no longer the current signable version
     or bound to a proposal baseline that is no longer accepted — and writes
     nothing, with no silent rebinding;
   - rejects a version that is `draft` or already `signed`;
   - writes the signature row, the version's `signed` transition, and its audit
     event atomically.
4. **Signature completion.** On success the version's status becomes `signed`
   (it is no longer `published`) and the signature row is the durable evidence.
   The result returned is deterministic and idempotent.

   The meaning of success is now settled by Q1-A: a successful submission records the single authorized customer signature and the version becomes `signed`.

5. **Historical record.** The signed version and its signature row remain
   readable and immutable for the life of the project record.

**Retry property.** A retry of an already-successful signing operation returns
the recorded result even though the version is now `signed`, because the
idempotency key is resolved *before* the terminal-state check (step 3). A replay
is therefore never rejected as "already signed". The partial unique index is a
last-resort integrity guard, **not** the mechanism for idempotent retry: the
service resolves replay explicitly.

There is no stored "awaiting signature" state, no reminder, no expiry, and no
decline path in this slice. A customer who does not sign simply leaves the
agreement unsigned, and the Founder may publish a later version. Whether a
decline/withdraw action is ever needed is out of scope (section 19).

## 11. Evidence, immutability, and tamper-evidence boundary

The minimum evidence for a completed signature is the append-only signature row
defined in section 9.1, written in the same transaction as the version's
transition to `signed`.

Application-level guarantees this design requires:

- **append-only:** no update and no delete path for a signature row;
- **signature cardinality — Q1-A settled.** One authorized customer signature completes each agreement version. A partial unique index may enforce one signature per version as a last-resort integrity guard.

- **idempotent replay:** a replayed operation returns the previously recorded
  signature rather than being rejected, because the service resolves the
  idempotency key *before* any terminal-state rejection (§10 step 3). The unique
  index is the last-resort guard against a second row, **not** the retry
  mechanism;
- **immutable signed version:** the signed version's content never changes;
- **transactional:** the signature row, the version's `signed` status, and the
  audit event are one atomic write, so neither layer exists without the other;
- **non-mutating reads:** viewing an agreement or a signature writes nothing and
  creates no audit event;
- **no silent rewrite:** a signed historical record is never overwritten,
  re-pointed to a different proposal version, or re-derived from mutable state.

**What this is not.** Append-only storage, a transaction, and a stored timestamp
are *application* integrity measures. They do **not**, by themselves, create
legal validity, enforceability, admissibility, non-repudiation, or a qualified
electronic signature. Cryptographic tamper-evidence, trusted timestamping,
long-term validation, and qualified signature requirements are **provider and
legal decisions** (section 16, section 17, section 21) and are deliberately not
chosen here.

## 12. Repeat signing and superseding agreements

This section defines what must happen over time. It must never silently
overwrite prior signed history.

- **A customer signs.** The signature is recorded against the exact current
  signable version (§8.2). Under the Founder-approved Q1-A model, one authorized
  customer signature completes that version and changes its status to `signed`.
- **A replayed submission.** The idempotency key is resolved **before** any
  state check. A retry of an already-successful signing operation returns the
  recorded result — one row, one audit event, the same deterministic outcome —
  even though the version is now `signed`. A *fresh* submission (a new key)
  against an already-`signed` version is rejected and writes nothing. Replay
  never creates a second signature row.
- **An agreement version stops being the current signable version.** A later
  `published` version becomes the current signable version (derived, §8.2), and
  the earlier version is either already `signed` (terminal, part of signed
  history) or unsigned and no longer the current signable version. Nothing is
  deleted or edited, and no stored state changes.
- **The accepted proposal baseline changes after an agreement version is
  published.** If a newer proposal version is accepted, any agreement version
  still bound to the older accepted proposal version becomes **stale** and stops
  being signable (§7.3, §8.2). A signing attempt against it is rejected and
  writes nothing — there is no silent rebinding to the new proposal version —
  and the stale version remains immutable historical data. If the stale version
  was already `signed`, it remains signed history but is no longer the current
  agreement version, so "agreement completed" is false until a new version based
  on the current accepted proposal version is published and signed. The Founder
  publishes that new agreement version, which becomes the current signable
  version.
- **A new agreement version is created.** It is a new numbered, immutable
  version. All earlier versions and signatures remain readable and auditable,
  unchanged.
- **A commercial change occurs after signing.** The change requires a **new
  agreement version** based on the current accepted proposal version. The signed
  earlier version is never edited; history shows exactly what was signed, when,
  and by whom.
- **A customer needs to sign a later agreement.** They sign the **current
  signable version** (§8.2). Under Q1-A, that later version has its own single
  signature; the earlier `signed` version keeps status `signed`, and no signed
  version can be re-signed or re-opened.
- **The accepted proposal baseline changes.** A new agreement version binds to
  the newly accepted proposal version. Prior agreement versions remain bound to
  the exact proposal versions they referenced, so later proposal changes cannot
  silently rewrite historical agreement evidence.

The platform's **current agreement standing** is derived from the immutable
rows, never stored. It is computed over the **current agreement version**
(§8.2 — the highest-numbered `published` or `signed` version whose accepted
proposal baseline matches the project's current accepted proposal version):

- if the current agreement version is `signed`, the agreement has completed
  signing **for that version**;
- if the current agreement version is `published`, that version is the current
  signable version and the agreement is awaiting signature;
- if there is no current agreement version — because no version has been
  published, or because every `published`/`signed` version is bound to an older
  accepted proposal baseline — the agreement is not completed and nothing is
  signable; a new version based on the current accepted proposal version is
  required, and any stale version is never rebound or mutated.

A `signed` version is never described as "published and signed": its status is
`signed`, and it remains signed history. What "the current agreement" means for
downstream payment/activation is defined in section 18 and is **derived**, never
a stored project field.

## 13. Customer authorization and project isolation

- Authorization for viewing and signing is the existing project-access model
  (I3), evaluated inside the service on every call (I4).
- A customer can never view or sign an agreement belonging to a project they
  cannot access. A caller-supplied project or agreement id is never proof of
  access — the Customer Proposal Review and Response IDOR lessons are restated
  for this slice.
- An organization Owner/Admin sees the agreement for a project in their own
  organization; a customer from another organization cannot reach it, and the
  result is indistinguishable from a project that does not exist.
- Ordinary members with an explicit assignment see what the design allows them
  to see, but whether they may **sign** is the Founder decision in §9.2.
- The `founder` internal capability remains an internal authoring path and is
  never a customer signing path.
- Revoking a grant blocks the next submission immediately, because access is
  re-evaluated per call.

## 14. Audit events

Material agreement actions create append-only audit events, following the
established principles (I6): identifiers only, no sensitive content, written in
the same transaction as the material state, and no content duplication.

| Event | Recorded when |
| --- | --- |
| `agreement.created` | The agreement identity is created for a project. |
| `agreement_version.created` | A new draft version is written. |
| `agreement_version.published` | A draft version is made the current signable version. |
| `agreement.signed` | A signature is recorded against a version. |

Rules:

- Metadata carries **identifiers and state only** — organization, project,
  agreement, agreement version, version number, the accepted proposal version
  reference, the acting person, and the action or new status. It **never**
  contains agreement text, proposal content, a signature image, or any
  identity-verification artifact.
- The signature audit event is appended in the **same transaction** as the
  signature row and the version's `signed` transition.
- Reading an agreement or a signature is non-mutating and creates **no** audit
  event (I5).
- The audit event is **not** a substitute for the signature record. The
  append-only signature row is the primary evidence; the audit event is the
  activity trail.
- This design does not require a new Founder UI. The existing internal project
  Activity history already renders audit event types and needs no change; if a
  dedicated internal agreement surface is later wanted, that is a separate
  decision (section 19).

## 15. Retention and security boundary

The requirements call for **secure retention** (§13) and for explicit
retention/deletion rules before production use (§27). This design separates four
distinct concerns and does not conflate them.

**Application historical-record requirements (decided here).**

- A signature row and a signed agreement version are retained for the life of
  the project record; they are never hard-deleted by an application path in this
  slice.
- Historical signed records remain readable so that project history stays
  auditable.
- This is an *application* retention behavior, not a legal retention period.

**Security requirements (decided here).**

- Signed records and agreement content are stored server-side behind the
  existing authorization model, with least privilege and project-specific
  access (I3, §27).
- No signature image, identity document, or provider secret is stored unless a
  later provider/legal decision requires it and defines how it is protected.
- The public repository continues to exclude keys, session data, confidential
  customer information, and sensitive payment information (I8).

**Legal / document-retention requirements — *Founder / legal decision
required*.**

- The legally required retention **period**, any mandated deletion, and the
  admissibility posture of retained records are **not** decided here.
- No retention period is invented. **Q7.**

**Jurisdiction-specific requirements — *Founder / legal decision required*.**

- Which jurisdictions apply, and what they require for a valid electronic
  signature and record retention, are **not** decided here. **Q8.**

Production activation requires Q7 and Q8 to be resolved, plus the provider choice
(section 16). This design defines only the application-level historical and
security requirements.

## 16. Provider boundary

**No e-signature provider is selected, evaluated as a dependency, or integrated
by this design.** No vendor — the marketplace names, any considered alternative,
or any equivalent — becomes an implementation dependency merely because it
exists.

- The design is **provider-neutral**. The agreement model and the signature
  record are defined in terms the platform already owns: organization, project,
  accepted proposal version, agreement version, person, action, timestamp.
- A future provider may be integrated later behind a port in the same way the
  existing email delivery is placed behind a provider-neutral port with a local
  sink — but that integration and its provider are a **separate later
  decision**.
- The provider decision must also resolve what additional evidence the provider
  contributes (certificates, trusted timestamps, long-term validation) and how
  that is stored without duplicating content into audit metadata.
- **Q5. Provider selection is required before any production signing flow that
  depends on it.** Until then, no provider is a dependency.

## 17. Legal boundary

This document is **not** legal advice and makes **no** claim that the workflow it
describes is legally binding, enforceable, admissible, or valid in any
jurisdiction.

- Accept Proposal is application-level commercial evidence and is **not** a
  legal signature (Customer Proposal Response §9). This design does not change
  that.
- An application-level signature record produced by this model is evidence that
  an authenticated, authorized person performed a signing action against an
  exact agreement version at a timestamp. It is **not**, by itself, a
  determination of legal validity.
- Jurisdiction-specific legal requirements require separate legal review and a
  Founder decision before production activation. **Q8.**
- Production activation must not occur until the legal questions in section 21
  are resolved. This design deliberately leaves them open.

## 18. Downstream relationship to payment and activation

The approved commercial gate is unchanged:

> **Proposal accepted → Agreement completed → Required payment conditions
> satisfied → Project activated** (§15)

This design defines **only the agreement boundary** inside that chain. It does
**not** implement payment or activation, and it does **not** introduce a new
customer-facing project stage.

- **What this slice may expose to downstream systems later.** A derived,
  read-only signal that the project has a **current agreement version** whose
  status is `signed` (§8.2) — an "agreement completed" boolean plus the
  identifying version number and timestamp — computed from the append-only rows,
  never stored as a mutable project field. The signal is true only when a
  current agreement version exists **and** that version is `signed`; it never
  queries for a version that is simultaneously `published` and `signed`, which
  the state model forbids. Because "current agreement version" requires the
  version's accepted proposal baseline to match the project's current accepted
  proposal version, a signed version with a stale baseline does **not** satisfy
  the signal.
- **What downstream may rely on.** A later activation design may consult that
  derived signal as the "Agreement completed" condition. "Completed" means there
  is a current agreement version (§8.2) and it carries a signature. It must not
  treat proposal acceptance alone as completed, and it must not treat a `draft`
  (not applicable to a customer), an unsigned version, or a **stale** version as
  completed. A signed version that is no longer the current agreement version —
  for example because a newer accepted proposal version made its baseline
  stale — stays signed history and is never reported as unsigned, but it does
  not make the agreement-completed signal true.
- **What a completion signal becoming false does and does not mean.** The signal
  can become false in two ways, both expected and correct:
  - **A newly published agreement version.** A new version requires its own
    signature (§8.2, §12), so signed Agreement v1 then published Agreement v2
    gives a current version that is not yet signed.
  - **A newly accepted proposal version that makes the signed version stale.**
    If Proposal v2 is accepted after Agreement v1 (based on Proposal v1) was
    signed, Agreement v1 becomes **stale** and is no longer the current
    agreement version, so "agreement completed" is false until a new version
    based on Proposal v2 is published and signed.
  In both cases the earlier signed version stays immutable signed history and
  the signal simply reports that no *current* version is signed.
  - The completion signal is a **read-only commercial gate/condition**, never a
    command. Nothing consumes it as an instruction to change state.
  - A newer accepted proposal version, or publishing a new agreement version,
    must **not**, by itself, deactivate, suspend, roll back, or otherwise revoke
    an already activated project, and must not change `customerStageFor`. Any
    such behavior requires a **separate Founder-approved activation/commercial
    decision**. This design defines none of it.
- **What this slice does not do.** No payment record, no payment status, no
  payment provider, no activation, no deactivation, no suspension, no rollback,
  and no stage change. `customerStageFor` and the customer-facing stages remain
  exactly as accepted elsewhere (I7).
- **The ordering and the exact "required payment conditions" remain a separate
  decision.** §15 already fixes the sequence; the specific conditions are a
  later Founder decision, not part of this design.

Whether signing should be gated on payment, or payment on signing, is **not**
changed by this design. §15's approved order stands.

## 19. Notifications

Notifications and email-provider activation are **out of scope**. This design
requires none of them, activates no provider, and adds no template or send path.
A customer learns an agreement awaits signature by viewing the project, exactly
as they learn a proposal awaits a response. Whether to notify by email is a later
decision with its own provider decision.

## 20. Verification contract and acceptance gate

### 20.1 Verification contract

Before an implementation of this design can be considered complete, focused
tests must cover, against the real services and store:

**Authorization and isolation**

- an unauthenticated caller cannot view or sign;
- a customer without project access cannot view or sign;
- a customer from another organization cannot reach the agreement (result
  indistinguishable from not found);
- an ordinary member's ability to sign matches the Founder's §9.2 decision
  exactly, and a member who may not sign is rejected;
- the `founder` internal capability is never a customer signing path;
- a revoked grant blocks the next submission.

**Version binding and state**

- a signature binds to the exact agreement version and accepted proposal version
  shown to the customer;
- a stale submission against a version that is no longer the current signable
  version (§8.2) is rejected and writes nothing;
- a `draft` version is never signable, is never the current signable version,
  and is never the current agreement version until it is published;
- only a `published` version is signable, and a `signed` version is never
  signable again;
- no version is ever simultaneously `published` and `signed`: the current
  agreement version is either `published` (awaiting signature) or `signed`
  (completed for that version), never both.

  The immutability/evidence guarantees use the now-settled Q1-A cardinality: one authorized customer signature completes the version; a partial unique index may guard against a second signature; the derived "agreement completed" signal (§18) is true exactly when a current agreement version exists and is `signed`, and is false when there is no current agreement version or the current agreement version is `published`.

- **Signature-record write and signed transition:** the signature row, its audit evidence, and the version's `signed` transition are one atomic operation.

- a `signed` version whose accepted proposal baseline is stale is not the
  current agreement version and does not satisfy the agreement-completed signal;
- a newer `draft` version does not change the current signable version, does not
  invalidate historical signed evidence, and does not itself become signable;
- an agreement version whose accepted proposal baseline is no longer the
  project's current accepted proposal version is **stale** and cannot be signed —
  Agreement v1 based on accepted Proposal v1 → Proposal v2 accepted → signing
  Agreement v1 is rejected and writes nothing, with no rebinding;
- a later accepted proposal version makes the older agreement version stale
  without changing its status or content;
- regression: Agreement v1 based on accepted Proposal v1 is **signed**; Proposal
  v2 is subsequently accepted; Agreement v1 remains signed historical evidence
  but is no longer the current agreement version; "agreement completed" is
  false; no proposal or agreement row is mutated; `customerStageFor` is
  unchanged; and no deactivation is authorized;
- the accepted proposal baseline is required: a draft or unaccepted proposal
  version cannot be a baseline;
- `customerStageFor` and the customer-facing project stages are unchanged.

**Immutability and evidence**

- **signature cardinality — Q1-A settled.** One authorized customer signature completes each agreement version; a partial unique index is the last-resort guard against a second row.

- a replayed idempotency key records exactly one signature and one audit event;
- a duplicate idempotency key cannot create a second row;
- the idempotency key is resolved **before** the terminal-state check: a replay
  of an already-successful signing operation returns the recorded result even
  though the version is now `signed`, while a fresh submission against a
  `signed` version is rejected;
- the signature row, the `signed` transition, and the audit event are atomic
  (a failure in one rolls back all);
- audit metadata contains identifiers only and never agreement text, proposal
  content, or any identity artifact;
- reading an agreement or a signature writes nothing and creates no audit event.

**Supersession and repetition**

- a later published version becomes the current signable version and requires
  its own signature, without changing the status or content of any earlier
  signed version;
- earlier signed versions remain readable, remain `signed`, and are unchanged;
- a commercial change produces a new version rather than modifying a signed one;
- a customer signs a later version as a separate signature, preserving earlier
  history;
- no assertion queries for a version that is both `published` and `signed`; the
  derived completion signal references the current agreement version's own
  `signed` status;
- publishing a newer agreement version does not, by itself, change
  `customerStageFor` and does not authorize automatic project deactivation,
  suspension, rollback, or revocation of an activated project;
- the derived "agreement completed" signal may become false when a newer
  agreement version is published, and that change is a read-only condition, not
  a deactivation command.

### 20.2 Acceptance gate

Implementation of this design may proceed only when the decisions that
materially determine **what is built** are resolved. The open questions in
section 21 fall into three tiers.

**Required before implementation:**

The Founder has resolved Q1, Q2, and Q3 on 2026-10-07. Implementation may now proceed as a separate implementation task based on this approved design and its settled choices:

- **Q1-A:** one authorized customer signer; Founder countersignature not required by default.
- **Q2:** exact accepted proposal version binding, with additional contractual terms permitted in the agreement.
- **Q3:** one primary agreement per project initially, with additional agreement types introduced later as related records if a genuine need exists.

Implementation must satisfy the authorization, version-binding, immutability/evidence, supersession, and signing-verification requirements in §20.1.

**Required before production or provider-dependent operation:**

- **Q4 — legal framework** targeted, and any required signature standard;
- **Q5 — e-signature provider** selection, before any provider-dependent signing
  flow is operated;
- **Q6 — identity-proofing** strength;
- **Q7 — document-retention period** and secure-retention policy;
- **Q8 — applicable jurisdictions** and their requirements.

These are production, legal, and provider gates. They are **not** required
merely to build and test the provider-neutral application model against
synthetic data, and the core model may remain provider-neutral without selecting
a vendor.

**May remain deferred / explicitly out of scope for the first implementation:**

- **Q9 — decline/withdraw/expiry/reminders.** Deferrable only if the first
  implementation **explicitly excludes** them (§10, §19).
- **Q10 — customer download/view of a signed agreement.** Deferrable only if
  customer download/view is **explicitly out of scope** for the first slice.

Deferring Q9 or Q10 is not a decision on the question: both remain **Founder
decision required** and must be recorded before the corresponding behavior is
built.

Additional standing conditions:

1. no provider is activated, no deployment occurs, and no live customer data is
   processed without separate authorization;
2. `customerStageFor` and the customer-facing stages remain unchanged;
3. an agreement version bound to a no-longer-current accepted proposal baseline
   is rejected at signing time — the design enforces the exact baseline and never
   rebinds;
4. publishing a new agreement version does not change `customerStageFor` and does
   not deactivate an activated project (any such behavior is a separate
   Founder-approved decision).

A merged implementation PR would not authorize production deployment, provider
activation, or live customer-data operation, would not assert legal validity,
and would not resolve any of Q1–Q10.

## 21. Open questions requiring Founder decision

Q1–Q3 have been resolved by the Founder on 2026-10-07. The remaining open questions are Q4–Q10 and continue to be marked **Founder decision required**; the corresponding behavior must not be treated as decided until those later gates are resolved.

| # | Question | Status | Notes |
| --- | --- | --- | --- |
| Q1 | **Who may sign, and does the agreement require a countersignature?** | **Resolved — Founder decision 2026-10-07** | One authorized customer signer is sufficient; Founder countersignature is not required by default. Q1-A applies: one signature record completes the agreement version. |
| Q2 | **Must the agreement restate/embed the accepted proposal terms, or may it reference the exact accepted version?** | **Resolved — Founder decision 2026-10-07** | The agreement binds to the exact accepted Proposal version and may contain additional contractual terms. The exact baseline remains immutable and cannot be rebound. |
| Q3 | **Is one agreement per project sufficient, or are multiple concurrent agreement types needed?** | **Resolved — Founder decision 2026-10-07** | One primary agreement per project initially; additional agreement types may be introduced later as related records if actually needed. |
| Q4 | **What legal framework (if any) is targeted**, and is any specific signature standard required? | **Founder / legal decision required** | §17 makes no legal claim. |
| Q5 | **Which e-signature provider (if any) is selected**, and what evidence does it add? | **Founder decision required** | §16 keeps the design provider-neutral; provider selection is separate and is required before a production signing flow depending on it. |
| Q6 | **How strong must signatory identity proofing be?** | **Founder / legal decision required** | §9.1 records authenticated-session identity only and claims no legal sufficiency. |
| Q7 | **What document-retention period and secure-retention policy applies?** | **Founder / legal decision required** | §15 defines application retention only; no legal period is invented. |
| Q8 | **Which jurisdictions apply, and what do they require** for a valid electronic signature and record retention? | **Founder / legal decision required** | §15, §17. Production activation requires these resolved. |
| Q9 | **Is a decline/withdraw action, expiry, or reminder ever required?** | **Founder decision required** | §10 keeps them out of the smallest slice. |
| Q10 | **Should a signed agreement be viewable/downloadable by the customer?** | **Founder decision required** | Not decided here; view access is not implied by the signature record. |

The following are **design/implementation-level** details that do **not** require
a further Founder decision if the design is approved, and may be settled by the
implementing task without changing any business rule:

1. exact table and column names, index choices, and query tuning within §7 and
   §14;
2. exact customer-facing wording (subject to the no-legal-claim boundary in
   §17);
3. whether the agreement surface is a separate page or a panel on the existing
   project proposal page;
4. notice codes and their wording;
5. whether the derived "agreement completed" signal is computed on read or
   exposed as a store method.

**Review suggestions deliberately not adopted.** Two `LOW` review suggestions
are **not required** by this design and are intentionally left unchanged:

- **Adding a `proposal_response_id` to the signature record.** Unnecessary: the
  signature already stores the exact accepted proposal baseline (`proposal_id`,
  `proposal_version_id`, version number; §7.3, §9.1), which is what the baseline
  check needs. The signature is an agreement-level action, not a
  proposal-response action, and binding it to a specific response row would
  couple agreement evidence to a record it does not depend on.
- **Renaming the `agreement.signed` audit event to `agreement_version.signed`.**
  Unnecessary: the event's identifiers-only metadata already carries the
  agreement version identifier and version number (§14), and `agreement.signed`
  stays coherent with `agreement.created` and `agreement_version.published`.

## 22. Consequences

- The platform gains a small, provider-neutral, append-only agreement model that
  is **separate** from the proposal and never mutates it.
- Accept Proposal keeps its accepted meaning: application-level commercial
  evidence, explicitly not a signature (Customer Proposal Response §9). The
  distinction **Accept ≠ Sign** is now structural, not just documentary.
- Signed history cannot be silently overwritten: it is append-only, single per
  version, bound to an exact accepted proposal version, and never re-derived
  from mutable state.
- An agreement cannot be signed from a stale commercial baseline: if a newer
  proposal version is accepted, an agreement version bound to the older accepted
  version stops being signable and is never silently rebound.
- A signed agreement whose accepted baseline becomes stale stops being the
  current agreement version, so the agreement-completed signal becomes false,
  without mutating, deactivating, suspending, or rolling back anything.
- The commercial gate becomes implementable in steps: acceptance exists today; a
  completed-agreement signal becomes available when this slice is implemented;
  payment and activation remain later, separate decisions whose ordering §15
  already fixes.
- The design deliberately carries open business and legal questions rather than
  hidden assumptions, so the Founder's decisions are visible and can be recorded
  before production activation.
- Nothing is deployed, no provider is activated, and no live customer data is
  processed by approving this design.

## 23. Alternatives considered

**Treat proposal acceptance as the signature.** Rejected. It would claim legal
effect the platform does not have, silently rewrite the accepted evidence, and
contradict the accepted Customer Proposal Response decision.

**Store agreement state on the project row.** Rejected. A mutable per-project
agreement field would let a later change rewrite history; derived standing from
immutable versions and signatures is required for auditability.

**Make signed versions mutable with an amendment flag.** Rejected. It would
allow silent rewriting of what was signed; a commercial change must produce a new
numbered version instead.

**Copy the accepted proposal content into each agreement version.** Rejected as the default. The approved design binds each agreement version to the exact accepted proposal version and permits additional contractual terms in the agreement itself; proposal content is not duplicated merely to create another mutable copy.

**Select an e-signature provider now.** Rejected. Provider selection is a
separate decision, and §13 of the requirements says so; baking a vendor into the
design would pre-empt it.

**Assert legal validity or enforceability.** Rejected. The design makes no legal
claim and routes that to separate legal review (Q4, Q8).

**Add expiry, reminders, and decline states now.** Rejected for the smallest
slice. The state model stays at `draft` / `published` / `signed`; "supersession"
(a later agreement version exists) and "stale" (the accepted proposal baseline
changed) are only derived concepts, never a stored state (Q9).

**Introduce a new signer role or identity system.** Rejected. The approved Q1 choice reuses the existing person, organization, and project-access model and requires one authorized customer signer without a default Founder countersignature.

**Add a customer JSON endpoint or a new Founder UI.** Rejected for this design.
The existing platform conventions and internal Activity history are sufficient;
any dedicated surface is a later decision.

**Advance the customer project stage to "Agreement signed".** Rejected. It would
duplicate the accepted stage model; `customerStageFor` stays unchanged (I7).

## 24. Approval

**Status: Approved — Founder approval recorded 2026-10-07.**

This document records the Founder-approved Agreement / E-signature design gate for the Phase 4 commercial workflow. It is a design decision, not an implementation, and it records the resolved Q1–Q3 choices and the remaining business/legal questions in section 21.

Approval covers the design, including:

- one primary agreement per project initially, with additional agreement types allowed later as related records if actually needed;
- exact accepted proposal version binding, with additional contractual terms permitted in the agreement;
- one authorized customer signer per agreement version, with no default Founder countersignature and Q1-A single-signature completion;
- immutable numbered agreement versions with exactly three version states (`draft`, `published`, `signed`), derived current-version semantics, and immutable signed history;
- append-only signature records, authorization re-checks, idempotent signing, atomic signature/audit/state writes, and no signature image or identity artifact;
- provider-neutral architecture, no legal-validity claim, and the payment/activation boundary unchanged;
- Q4–Q10 remain separate later decisions and production/provider/legal gates.

Approval does **not** authorize production deployment, live customer-data operation, provider activation, payment implementation, automatic project activation, or legal certification.

Following approval and the Founder decisions recorded here, implementation of this design is a separate, later task that must satisfy the verification contract in §20.1 and the remaining production/provider gates in §15–§17 and §21.
