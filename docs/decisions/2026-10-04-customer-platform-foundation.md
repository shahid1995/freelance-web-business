# Customer Platform Foundation: Identity, Organization, Project, and Intake Boundary

**Status:** Accepted  
**Date:** 2026-10-04  
**Founder approval:** Approved 2026-10-05  
**Scope:** Stage 1 design gate for the first customer-platform implementation slice  
**Related:** Customer Platform Direction and Customer Platform Requirements

## Context

PR #33 established the Founder-approved direction for the website to evolve into a unified customer platform.

The first implementation slice is intentionally narrow:

**Passwordless customer identity → Organization creation → Customer dashboard → Project creation → Saved Project Intake progress**

The repository currently contains only the public Next.js website. It does not yet define the live application data boundary, authentication/session boundary, authorization rules at the API/server boundary, or the verification contract for this slice.

Those boundaries must be explicit before application behavior is implemented.

This decision is a design gate. It does not authorize production deployment, live customer-data processing, email-provider activation, hosting changes, or other external integrations.

## Decision

Use a provider-neutral, server-authoritative foundation with these boundaries:

1. Next.js remains the application surface.
2. Live customer data is stored outside the public Git repository in a secure relational application data store.
3. Authentication uses passwordless email with a single-use verification link.
4. Authentication, authorization, and project access are enforced on the server, not only in the browser.
5. Organization membership is the primary customer authorization boundary.
6. Project access is additionally enforced for ordinary members.
7. Owner/Admin access is implicit to every project in their organization.
8. Project Intake progress belongs to a project and is persisted independently of the public website content model.
9. Customer-facing API/view models must not expose internal qualification states or other Founder-only operational fields.
10. Email delivery and database providers remain replaceable through application interfaces until separately approved.

## 1. Logical data model

The first slice requires these logical records.

### Person

Represents an authenticated individual.

Minimum fields:
- opaque person identifier;
- normalized email address;
- email verification timestamp;
- created timestamp;
- updated timestamp.

The email address is identity data and must remain in the private application data store.

### Organization

Represents the customer relationship container.

Minimum fields:
- opaque organization identifier;
- organization name;
- created timestamp;
- updated timestamp.

### Organization Membership

Connects a person to an organization.

Minimum roles:
- owner;
- admin;
- member.

Rules:
- The first verified person creating an organization becomes owner.
- Owner/Admin can administer the organization and see all projects in it.
- A member belongs to an organization but does not receive access to every project automatically.

### Project

Represents the stable operational record created when the customer selects Start Your Project.

Minimum fields:
- opaque project identifier;
- organization identifier;
- created-by person identifier;
- customer-facing lifecycle state;
- created timestamp;
- updated timestamp.

The project is created immediately and remains the stable parent record throughout the lifecycle.

Internal qualification state may exist later as a separate internal field, but it is not part of the customer-facing contract.

### Project Access

Controls ordinary member visibility.

Rules:
- Owner/Admin access is organization-wide by default.
- Ordinary members require explicit project assignment.
- Removing an ordinary member's project assignment removes access to that project.
- Membership in one project must never imply access to another project.

### Project Intake

Stores the saved customer onboarding/intake progress for a project.

The first version should support:
- draft fields corresponding to approved Project Intake requirements;
- draft/submitted status;
- last-saved timestamp;
- schema/version identifier so future question changes do not corrupt older drafts.

The exact field list remains derived from approved requirements and discovery sources rather than being copied directly from internal qualification documentation.

### Authentication Challenge

Represents a passwordless sign-in request.

Minimum properties:
- challenge identifier;
- person identifier or pending-email identity;
- hashed one-time secret;
- expiration timestamp;
- consumed timestamp;
- created timestamp;
- security/rate-limit metadata as required.

Raw one-time secrets must never be stored.

### Session

Represents an authenticated browser session.

Minimum properties:
- opaque session identifier;
- person identifier;
- issued timestamp;
- expiration timestamp;
- revoked timestamp, when applicable.

