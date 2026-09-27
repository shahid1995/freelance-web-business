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

## Current foundation

The website information architecture and public-content contract are documented in:

docs/website/public-portfolio-foundation.md

The next implementation step is the application scaffold and route structure.
