# Public Website and Customer Platform

This directory contains the source for the business's public website and the future customer-facing application.

## Scope

The website/application provides:

- approved business positioning;
- approved services;
- approved portfolio work;
- approved case studies;
- public project-discussion entry point;
- authenticated customer onboarding;
- customer project workspaces;
- future customer-facing sales and delivery workflows.

It is not the client source-code repository and is not the source of truth for business rules, portfolio permissions, or material business decisions.

## Source-of-truth boundary

Use the following repository material as the business authority for the product:

- docs/positioning/
- docs/services/
- docs/sales/
- docs/delivery/
- portfolio/
- docs/website/
- docs/decisions/
- CONSTITUTION.md

Application implementation details belong here. Business decisions, operating rules, and portfolio evidence remain governed by their corresponding source documents.

## Live-data boundary

The future application may store live customer/project data in a secure application data store.

Do not commit live customer records, customer documents, credentials, payment secrets, private project data, or session information to this public repository.

## Public-safety requirements

Never commit:

- credentials;
- API keys;
- private keys;
- session data;
- client secrets;
- private customer information;
- confidential project material;
- sensitive payment information.

Keep runtime secrets outside the repository.

## Publication and external-action boundary

A website/application change may be reviewed and merged without being deployed or published.

Production deployment, domain changes, live integrations, external publication, live customer-data processing, and provider activation require explicit Founder authorization or the applicable separate decision.

## Current scaffold

The current application is a Next.js 16 App Router project using TypeScript and plain CSS.

Implemented public routes:

- /
- /services
- /services/business-websites
- /services/landing-pages
- /services/redesign-modernization
- /services/custom-web-applications
- /services/dashboards-portals
- /services/maintenance-improvements
- /work
- /about
- /contact

The portfolio route intentionally shows no published work until the repository publication gate is satisfied.

## Customer platform direction

The authenticated application follows:

**Person → Organization → Projects**

The first implementation slice is intentionally limited to:

**passwordless customer identity → organization creation → customer dashboard → project creation → saved project onboarding progress**

The current product contract is docs/website/customer-platform-requirements.md.

## Customer platform architecture

The customer platform is implemented under `lib/platform/` and is deliberately kept
separate from the public content model in `lib/content.ts` and `lib/services.ts`.

| Area | Location | Notes |
|---|---|---|
| Domain records | `lib/platform/domain.ts` | Provider-neutral logical model from the foundation ADR |
| Data store port | `lib/platform/ports.ts` | Services depend on this interface only |
| SQLite adapter | `lib/platform/sqlite-store.ts` | `node:sqlite`; no database dependency added |
| Email port | `lib/platform/ports.ts` | `EmailDelivery` |
| Local mail sink | `lib/platform/local-email.ts` | No provider activated |
| Authentication | `lib/platform/auth.ts` | Single-use hashed challenge, rate limits, enumeration-safe |
| Sessions | `lib/platform/sessions.ts` | Opaque value, hashed at rest, environment-aware cookie |
| Authorization | `lib/platform/authorization.ts` | The customer policy matrix plus the separate internal capability check, both evaluated server-side |
| Organizations | `lib/platform/organizations.ts` | Idempotent creation, first user becomes owner |
| Projects | `lib/platform/projects.ts` | Administrator-only creation, automatic intake draft |
| Project Intake | `lib/platform/intake.ts` | Partial saves, closed field list, access checked per operation |
| Customer projections | `lib/platform/views.ts` | Builds customer objects field by field |
| Founder workspace | `lib/platform/internal.ts` | Founder-only: read-only review plus the explicit Start Review action |
| Proposal foundation | `lib/platform/proposals.ts` | Founder-only: one proposal per project, append-only numbered versions, explicit publication |
| Customer proposal review | `lib/platform/customer-proposals.ts` | Customer-facing read-only: the current published version only, never a draft |
| Customer proposal response | `lib/platform/customer-proposal-responses.ts` | Customer-facing: Request Changes and Accept, each bound to the current published version, append-only, Accept restricted to organization Owner/Admin |
| Agreements / e-signatures | `lib/platform/agreements.ts`, `lib/platform/customer-agreements.ts` | Founder-only version authoring plus customer signing using Q1-A; exact accepted proposal baseline; provider-neutral; signed-content download/view remains deferred under Q10 |
| Internal projections | `lib/platform/internal-views.ts` | Internal views built field by field; drops audit metadata and never spreads a stored record |
| Request guard | `lib/platform/http.ts` | Origin check plus session requirement |
| Next.js adapter | `lib/platform/server.ts` | Reads headers, redirects; no authorization logic |
| Wiring | `lib/platform/container.ts` | Lazy build of one instance per process |

