# Public Portfolio Website Foundation

**Status:** Phase 4 working foundation  
**Owner:** Founder  
**Last updated:** 2026-09-27

## 1. Purpose

The public portfolio website is the external-facing presentation layer for the business.

It should make the business understandable, show verified work and capabilities, and provide a clear next step for prospective clients without inventing credentials, outcomes, client relationships, or proof.

The website is a presentation layer. GitHub remains the source of truth for the business rules, approved messaging, portfolio evidence, and reusable content that the website consumes.

## 2. Primary objectives

The website should:

- explain what the business does in plain language;
- present the approved service catalog;
- show portfolio work with accurate ownership and evidence;
- communicate the actual role performed on showcased work;
- make the next client step obvious;
- work well on mobile and desktop;
- load efficiently and remain maintainable;
- preserve a clear separation between public content and private project information.

The website should not become the client-project repository, internal operations system, or sales CRM.

## 3. Public information architecture

The initial information architecture is:

### Home

Purpose:
- communicate the core value proposition;
- introduce major services;
- show selected verified work;
- establish trust through concrete evidence;
- provide a primary call to action.

### Services

Purpose:
- explain the six approved services;
- describe what each service is for;
- clarify typical scope and boundaries;
- route visitors toward the relevant project conversation.

Services:

1. Business Websites
2. Landing Pages
3. Website Redesign and Modernization
4. Custom Web Applications
5. Dashboards and Portals
6. Website Maintenance and Improvements

### Work / Portfolio

Purpose:
- present approved portfolio items;
- distinguish Client, Founder-owned, Demonstration, and Concept work;
- connect visible claims to evidence;
- provide enough context for a prospective client to understand the type of work.

Only items that meet portfolio publication requirements should be presented as published work.

### About

Purpose:
- explain the business and working approach;
- describe the approved positioning and service model;
- avoid unsupported personal or business credentials.

The page should derive claims from the approved freelancer profile and positioning documents.

### Contact / Project Discussion

Purpose:
- provide a clear entry point for a prospective client;
- collect only the information necessary to begin qualification;
- route the submission into the approved sales process.

The final contact mechanism is a separate Phase 4 work item.

## 4. Content source hierarchy

Public website content should be derived from approved repository sources.

Use this order:

1. Founder-approved business rules and decisions
2. Approved positioning and messaging
3. Approved service definitions
4. Approved freelancer profile and sales language
5. Approved portfolio registry and project records
6. Approved case studies and evidence
7. Website implementation details

Implementation copy must not silently override an approved business rule or public claim.

Where a website-specific wording change would materially alter positioning, service boundaries, pricing language, portfolio representation, or a claim, record and approve the change before publication.

## 5. Portfolio publication rules

The website must follow the portfolio evidence controls.

A portfolio item may be publicly shown only when:

- ownership/status is accurate;
- the project record exists;
- the actual role is accurately represented;
- major claims are evidence-backed;
- required client/publication permission exists;
- confidential information has been removed;
- screenshots and links are approved;
- unsupported outcomes, rankings, or superlatives are excluded.

Concept or demonstration work must remain clearly labeled.

Closure of a client project does not automatically grant public portfolio rights.

## 6. Claims and messaging controls

Prefer concrete descriptive language such as:

- what was built;
- what was modernized;
- what workflow was implemented;
- what service was delivered;
- which responsive or functional behaviors were verified;
- what measurable result was actually recorded.

Avoid claims such as:

- best;
- #1;
- guaranteed conversions;
- guaranteed leads;
- guaranteed revenue;
- world-class;
- award-winning;
- proven results without specific evidence.

Do not imply a client relationship, credential, testimonial, metric, or result unless the repository contains the supporting evidence and permission where required.

## 7. Design and UX principles

The public site should prioritize:

- clear hierarchy;
- readable typography;
- strong spacing and grouping;
- obvious primary and secondary actions;
- consistent navigation;
- responsive behavior;
- accessible focus and interaction states;
- concise content with useful detail;
- visible evidence rather than decorative claims;
- predictable behavior across common viewport sizes.

