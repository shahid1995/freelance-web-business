# ADR-001: Public Contact Copy Uses Customer-Facing Language Only

**Status:** Approved
**Date:** 2026-10-04
**Founder approval:** Approved in the current project decision
**Scope:** Public website copy — Contact page

## Context

The Phase 4.4B page-composition work restructured the public Contact page. Two
problems were identified during verification of that work:

1. **Internal project-management and engineering terminology was publicly
   visible.** The Contact page described the state of the website using internal
   vocabulary — referencing a "Phase 4 work item", calling the current build a
   "scaffold", and mentioning "production side effects". These are internal
   engineering and planning terms. They describe how the work is organised
   internally, not anything a prospective client needs in order to understand
   whether they can work with the business.

2. **The internal qualification workflow had been surfaced publicly.** The
   sections "What to tell us" and "What happens next" reproduced material from
   `docs/sales/qualification-flow.md` verbatim, including the internal
   qualification outcome states — *Qualified*, *Clarification required*, *Not a
   fit*, and *No decision*.

The second item was flagged at the time as requiring a Founder content decision
before it could proceed, because rewriting approved copy is the Founder's
authority rather than the implementation agent's. This ADR records that
decision.

The underlying tension: the Contact page genuinely needs to tell a visitor what
information is useful to have ready, and what generally happens after they get
in touch. Both can be communicated without republishing the internal sales
process.

## Decision

1. **Internal terminology does not appear on the public website.** Public copy
   must not expose internal phase names, internal planning or engineering terms
   ("Phase 4 work item", "scaffold", "production side effects"), or internal
   qualification-state terminology ("Qualified", "Clarification required", "Not
   a fit", "No decision").

2. **The internal qualification workflow is not published verbatim.** The
   Contact page explains, in customer-facing language, what information is
   useful for a project discussion and what generally happens next. It does not
   reproduce internal questionnaires, internal state names, or the internal
   process documentation.

3. **Process language must not create expectations that are not approved.** The
   public description of "what happens next" must not promise a proposal, a
   delivery date, a response time, or acceptance of any project.

## Consequences

- The Contact page can still be genuinely useful: it explains what details help
  a discussion and what the general next step looks like, in language a
  prospective client understands.
- The internal qualification process remains an internal artefact under
  `docs/sales/`. Publishing it is no longer a copy shortcut; public guidance is
  written for the audience it addresses.
- Any future Contact copy that reintroduces internal phase names, engineering
  vocabulary, or internal qualification-state names is a defect against this
  decision, not a stylistic preference.
- No contact mechanism was introduced by this decision. Contact options remain
  unresolved and are stated plainly as such.
- Changing public copy remains Founder-controlled. This ADR records a decision
  about copy standards; it does not grant the implementation agent authority to
  rewrite approved copy on its own.

## Alternatives considered

- **Keep the internal wording, restrict access to it.** Rejected. The terms are
  on a public marketing surface; the audience is prospective clients, who have
  no context for them.
- **Publish the qualification flow as-is and treat it as transparency.**
  Rejected. It describes an internal sales control rather than a customer-facing
  process, and it commits the business to language about how opportunities are
  judged that the Founder has not approved for public use.
- **Remove the sections entirely.** Rejected. They carry real utility. The
  information value can be preserved without the internal framing, so deleting
  useful content is an unnecessary loss.
- **Rewrite in place without a governance record.** Rejected. A permanent record
  prevents the same problem recurring and makes the standard auditable, which
  the `docs/decisions/` mechanism exists to provide.