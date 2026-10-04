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

The future authenticated application follows:

**Person → Organization → Projects**

The first implementation slice is intentionally limited to:

**passwordless customer identity → organization creation → customer dashboard → project creation → saved project onboarding progress**

The current product contract is docs/website/customer-platform-requirements.md.

## Local verification

Requirements:

- Node.js 20.9 or newer
- npm

From this directory:

- npm install
- npm run typecheck
- npm run dev
- npm run build

Production deployment and live customer operation are not part of the current scaffold.

The application architecture is governed by:

- docs/website/public-portfolio-foundation.md
- docs/website/customer-platform-requirements.md
- applicable Founder-approved decisions in docs/decisions/
