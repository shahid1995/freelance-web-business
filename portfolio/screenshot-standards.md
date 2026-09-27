# Portfolio Screenshot Standards

## Purpose

Screenshots are portfolio evidence. They must be accurate, readable, appropriately framed, and safe for a public repository.

## Required checks

Before a screenshot is approved for portfolio use:

- Confirm it represents the actual implemented product or project.
- Remove passwords, API keys, tokens, session IDs, private URLs, and other secrets.
- Remove or mask confidential customer information.
- Remove unnecessary personal information.
- Confirm the visible content is permitted for portfolio use.
- Check that important UI elements are readable at the intended display size.
- Use a clean state when possible.
- Avoid irrelevant browser chrome, debug output, or development artifacts unless they are intentionally part of the evidence.

## Naming

Use lowercase kebab-case filenames.

When a project has multiple screenshots, store them under its project directory:

`portfolio/screenshots/project-name/`

The project directory supplies the project scope, so filenames inside that directory do not need a project-name prefix.

Examples:

- `homepage-desktop.png`
- `dashboard-mobile.png`
- `contact-form-success.png`

## Evidence quality

Screenshots should support a specific claim.

Examples:

- A responsive layout screenshot supports a responsive-design claim.
- A workflow screenshot supports a workflow implementation claim.
- A before/after pair supports a documented visual or structural change.

Do not use screenshots as evidence for claims they cannot demonstrate, such as revenue growth or conversion improvement.

## Before / after

When showing a redesign:

- Use comparable page states where practical.
- Keep framing consistent.
- Label the relationship clearly.
- Do not alter screenshots in a way that changes the underlying evidence.

## Public safety

Because this repository is public, treat every screenshot as potentially sensitive.

Do not commit:

- Credentials
- Private customer data
- Internal-only dashboards unless expressly approved
- Confidential business information
- Personal data that is unnecessary for the portfolio

Sanitize all screenshot evidence before committing it.

## Approval

A screenshot is ready for the public portfolio only after the associated project record confirms:

- ownership/status
- permission requirements
- sensitive-data review
- evidence relevance
