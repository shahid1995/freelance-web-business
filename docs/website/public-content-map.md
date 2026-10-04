# Public Content Map

**Status:** Phase 4.3A working document; customer-platform direction added 2026-10-04  
**Owner:** Founder  
**Last updated:** 2026-10-04

This document maps public website content to its authoritative source. It is a traceability aid, not a second source of truth. Customer-platform behavior is governed by docs/website/customer-platform-requirements.md and Founder-approved decisions.

## Route and content surface map

### /

| Surface | Content | Authoritative source |
|---|---|---|
| Primary headline | "Build, modernize, and maintain a better web presence." | docs/positioning/messaging-framework.md — primary message |
| Supporting description | "Business websites, landing pages, and focused web applications with clear scope and practical implementation." | docs/positioning/messaging-framework.md — supporting message |
| Services summary | Six approved services with concise summaries | docs/services/README.md and individual service documents |
| Working approach | Start from the actual business need, define the work clearly, implement the agreed solution, verify the important behavior, and hand over a maintainable result. | docs/sales/freelancer-profile.md — master profile summary |
| Portfolio status note | Public portfolio work appears only after publication review. | docs/website/public-portfolio-foundation.md — portfolio controls |
| Primary CTA | "Discuss your website project" | docs/positioning/messaging-framework.md — call-to-action direction |

**Claims/evidence boundary:** The home page does not claim completed portfolio work, client results, credentials, or business outcomes the business cannot guarantee.

### /services

| Surface | Content | Authoritative source |
|---|---|---|
| Service overview intro | Each service is structured around a defined business need rather than an open-ended feature list. Scope, deliverables, and boundaries are agreed before implementation. | docs/services/README.md — catalog-wide scope rules |
| Service cards | Title, summary, and link for each approved service | docs/services/ individual service documents |

**Claims/evidence boundary:** The services overview does not invent additional services, pricing, or guarantees.

### /services/[slug]

| Surface | Content | Authoritative source |
|---|---|---|
| Title and summary | Approved service title and one-line summary | docs/services/ individual service documents |
| What this service is for | Approved purpose statement | docs/services/ individual service documents |
| Typical client need | Approved client/use-case framing | docs/services/ individual service documents; docs/positioning/audience-and-problems.md |
| Good fit for | Approved audience/use-case list | docs/services/ individual service documents |
| Typical scope | Approved scope description | docs/services/ individual service documents |
| Typical deliverables | Approved deliverables list | docs/services/ individual service documents |
| Typical boundaries | Approved exclusions list | docs/services/ individual service documents |
| Service CTA | Descriptive call to action such as "Discuss your website project" | docs/positioning/messaging-framework.md |

**Claims/evidence boundary:** Service pages describe the approved service and boundaries. They do not claim guaranteed outcomes, client results, or pricing.

### /work

| Surface | Content | Authoritative source |
|---|---|---|
| Page introduction | Selected work will appear here as it becomes publication-ready. | docs/website/public-portfolio-foundation.md — portfolio section |
| Current portfolio status | The portfolio registry currently contains candidate concepts. | portfolio/portfolio-index.md |
| Slot disclaimer | These are portfolio slots, not claims of completed client work. | portfolio/portfolio-index.md |
| Publication requirements | Completed project record, ownership and role, defined scope, evidence, approved screenshots, permission confirmation, reviewed case study. | docs/website/public-portfolio-foundation.md; portfolio/portfolio-index.md |
| Ownership categories | Client, Founder-owned, Demonstration, Concept. | portfolio/portfolio-index.md |

**Claims/evidence boundary:** The Work page does not present fabricated projects, clients, outcomes, metrics, links, or roles.

### /about

| Surface | Content | Authoritative source |
|---|---|---|
| Business description | Approved freelancer/profile description | docs/sales/freelancer-profile.md; docs/positioning/business-positioning.md |
| Service coverage | Six approved service categories | docs/sales/freelancer-profile.md |
| Working approach | Start from the real business need, define scope clearly, implement the agreed solution, verify important behavior, and provide an organized handover. | docs/sales/freelancer-profile.md; docs/positioning/business-positioning.md |
| Audience | Approved audience groups | docs/sales/freelancer-profile.md; docs/positioning/audience-and-problems.md |
| Delivery standards | Approved observable delivery characteristics | docs/sales/freelancer-profile.md; docs/positioning/business-positioning.md |

**Claims/evidence boundary:** The About page does not add unsupported credentials, results, client names, metrics, rankings, awards, pricing, or guarantees.

### /contact

| Surface | Content | Authoritative source |
|---|---|---|
| Page purpose | Start a conversation about a website or web application project. | docs/website/public-portfolio-foundation.md — Contact / Project Discussion |
| Current state | The route is currently non-live and remains a public project-discussion entry point until the first authenticated customer-platform slice is implemented and authorized. | docs/website/customer-platform-requirements.md |
| Future behavior | Sign-in → organization → dashboard → Start Your Project → saved project onboarding | docs/website/customer-platform-requirements.md |

**Claims/evidence boundary:** Until the customer-platform implementation is explicitly authorized for live use, the Contact page must not claim a live submission pipeline.

## Future authenticated application surfaces

These are product requirements, not yet public route commitments.

| Surface | Future purpose | Authority |
|---|---|---|
| Customer sign-in | Passwordless customer authentication | docs/website/customer-platform-requirements.md |
| Customer dashboard | Organization/project overview and required actions | docs/website/customer-platform-requirements.md |
| Start Your Project | Create a project and save onboarding progress | docs/website/customer-platform-requirements.md |
| Project workspace | Communication, documents, timeline, approvals, milestones | docs/website/customer-platform-requirements.md |
| Proposal | Review proposal versions and accept/request changes | docs/website/customer-platform-requirements.md |
| Agreement | Future agreement/signature workflow | docs/website/customer-platform-requirements.md |
| Payments | Future online payment workflow | docs/website/customer-platform-requirements.md |
| Delivery workspace | Discovery, scope, milestones, reviews, QA, handover, closure | docs/website/customer-platform-requirements.md |
| Founder workspace | Internal live operational views | docs/website/customer-platform-requirements.md |

These authenticated surfaces require a secure application data boundary and are not implemented by the current public-site scaffold.

## Content source hierarchy

Public website content is derived from approved repository sources in this order:

1. Founder-approved business rules and decisions
2. Approved positioning and messaging
3. Approved service definitions
4. Approved freelancer profile and sales language
5. Approved portfolio registry and project records
6. Approved case studies and evidence
7. Website implementation details

Customer-platform behavior is governed separately by docs/website/customer-platform-requirements.md and applicable decisions.

## Claims and language controls

Prefer concrete descriptive language. Avoid unsupported superlatives, guaranteed outcomes, fabricated work/results, or internal qualification-state terminology on customer-facing surfaces.

## Accessibility and metadata baseline

Each public route is expected to have meaningful metadata, a correct heading hierarchy, descriptive links, accessible names, semantic HTML, visible focus states, and responsive and reduced-motion behavior where applicable.

Authenticated customer workflows must also provide accessible status, validation, errors, file controls, review/approval controls, and navigation.

## Maintenance rule

Website copy should be updated from authoritative sources first, then reflected in implementation. Customer-platform behavior should be changed through the requirements/decision hierarchy, not by silently modifying public content.