Session material must be stored and transported using secure server-side session practices.

### Audit Event

Records material security and customer actions.

The first slice should at minimum be able to record:
- sign-in challenge requested;
- successful sign-in;
- organization created;
- membership role assigned;
- project created;
- Project Intake saved;
- Project Intake submitted.

Exact retention is deferred to a later security decision.

## 2. Authentication boundary

The initial authentication flow is:

**Enter email → receive one-time link → verify link → authenticated session**

Required controls:
- one-time link is single-use;
- link expires after a short, configurable interval;
- stored secret is hashed rather than stored in raw form;
- verification consumes the challenge atomically;
- repeated use of a consumed link is rejected;
- sign-in requests are rate-limited;
- verification attempts are rate-limited;
- responses must avoid revealing whether an arbitrary email is already registered;
- authentication secrets and session identifiers are never written to application logs.

The browser should receive only an authenticated session mechanism, not reusable authentication secrets.

## 3. Session boundary

For the browser application:

- use an opaque, securely generated session identifier;
- prefer an HttpOnly cookie so application JavaScript cannot directly read the session secret;
- use Secure cookies in environments using HTTPS;
- use an appropriate SameSite policy;
- rotate or renew session state at authentication boundaries;
- support server-side revocation;
- enforce authorization on every protected server action/request.

Cookie/session settings must be environment-aware and must never rely on development defaults in production.

Any state-changing authenticated endpoint must include appropriate CSRF/origin protection consistent with the selected framework/session design.

## 4. Organization creation boundary

After successful email verification:

1. Create or load the authenticated Person record.
2. If the person is starting a new organization, create the Organization.
3. Create the Organization Membership with role owner.
4. Create an auditable organization-creation event.
5. Redirect to the authenticated customer dashboard.

The initial implementation should not silently create unrelated organizations or duplicate an existing organization solely because a sign-in link was requested again.

Organization naming can be completed as part of signup, subject to the approved customer UX.

## 5. Project creation and Project Intake boundary

When the authenticated customer selects Start Your Project:

1. Authorize the person against the organization context.
2. Create the Project immediately.
3. Because ordinary members cannot create projects in the initial slice, the creator is an organization owner/admin. Ordinary members may receive explicit project access later, but they do not create projects in this slice.
4. Create the initial Project Intake draft state.
5. Record a project-creation audit event.
6. Redirect into the Project Intake flow.

Saving a draft must:

- require project access;
- update only the caller's accessible project;
- preserve previously saved fields not included in the current partial update;
- record the latest save time;
- avoid changing internal qualification state.

The customer must be able to leave and later resume the same Project Intake.

## 6. Server-authoritative authorization

Authorization must be evaluated on the server for every protected operation.

Minimum policy matrix:

| Action | Owner/Admin | Ordinary Member |
|---|---|---|
| View organization | Yes | Yes, for their organization membership |
| Administer organization | Yes | No |
| View all organization projects | Yes | No |
| View assigned project | Yes | Yes |
| View unassigned project | Yes | No |
| Create project for organization | Yes | No (initial slice) |
| Save assigned Project Intake | Yes | Yes |
| Save unassigned Project Intake | Yes (organization-wide access) | No |
| View internal qualification state | Internal workspace only | No |

The initial slice should keep internal Founder access separate from customer access. Founder-only workspace implementation can come later.

## 7. Customer-facing state boundary

Customer responses must be deliberately shaped.

Never serialize internal-only fields simply because they exist on the Project record.

Internal fields such as:

- qualification state;
- internal notes;
- Founder-only decisions;
- internal next actions;
- private audit metadata;

must not appear in customer API responses or customer UI components unless a later Founder-approved decision explicitly exposes a safe projection.

Customer UI should use the approved customer-facing timeline and labels from the requirements document.

## 8. Provider abstraction

The implementation should use interfaces/adapters around external capabilities.

### Email delivery

Define a replaceable application boundary for:
- sending a sign-in link;
- sending future customer notifications.