Customer routes:

- /sign-in
- /onboarding/organization
- /dashboard
- /dashboard/projects/{reference}/intake
- /dashboard/projects/{reference}/proposal

Endpoints (all state-changing requests are same-origin POSTs):

- POST /api/auth/request-link
- GET  /api/auth/verify
- POST /api/auth/sign-out
- POST /api/organization
- POST /api/projects
- POST /api/projects/{reference}/intake
- POST /api/projects/{reference}/proposal-response
- POST /api/projects/{reference}/agreement/sign

### Founder workspace

A separate internal surface, governed by
`docs/decisions/2026-10-05-customer-platform-founder-workspace.md`:

- /internal/projects — the Founder project queue (governed by
  `docs/decisions/2026-10-05-founder-project-queue.md`)
- /internal/projects/{reference}/review
- POST /api/internal/projects/{reference}/review
- /internal/projects/{reference}/proposal — proposal authoring (governed by
  `docs/decisions/2026-10-05-proposal-foundation.md`)
- POST /api/internal/projects/{reference}/proposal
- POST /api/internal/projects/{reference}/agreement

It is not linked from any customer page and shares no handler with the customer
endpoints. Access requires a session holding the `founder` internal capability,
which is checked on the server on every operation and is never inferred from an
organization owner/admin role.

`CUSTOMER_PLATFORM_FOUNDER_EMAIL_HASHES` is **initial assignment, not a live
allow-list**. A person whose hash is listed is granted the capability the first
time the workspace sees them; after that the stored grant is authoritative, and
removing the hash does not revoke it. Revocation is an explicit server-side
operation against the stored grant. This is the semantics the approved ADR fixes
("assigned only through controlled server-side bootstrap/configuration"); treating
the variable as a live allow-list would make the persisted capability
meaningless. The variable is empty by default, so no one holds internal access
until a deployment deliberately sets it.

Opening the review page is strictly read-only. The customer-facing stage moves
on to *Project Intake — Review* only through the explicit **Start Review** POST,
which is authorized and audited. Internal qualification state, internal notes,
the Founder decision, and the internal next action are internal-only and have no
field in any customer projection.

The project queue at `/internal/projects` is a read-only, cross-organization
list of projects whose Project Intake has been submitted, newest first. It is
the entry point into the review workflow, so the Founder does not need to know a
project reference in advance. Loading it performs no write and creates no audit
event, a draft intake never appears, and each row links to the existing review
page. Queue rows carry only reference, title, organization name, submission
timestamp, customer-facing stage, and whether review has started — no internal
state, intake answers, or audit data.

The Founder decision vocabulary is closed to `proceed`, `clarification_required`,
`not_a_fit`, and `hold`; anything else is rejected on the server. It is stored
separately from qualification state and is never derived from it.

### Proposal foundation

The proposal surface is governed by
`docs/decisions/2026-10-05-proposal-foundation.md`. A project has **at most one
proposal**, enforced by a database unique constraint, and a proposal carries
**immutable, numbered versions** appended oldest first. A version is written once
and never edited: changing what a proposal says means writing the next version,
so "what was committed to, and when" stays answerable. There is no delete path.

