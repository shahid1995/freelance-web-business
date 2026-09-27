# Public Portfolio Website

This directory contains the source for the business's public portfolio website.

## Scope

The website is the public presentation layer for:

- approved business positioning;
- approved services;
- approved portfolio work;
- approved case studies;
- the public contact entry point.

It is not a client-project repository, CRM, private operations system, or source of truth for portfolio permissions.

## Source-of-truth boundary

Use the following repository material as the business authority for website content:

- docs/positioning/
- docs/services/
- docs/sales/freelancer-profile.md
- portfolio/
- docs/website/

Website implementation details belong here. Business decisions and portfolio evidence remain governed by the corresponding source documents.

## Public-safety requirements

Never commit:

- credentials;
- API keys;
- private keys;
- session data;
- client secrets;
- private customer information;
- confidential project material.

Keep runtime secrets outside the repository.

## Publication boundary

A website change may be reviewed and merged without being deployed or published.

Production deployment, domain changes, live integrations, and external publication require explicit Founder authorization.

## Current scaffold

The application scaffold is a Next.js 16 App Router project using TypeScript and plain CSS.

Implemented routes:

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

## Local verification

Requirements:

- Node.js 20.9 or newer
- npm

From this directory:

- npm install
- npm run typecheck
- npm run dev
- npm run build

Production deployment and publication are not part of this scaffold PR.

The application architecture is governed by:

docs/website/public-portfolio-foundation.md
