# Public Website and Customer Platform Foundation

**Status:** Phase 4 working foundation  
**Owner:** Founder  
**Last updated:** 2026-10-04

## 1. Purpose

The public website is the external-facing presentation layer for the business and the entry point to the future customer-facing application.

It should make the business understandable, show verified work and capabilities, provide a clear next step for prospective clients, and eventually support the authenticated customer journey from project inquiry through delivery and closure.

GitHub remains the source of truth for business rules, approved messaging, portfolio evidence, reusable content, and material product decisions. The future application may store live customer/project records in a secure application data boundary.

## 2. Primary objectives

The public website should:

- explain what the business does in plain language;
- present the approved service catalog;
- show portfolio work with accurate ownership and evidence;
- communicate the actual role performed on showcased work;
- make the next client step obvious;
- work well on mobile and desktop;
- load efficiently and remain maintainable;
- preserve a clear separation between public content and private project information.

The future authenticated application should:

- provide customer identity and organization workspaces;
- connect customers to multiple projects;
- provide guided project onboarding;
- support the approved sales and delivery lifecycle;
- keep customer communication inside the application;
- protect live customer/project data with role-based access;
- maintain a clear audit trail for material actions.

The application must not become the client source-code repository or replace GitHub as the source of business rules and application history.

## 3. Public information architecture

The initial public information architecture is:

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
- route a customer into the future authenticated onboarding flow;
- collect only the information necessary for the relevant sales stage.

The current route remains non-live until the approved customer-platform implementation is activated and explicitly authorized for live use.

## 4. Customer platform direction

The future authenticated application follows:

**Person → Organization → Projects**

Approved initial experience:

**Passwordless email → Organization creation → Customer dashboard → Start Your Project → Saved onboarding**

Each organization may have multiple projects.

Customer communication is primarily inside the application. Email is initially a notification/authentication channel.

The future customer timeline may expose:

**Account created → Project started → Information submitted → Review → Requirements confirmed → Proposal prepared → Proposal accepted → Agreement completed → Payment satisfied → Project setup → Milestones → Client review → QA → Handover → Completed**

Internal qualification states remain internal and must not appear as customer-facing labels.

The full requirements are defined in docs/website/customer-platform-requirements.md.

## 5. Content source hierarchy

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

Where a website-specific wording change materially alters positioning, service boundaries, pricing language, portfolio representation, or a claim, record and approve the change before publication.

## 6. Portfolio publication rules

The website must follow the portfolio evidence controls.

A portfolio item may be publicly shown only when:

- ownership/status is accurate;
- a completed project record exists with the defined scope and actual role;
- the actual role is accurately represented;
- major claims are evidence-backed;
- required client/publication permission exists;
- the case study or public portfolio content has passed confidentiality and factual-accuracy review;
- confidential information has been removed;
- screenshots and links are approved;
- unsupported outcomes, rankings, or superlatives are excluded.

Concept or demonstration work must remain clearly labeled.

Closure of a client project does not automatically grant public portfolio rights.

## 7. Claims and messaging controls

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

Do not imply a client relationship, credential, testimonial, metric, or result unless the repository contains supporting evidence and permission where required.

## 8. Design and UX principles

The public site and future customer application should prioritize:

- clear hierarchy;
- readable typography;
- strong spacing and grouping;
- obvious primary and secondary actions;
- consistent navigation;
- responsive behavior;
- accessible focus and interaction states;
- concise content with useful detail;
- visible evidence rather than decorative claims;
- predictable behavior across common viewport sizes;
- clear customer actions when an interaction or approval is required.

## 9. Accessibility requirements

The product should support:

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

Authenticated customer workflows must also provide accessible status, validation, errors, file controls, review/approval controls, and navigation.

Automated checks and manual verification should both be used where practical.

## 10. Performance requirements

The implementation should favor:

- minimal unnecessary JavaScript;
- appropriately sized images;
- responsive image delivery;
- efficient fonts and assets;
- avoidance of avoidable blocking work;
- stable layout behavior;
- measured performance rather than unsupported performance claims.