Version status is `draft` or `published`, and `draft` is the default. Publication
is a separate, explicit, Founder-only, audited act; it does **not** mean the
customer has seen or accepted anything, and creating or publishing a version does
**not** move the customer-facing project stage. Proposal content is all free text
with no amount or currency column, because pricing is a separate, unapproved
Founder decision; `commercialTerms` records the terms the Founder has approved.

The proposal authoring surface itself is Founder-only. Audit metadata records the
actor, project, proposal, and version number and never copies proposal content,
so the audit trail cannot become a second copy of the commercial document.
Authorization reuses the same `founder` capability as the rest of the internal
workspace rather than introducing a second permission concept.

### Customer proposal review

The customer-facing proposal view is governed by
`docs/decisions/2026-10-06-customer-proposal-review.md` and is strictly
read-only. It shows the **current published version** — the highest-numbered
version whose status is `published` — for a project the customer may already
access. Drafts never reach a customer, and a newer draft does not displace or
hide the published version.

The page at `/dashboard/projects/{reference}/proposal` is server-rendered. It
renders a field-by-field customer-safe projection (`lib/platform/views.ts`)
carrying only the project reference, the version number, the publication
instant, and the approved proposal text; internal ids, audit metadata, and
Founder/internal state are absent by construction. The dashboard shows the link
only when the customer project summary reports `hasPublishedProposal`.

Authorization reuses the existing customer project model — organization
Owner/Admin organization-wide, ordinary members by explicit assignment — never
the `founder` internal capability. The read performs no write, creates no audit
event, and does not change the customer-facing project stage. There is no
customer JSON endpoint for it.

The page's two response actions (Request Changes and Accept) are governed by
`docs/decisions/2026-10-06-customer-proposal-response.md` and described in the
next section; rendering the page still writes nothing.

### Customer proposal response

The customer's two explicit actions on a published proposal version are governed
by `docs/decisions/2026-10-06-customer-proposal-response.md` and live in
`lib/platform/customer-proposal-responses.ts` — a sibling of the read seam rather
than part of it, so the read seam's documented single-fact contract stays
intact.

- **Two actions only**, both explicit and server-authorized: `changes_requested`
  (any authorized customer with project access, required message up to 5,000
  characters) and `accepted` (**organization Owner/Admin only**). No reject, no
  decline, no implicit action, and no new role: the existing customer project
  model is reused, with the existing Owner/Admin check evaluated inside the
  service on every call.
- **Append-only `proposal_responses` history is the source of truth.** A version's
  standing (open / changes requested / accepted) is always derived from those
  rows — there is no stored response state on the proposal, version, or
  project — and there is no update or delete path for a written row.
- **Version binding.** The customer submits the visible version number; the
  server re-derives the current published version under the shared publication
  predicate inside the same transaction that writes. A stale number rejects the
  whole submission and writes nothing — no silent rebinding, no superseded-version
  acceptance, no partial record.
- **The rule table.** Request Changes is allowed while a version is open or
  already has changes requested; Accept is allowed only while a version is open,
  so a version with a change request can no longer be accepted; an accepted
  version is terminal, and the database enforces at most one acceptance per
  version with a partial unique index.
- **Evidence.** Each response appends its audit event
  (`proposal_response.accepted` / `proposal_response.changes_requested`) in the
  same transaction, carrying identifiers only — never the customer's message and
  never proposal content. Reading stays non-mutating with no view event.
- **Endpoint.** `POST /api/projects/{reference}/proposal-response`, a form-post
  endpoint mirroring the intake route, redirecting back with approved notice
  codes from `lib/platform/notices.ts` — no service message ever passes through
  a redirect, and no customer JSON read endpoint exists.
- Acceptance is application-level evidence only: not a signature, no agreement,
  no payment, no activation, and no customer project-stage change —
  `customerStageFor` is untouched and no project-level acceptance state exists.

### Data store

`node:sqlite`, the Node built-in, behind the `PlatformStore` port. It adds no
dependency and keeps local development working without an external service. A
managed database is a separate, later decision; swapping it means writing a new
adapter and changing no authorization or domain rule.