Development/test environments may use a local/test sink. A production email provider is a separate decision and activation.

### Data store

Application repositories/services should isolate data-access logic from UI components.

The logical model in this ADR is provider-neutral. Selection of a specific managed database/provider is a separate implementation decision.

### Authentication implementation

The application may use an established authentication library/framework component where it preserves the requirements in this ADR. Do not create a custom cryptographic protocol when a maintained framework primitive can safely provide the same behavior.

## 9. Privacy and secret-handling boundary

Never commit or expose:

- passwordless link secrets;
- session secrets;
- customer email addresses as public source data;
- customer documents;
- private project records;
- provider credentials;
- database credentials;
- signing/encryption keys.

Do not put authentication tokens in query-string analytics, client logs, GitHub issues, screenshots, or test fixtures.

Test fixtures must use synthetic identities and synthetic project information.

## 10. Verification contract

Before the first implementation slice can be considered complete, tests must cover at least:

### Authentication
- passwordless link is issued;
- link expires;
- link is single-use;
- consumed link cannot be reused;
- repeated sign-in requests are rate-limited;
- verification attempts are rate-limited;
- sign-in responses do not reveal whether an email is registered;
- authenticated session is established only after successful verification.

### Organization
- verified first user can create an organization;
- first user receives owner;
- organization is not duplicated by refresh/retry;
- organization access is denied without membership.

### Projects
- Start Your Project creates exactly one project for the action;
- project belongs to the correct organization;
- Owner/Admin can see all organization projects;
- ordinary member cannot access an unrelated project;
- ordinary member can access an explicitly assigned project;
- removing an ordinary member's project assignment revokes access to that project.

### Project Intake
- intake draft saves successfully;
- draft can be resumed;
- partial saves preserve prior values;
- project access is checked for every read/write;
- intake progress remains attached to the same project.

### Customer/internal boundary
- customer responses do not expose qualification state;
- customer responses do not expose internal notes or Founder-only fields;
- customer timeline uses customer-facing states only.

### Security
- raw authentication secrets are not persisted;
- secrets are not logged;
- protected operations fail without a valid session;
- unauthorized project access is rejected server-side.

## 11. First-slice non-goals

Do not include in this slice:

- payment processing;
- e-signature;
- live customer email provider activation;
- analytics;
- public deployment;
- domain/DNS;
- AI/LLM;
- full Founder/internal workspace;
- proposal workflow;
- delivery milestones;
- file storage;
- customer chat;
- production data migration.

These remain later stages under the existing product direction.

## 12. Acceptance gate

The first implementation slice may proceed only when:

1. this design is Founder-approved;
2. the selected authentication/session approach is documented;
3. the selected application data-store approach is documented;
4. server-side authorization tests exist for organization and project boundaries;
5. no production or external provider activation is performed without separate authorization.

A merged implementation PR does not authorize production deployment or live customer-data operation.

## Consequences

This design creates a clear separation between:

- public marketing content;
- authenticated customer identity;
- organization/project access control;
- saved customer Project Intake;
- internal business state.

It also allows the business to choose concrete providers later without changing the customer-domain model or permission rules.

The main implementation cost is intentional: authorization and data boundaries must be established before feature breadth. That reduces the risk of building customer workflows on top of an unsafe or provider-locked foundation.

## Alternatives considered

### Build the customer flow as client-only state first
Rejected. Customer/project data needs server-authoritative persistence and authorization from the first slice.

### Use browser localStorage as the onboarding store
Rejected. It does not provide durable server-side records, multi-device resume, auditability, or secure organization/project access.

### Expose internal project fields and hide them in the UI
Rejected. Authorization boundaries must be enforced in server-side data shaping, not only by hiding UI elements.

### Commit to a specific email/database provider now
Rejected. The current requirements do not require that provider decision, and production activation is separately governed.

### Add AI to the first customer flow
Rejected. AI/LLM is explicitly deferred by the approved product direction.