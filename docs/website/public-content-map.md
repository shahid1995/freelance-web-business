# Public Content Map

**Status:** Phase 4.3A working document
**Owner:** Founder
**Last updated:** 2026-09-27

This document maps each public website route or content surface to its authoritative source document. It is a traceability aid, not a second source of truth. Where a website-specific wording change would materially alter positioning, service boundaries, pricing language, portfolio representation, or a claim, the change must be recorded and approved before publication.

## Route and content surface map

### `/`

| Surface | Content | Authoritative source |
|---|---|---|
| Primary headline | "Build, modernize, and maintain a better web presence." | docs/positioning/messaging-framework.md — primary message |
| Supporting description | "Business websites, landing pages, and focused web applications with clear scope and practical implementation." | docs/positioning/messaging-framework.md — supporting message |
| Services summary | Six approved services with concise summaries | docs/services/ README.md and individual service documents |
| Working approach | Start from the actual business need, define the work clearly, implement the agreed solution, verify the important behavior, and hand over a maintainable result. | docs/sales/freelancer-profile.md — master profile summary |
| Portfolio status note | Public portfolio work appears only after publication review. | docs/website/public-portfolio-foundation.md — section 5; portfolio/portfolio-index.md |
| Primary CTA | "Discuss your website project" | docs/positioning/messaging-framework.md — call-to-action direction |

**Claims/evidence boundary:** The home page communicates the approved value proposition and introduces services. It does not claim completed portfolio work, client results, credentials, or business outcomes the business cannot guarantee.

### `/services`

| Surface | Content | Authoritative source |
|---|---|---|
| Service overview intro | Each service is structured around a defined business need rather than an open-ended feature list. Scope, deliverables, and boundaries are agreed before implementation. | docs/services/README.md — catalog-wide scope rules |
| Service cards | Title, summary, and link for each of the six approved services | docs/services/ individual service documents |

**Claims/evidence boundary:** The services overview lists the approved catalog. It does not invent additional services, pricing, or service guarantees.

### `/services/[slug]` — each service detail page

| Surface | Content | Authoritative source |
|---|---|---|
| Title and summary | Approved service title and one-line summary | docs/services/ individual service documents |
| What this service is for | Approved purpose statement | docs/services/ individual service documents — Purpose section |
| Typical client need | Approved client/use-case framing | docs/services/ individual service documents — Ideal client / use case; docs/positioning/audience-and-problems.md |
| Good fit for | Approved audience or use-case list | docs/services/ individual service documents — Ideal client / use case |
| Typical scope | Approved scope description | docs/services/ individual service documents — Typical scope |
| Typical deliverables | Approved deliverables list | docs/services/ individual service documents — Core deliverables |
| Typical boundaries | Approved exclusions list | docs/services/ individual service documents — Boundaries / exclusions |
| Service CTA | Descriptive call to action such as "Discuss your website project" | docs/positioning/messaging-framework.md — call-to-action direction |

**Service detail sources:**

- Business Websites — docs/services/business-website.md
- Landing Pages — docs/services/landing-page.md
- Website Redesign and Modernization — docs/services/website-redesign-modernization.md
- Custom Web Applications — docs/services/custom-web-application.md
- Dashboards and Portals — docs/services/dashboard-portal.md
- Website Maintenance and Improvements — docs/services/website-maintenance-improvements.md

**Claims/evidence boundary:** Each service page describes the approved service, typical client need, deliverables, and boundaries. It does not claim guaranteed outcomes, client results, or pricing.

### `/work`

| Surface | Content | Authoritative source |
|---|---|---|
| Page introduction | Selected work will appear here as it becomes publication-ready. | docs/website/public-portfolio-foundation.md — section 3 Work/Portfolio |
| Current portfolio status | The portfolio registry currently contains candidate concepts. | portfolio/portfolio-index.md — Portfolio registry |
| Current concept slots | Modern Business Website, SaaS Landing Page, Financial Analytics Dashboard, Customer Portal, Website Redesign — Before/After | portfolio/portfolio-index.md — Portfolio registry |
| Slot disclaimer | These are portfolio slots, not claims of completed client work. | portfolio/portfolio-index.md — paragraph 2 of Portfolio registry |
| Publication requirements | Completed project record, ownership and role, defined scope, evidence, approved screenshots, permission confirmation, reviewed case study. | docs/website/public-portfolio-foundation.md — section 5; portfolio/portfolio-index.md — Portfolio item requirements |
| Ownership categories | Client, Founder-owned, Demonstration, Concept. | portfolio/portfolio-index.md — Publication rules |
| Concept note | Concept or demonstration work remains clearly labeled. | docs/website/public-portfolio-foundation.md — section 5 |