No performance guarantee should be published unless the measurement and target are explicitly supported.

Future application functionality must not add unnecessary client-side complexity when a simpler server-side or progressive interaction is sufficient.

## 11. SEO and sharing foundation

Where relevant, each public route should have:

- a meaningful title;
- a useful description;
- a canonical URL strategy;
- correct heading structure;
- descriptive links;
- appropriate social sharing metadata;
- indexability controls appropriate to publication state.

Authenticated application surfaces should not be treated as public indexed content.

## 12. Privacy and security boundary

Never place the following in public website source or output:

- passwords;
- API keys;
- private keys;
- session identifiers;
- client credentials;
- private customer data;
- confidential project documents;
- internal-only records;
- sensitive payment information.

Forms and third-party integrations must use approved secure configuration and environment handling.

The customer application must keep live organization/project records behind authentication and authorization.

## 13. Environment and deployment boundary

Website/application source may be prepared and verified in GitHub without authorizing production publication.

Keep:

- source code in the business repository;
- development/test configuration separate from production secrets;
- secrets outside Git;
- deployment configuration reviewable;
- production changes subject to explicit Founder authorization.

A merged PR does not itself authorize deployment or publication.

## 14. Initial public route set

The initial public site supports:

| Route | Purpose | Implementation status |
|---|---|---|
| / | Core value proposition and primary CTA | Implemented, unpublished |
| /services | Service overview | Implemented, unpublished |
| /services/business-websites | Business website service | Implemented, unpublished |
| /services/landing-pages | Landing page service | Implemented, unpublished |
| /services/redesign-modernization | Redesign service | Implemented, unpublished |
| /services/custom-web-applications | Custom application service | Implemented, unpublished |
| /services/dashboards-portals | Dashboard/portal service | Implemented, unpublished |
| /services/maintenance-improvements | Maintenance service | Implemented, unpublished |
| /work | Portfolio registry presentation | Implemented, unpublished |
| /about | Business and working approach | Implemented, unpublished |
| /contact | Project discussion entry point | Implemented, non-live, unpublished |

Authenticated customer application surfaces are governed by customer-platform requirements and are not limited to the public route list above.

A route can remain unlinked or unpublished until its content and evidence are approved.


## 15. Data and source boundary

The website may consume sanitized portfolio data derived from:

- portfolio/portfolio-index.md;
- individual project records;
- approved case studies;
- approved screenshot/evidence references.

The future application may store live customer/project data in a secure application data store.

The application must not become a second source of truth for business rules, portfolio publication permissions, or material Founder decisions.

Where a conflict exists, the approved repository record takes precedence for business policy and public claims.

## 16. Foundation readiness

The Phase 4 foundation now includes:

- [x] Public information architecture.
- [x] Initial public routes.
- [x] Source hierarchy.
- [x] Portfolio publication boundaries.
- [x] Claims controls.
- [x] Accessibility requirements.
- [x] Performance requirements.
- [x] Privacy/security boundaries.
- [x] Deployment/publication authority.
- [x] Public website source separated from client source repositories.
- [x] Customer platform direction approved.
- [x] Customer platform requirements documented.
- [x] Hosting/domain work explicitly deferred.
- [x] Analytics explicitly deferred.

## 17. Customer-platform implementation status

The first secure customer-platform vertical path is implemented and merged:

**Passwordless customer identity → Organization creation → Customer dashboard → Project creation → Saved project onboarding progress**

Its data boundary, authentication, authorization, privacy, and verification requirements were designed in advance and recorded in docs/decisions/2026-10-04-customer-platform-foundation.md.

The slice is not deployed or activated for live customers. The next design gate is the Founder/internal workspace and Project Intake review, proposed in docs/decisions/2026-10-05-customer-platform-founder-workspace.md (Status Proposed; Founder approval pending).

No production deployment, live payment processing, live e-signature, AI/LLM integration, or public customer-data operation is included in this step.