Design should communicate competence through clarity and evidence rather than excessive visual effects.

## 8. Accessibility requirements

The site should be built to support:

- semantic HTML;
- keyboard navigation;
- visible focus states;
- meaningful headings;
- accessible names and labels for controls;
- usable forms;
- sufficient text contrast;
- meaningful alternative text for informative images;
- reduced-motion preferences where motion is used;
- responsive text and layout behavior.

Automated checks and manual verification should both be used where practical.

## 9. Performance requirements

The implementation should favor:

- minimal unnecessary JavaScript;
- appropriately sized images;
- responsive image delivery;
- efficient fonts and assets;
- avoidance of avoidable blocking work;
- simple page structures;
- stable layout behavior;
- measured performance rather than unsupported performance claims.

No performance guarantee should be published unless the measurement and target are explicitly supported.

## 10. SEO and sharing foundation

Where relevant, each public route should have:

- a meaningful title;
- a useful description;
- a canonical URL strategy;
- correct heading structure;
- descriptive links;
- appropriate social sharing metadata;
- indexability controls appropriate to the publication state.

Draft, restricted, or internal content must not be accidentally exposed as published portfolio material.

## 11. Privacy and security boundary

Never place the following in the public website source or output:

- passwords;
- API keys;
- private keys;
- session identifiers;
- client credentials;
- private customer data;
- confidential project documents;
- internal-only dashboards or records.

Forms and third-party integrations must use approved secure configuration and environment handling.

The public website should not expose client-specific project records that belong in the client's repository.

## 12. Environment and deployment boundary

The website source may be prepared and verified in GitHub without authorizing production publication.

Keep:

- source code in the business repository;
- development/test configuration separate from production secrets;
- secrets outside Git;
- deployment configuration reviewable;
- production changes subject to explicit Founder authorization.

A merged PR does not itself authorize deployment or publication.

## 13. Initial route set

The initial site should be able to support:

| Route | Purpose | Publication status |
|---|---|---|
| / | Core value proposition and primary CTA | Planned |
| /services | Service overview | Planned |
| /services/business-websites | Business website service | Planned |
| /services/landing-pages | Landing page service | Planned |
| /services/redesign-modernization | Redesign service | Planned |
| /services/custom-web-applications | Custom application service | Planned |
| /services/dashboards-portals | Dashboard/portal service | Planned |
| /services/maintenance-improvements | Maintenance service | Planned |
| /work | Portfolio registry presentation | Planned |
| /about | Business and working approach | Planned |
| /contact | Project discussion entry point | Planned |

A route can remain unlinked or unpublished until its content and evidence are approved.

## 14. Portfolio data boundary

The website may consume sanitized portfolio data derived from:

- portfolio/portfolio-index.md
- individual project records;
- approved case studies;
- approved screenshot/evidence references.

The website must not become a second source of truth for project status, ownership, evidence, or publication permissions.

Where a conflict exists, the approved repository record takes precedence and the website content should be corrected.

## 15. Acceptance criteria for the website foundation

Before the website foundation is considered ready for implementation:

- [ ] Information architecture is defined.
- [ ] Initial public routes are identified.
- [ ] Source hierarchy is defined.
- [ ] Portfolio publication boundaries are explicit.
- [ ] Claims controls are explicit.
- [ ] Accessibility requirements are defined.
- [ ] Performance requirements are defined.
- [ ] Privacy/security boundaries are defined.
- [ ] Deployment/publication authority is preserved.
- [ ] Website source is clearly separated from client project repositories.
- [ ] Contact flow is identified as a separate work item.
- [ ] Domain/hosting and analytics remain separate Phase 4 work items.

## 16. Next implementation step

The next Phase 4 implementation step is to create the website source scaffold inside website/, using this foundation as the contract.

The scaffold should establish the approved route structure, shared layout/navigation, reusable content boundaries, accessibility baseline, and local verification workflow before domain, hosting, contact submission, analytics, or production publication work is introduced.