**Claims/evidence boundary:** The Work page is explicit that current items are candidate concepts, not completed client work. It does not present fabricated projects, screenshots, case studies, clients, outcomes, metrics, links, or roles.

### `/about`

| Surface | Content | Authoritative source |
|---|---|---|
| Business description | I build, modernize, and maintain business websites and focused web applications with clear scope, practical usability, and maintainable implementation. | docs/sales/freelancer-profile.md — master profile summary; docs/positioning/business-positioning.md — short public description |
| Service coverage | Business websites, landing pages, website redesign and modernization, custom web applications, dashboards and portals, and website maintenance and improvements. | docs/sales/freelancer-profile.md — master profile summary |
| Projects approached around the actual business need | Building a professional web presence, making an existing site clearer and more usable, improving important user flows, or implementing focused functionality beyond a standard marketing website. | docs/sales/freelancer-profile.md — master profile summary |
| Working approach | Each project starts from the real business need. Scope, deliverables, and boundaries are defined before implementation. The agreed solution is implemented, the important behavior is verified, and an organized handover is provided. | docs/sales/freelancer-profile.md — master profile summary; docs/positioning/business-positioning.md — differentiation |
| Audience | Small and medium-sized businesses, startup founders and early-stage companies, consultants and professional-service businesses, agencies needing additional web-development capacity, SaaS founders and product teams, and businesses with outdated, confusing, slow, or poorly maintained websites. | docs/sales/freelancer-profile.md — section 6; docs/positioning/audience-and-problems.md |
| Delivery standards | Clear scope and deliverables, modern responsive implementation, practical usability, maintainable implementation, appropriate attention to accessibility/performance/security/integrations, structured handover, honest representation of capabilities and results. | docs/sales/freelancer-profile.md — section 7; docs/positioning/business-positioning.md — section 6 |
| What the business is not | Not a full-service marketing agency, guaranteed SEO or lead-generation provider, branding agency, large software consultancy, provider of guaranteed revenue or conversion outcomes, or low-cost "anything for anyone" development service. | docs/positioning/business-positioning.md — section 7 |

**Claims/evidence boundary:** The About page derives its claims from the approved freelancer profile and positioning documents. It does not add unsupported personal credentials, years of experience, certifications, named clients, testimonials, project results, metrics, rankings, awards, pricing, or guaranteed outcomes.

### `/contact`

| Surface | Content | Authoritative source |
|---|---|---|
| Page purpose | Start a conversation about a website or web application project. | docs/website/public-portfolio-foundation.md — section 3 Contact/Project Discussion |
| Non-live notice | The public contact flow is the next Phase 4 work item. No contact form or external submission integration is enabled. | docs/website/public-portfolio-foundation.md — section 3; current contact page implementation |

**Claims/evidence boundary:** The Contact page remains non-live. It does not collect submissions, integrate with email or CRM, or imply a working contact pipeline.

## Reusable content package

A typed content package exists at `website/lib/content.ts` for shared public messaging that multiple routes consume, including:

- `site.name`
- `site.tagline`
- `site.shortDescription`
- `site.description`
- `messaging.primary`
- `messaging.supporting`
- `messaging.approach`
- `messaging.ctaPrimary`
- `messaging.ctaSecondary`
- `messaging.ctaWork`
- `portfolioStatus.*`

This package is derived from the authoritative sources above and is intended for consistency across routes, not as an override of them.

## Content source hierarchy

Public website content is derived from approved repository sources in this order:

1. Founder-approved business rules and decisions
2. Approved positioning and messaging
3. Approved service definitions
4. Approved freelancer profile and sales language
5. Approved portfolio registry and project records
6. Approved case studies and evidence
7. Website implementation details

`docs/website/public-portfolio-foundation.md` — section 4

## Claims and language controls

Prefer concrete descriptive language such as what was built, what was modernized, what workflow was implemented, what service was delivered, which responsive or functional behaviors were verified, and what measurable result was actually recorded.

Avoid claims such as best, #1, guaranteed conversions, guaranteed leads, guaranteed revenue, world-class, award-winning, and proven results without specific evidence.

`docs/website/public-portfolio-foundation.md` — section 6; `docs/positioning/messaging-framework.md` — language to avoid

## Accessibility and metadata baseline

Each public route is expected to have meaningful metadata, a correct heading hierarchy, descriptive links, accessible names, semantic HTML, visible focus states, and responsive and reduced-motion behavior where applicable.

`docs/website/public-portfolio-foundation.md` — sections 8 and 10

## Maintenance rule

Website copy should be updated from the authoritative source documents first, then reflected in the website implementation. If a discrepancy appears between a website route and its mapped source, correct the website to match the approved source unless a deliberate change has been recorded and approved.