The local database defaults to `.local/customer-platform.sqlite`, which is ignored
by version control. Customer records must never be committed.

### Email delivery

`EmailDelivery` is the boundary. The only implementation in this slice is
`LocalEmailSink`, which keeps messages in memory; no live provider is activated.

### Environment variables

None are required for local development. All are optional:

| Variable | Purpose |
|---|---|
| `CUSTOMER_PLATFORM_DATABASE_PATH` | Database file location, or `:memory:` |
| `CUSTOMER_PLATFORM_MAIL_LOG` | Development-only file the local sink appends delivered sign-in links to, so the flow can be followed locally. Forced off in production |
| `CUSTOMER_PLATFORM_SESSION_TTL_MINUTES` | Session lifetime (default 10080) |
| `CUSTOMER_PLATFORM_SESSION_REFRESH_SECONDS` | Minimum age of a session's last-used timestamp before it is rewritten (default 60). Keeps authenticated page views from becoming a write per request |
| `CUSTOMER_PLATFORM_SIGN_IN_LINK_TTL_MINUTES` | Sign-in link lifetime (default 15) |
| `CUSTOMER_PLATFORM_COOKIE_SAMESITE` | `lax` (default) or `strict` |
| `CUSTOMER_PLATFORM_APP_ORIGIN` | Comma-separated origin allow-list for state-changing requests. When set it is the entire decision; otherwise the request's own origin is used |
| `CUSTOMER_PLATFORM_TRUSTED_PROXY_HOPS` | Number of trusted proxies in front of the app (default **0**) |
| `CUSTOMER_PLATFORM_FOUNDER_EMAIL_HASHES` | Comma-separated SHA-256 hashes of the email addresses that hold the `founder` internal capability. **Empty by default**, so no one has internal access until it is set deliberately. The hash is the same value already used to look a person up by address, so no raw address has to be written into configuration |

### Trusted proxies and rate-limit identity

`X-Forwarded-For` is caller-controlled unless something in front of the application
rewrites it, so honouring it by default would let anyone defeat a rate limit by
changing a header — including the attempts the limit exists to stop. It is
therefore ignored unless `CUSTOMER_PLATFORM_TRUSTED_PROXY_HOPS` declares how many
proxies are in front.

- **Default (`0`)** — forwarding headers are ignored and every caller shares one
  rate-limit bucket. Nothing a caller sends can create a new bucket. The cost is
  that unrelated callers share a budget.
- **Set to the real hop count** — the client address is read counting **from the
  right**, so entries a caller prepends are never used. Behind one proxy with
  `CUSTOMER_PLATFORM_TRUSTED_PROXY_HOPS=1`, the header `spoofed, real-client`
  resolves to `real-client`.

Set it to the number of proxies actually in front of the process. Setting it too
high re-admits header spoofing; setting it too low merges distinct clients into
one bucket, which is the safe direction to err in.

To follow the sign-in flow locally:

```
CUSTOMER_PLATFORM_MAIL_LOG=.local/dev-mail.log npm run dev
```

then read the last line of `.local/dev-mail.log` and open its `signInUrl`.

## Local verification

Requirements:

- **Node.js 22.5 or newer**
- npm

The customer platform's data store uses the built-in `node:sqlite` module, which
Node added in 22.5.0. On an older Node the application still builds — the module is
imported lazily, so nothing loads it at build time — but the first request that
touches the platform would fail. `engines.node` is set accordingly and CI runs on
Node 22.

From this directory:

- npm install
- npm run typecheck
- npm test
- npm run dev
- npm run build

`npm test` compiles `lib/platform` and `tests` with `tsconfig.test.json` into
`.test-build` and runs the built-in Node test runner. No test dependency is added.

Production deployment and live customer operation are not part of the current scaffold.

The application architecture is governed by:

- docs/website/public-portfolio-foundation.md
- docs/website/customer-platform-requirements.md
- applicable Founder-approved decisions in docs/decisions/
