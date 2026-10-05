# Founder Project Queue: Intake Inbox

**Status:** Accepted  
**Date:** 2026-10-05  
**Founder approval:** Approved 2026-10-05  
**Scope:** Narrow operational index into the existing Founder Review workflow  
**Related:** Customer Platform Direction, Customer Platform Requirements, Customer Platform Foundation, Founder/Internal Workspace and Project Intake Review

> **Status note.** The Founder approved this decision on 2026-10-05. It defines
> one read-only internal listing surface and nothing more. It does not authorize
> production deployment, live customer-data processing, email-provider
> activation, hosting or domain changes, or any other external action.

## Context

The Founder Workspace can open `/internal/projects/{reference}/review` for a
submitted Project Intake. It deliberately has no internal index, so the Founder
must already know a project reference to do anything.

That is the wrong operational shape. References are customer-visible identifiers
allocated at project creation, not something the Founder would hold or recall.
The practical result is that submitted work can sit unreviewed because nobody
could navigate to it.

The gap is entry, not capability. Everything the Founder does after arriving —
reviewing the submission, starting review, recording qualification, the Founder
decision, notes, and the next internal action — already exists and was approved
in `docs/decisions/2026-10-05-customer-platform-founder-workspace.md`. This
decision adds the smallest safe way to reach it.

## Decision

Add a Founder-only, read-only internal queue at `/internal/projects` that lists
projects whose Project Intake has been submitted and links into the existing
review page.

1. **Founder-only.** The queue requires the `founder` internal capability,
   checked server-side before any data is read, exactly as the review page does.
   It is not reachable by any customer role and not linked from customer-facing
   UI.
2. **Read-only in this slice.** Loading the queue performs no write and creates no
   audit event. It cannot start a review, change a customer-facing stage, or
   change any internal field.
3. **Only submitted intake appears.** Projects whose Project Intake is still a
   draft are excluded in SQL, so an unfinished intake is never read and can never
   be displayed.
4. **It is an index, not a second review surface.** Each row links to
   `/internal/projects/{reference}/review`. Review logic, internal state, and the
   review actions stay where they are and are not duplicated here.
5. **Cross-organization by design.** The queue spans every organization. The
   Founder holds the internal capability and membership in no customer
   organization, so customer organization and project access rules are not
   consulted and must not be.
6. **Narrow projection.** A queue row carries project reference, title,
   organization name, intake submission timestamp, customer-facing stage, whether
   review has started, and the link. Nothing else.
7. **Deterministic ordering.** Newest submitted intake first, then project
   reference. Project references are globally unique, which is what makes the
   secondary ordering a total order.
8. **Customer-facing behavior is unchanged.** No customer route, endpoint,
   projection, or authorization rule changes.

### Queue projection

A queue row deliberately excludes:

- internal notes;
- qualification state;
- Founder decision;
- internal next action;
- audit entries and audit metadata;
- Project Intake answers;
- customer identity, authentication, or session data;
- any secret or credential.

These are absent by construction: the projection is built key by key from an
explicit list, in the same way as the customer projections in `views.ts`, so a
column added to the project record later cannot appear in the queue by accident.

The queue answers *what is waiting?* The review page answers *what is in it?*.
Merging the two would put internal assessment state on a listing surface and
make the review page's deliberate separation pointless.

### Data access

The queue reads the existing Project and Project Intake data. No table, column,
or migration is added: the requirement is a query, not new storage.

Ordering and the draft filter are applied in the store, not in the caller, so the
queue cannot disagree with itself between requests and an unfinished intake is
never materialized. The customer-facing, organization-scoped project lookup and
the global reference lookup are both unchanged.

## Verification contract

Tests must cover, against the real services and store:

### Authorization
- an unauthenticated request is rejected;
- a valid customer session is rejected;
- an organization owner/admin without the capability is rejected;
- a holder of the `founder` capability is allowed;
- the capability remains the only authorization path, and remains separate from
  customer roles.

### Data correctness
- a submitted Project Intake appears;
- a draft Project Intake does not appear;
- projects from several organizations appear in the same queue;
- ordering is deterministic and stable across repeated reads;
- project-reference uniqueness is unaffected.

### Boundary
- a queue row contains no internal notes, qualification state, Founder decision,
  internal next action, intake answers, or audit data;
- loading the queue performs no write;
- loading the queue creates no audit event;
- every row links to a reachable review page;
- customer projections and customer project-access rules are unchanged;
- no queue link appears in customer-facing UI.

## Non-goals

Not in this slice:

- filtering, search, or sorting controls;
- pagination;
- bulk actions;
- assignment or ownership of a project;
- editing qualification, decisions, or notes from the queue;
- any queue state, queue workflow, or status field;
- claiming, triaging, or scheduling work.

Each of these, and any future queue workflow, requires a separate Founder
decision. The slice deliberately stops at "find it and open it".

## Acceptance gate

Implementation may proceed only when:

1. this design is Founder-approved;
2. the queue projection excludes every field listed above;
3. the authorization and boundary tests above exist;
4. no production or external provider activation is performed without separate
   authorization.

A merged implementation PR does not authorize production deployment or live
customer-data operation.

## Consequences

The Founder can reach submitted work without holding a reference, which closes
the gap that made the review workflow hard to enter.

The cost is one more internal surface to keep Founder-only and to keep free of
internal assessment state. That is why the projection is narrow by construction
rather than by habit, and why the queue has no actions of its own: the review
page remains the single place internal work happens.

## Alternatives considered

### Make the queue a customer-facing dashboard
Rejected. It would put internal operational state in the customer workspace and
break the separation the Founder Workspace decision established.

### Add queue state, triage, or ownership now
Rejected. None of it is needed to reach submitted work, and each adds internal
state that would need its own authorization, audit, and retention decisions.

### Filter drafts in the page after fetching
Rejected. The intake answers of an unfinished submission would be read for a row
that is then discarded, and the rule would live in the UI instead of the store.

### Reuse the customer project listing
Rejected. The customer listing is organization-scoped and permission-filtered.
Applying those rules here would hide most of the queue from the very person it is
for, and would couple Founder visibility to customer membership.

### Add a queue table
Rejected. The requirement is a query over existing records. A new table would add
storage, a migration, and a second source of truth for no gain.

## Approval

**Status: Accepted. Founder approval: Approved 2026-10-05.**

The Founder approved this slice on 2026-10-05. Approval of this design does not
authorize production deployment, live customer-data operation, or provider
activation.
