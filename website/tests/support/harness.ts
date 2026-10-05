/**
 * Test harness.
 *
 * Builds a real platform instance — real services, real SQL, real hashing —
 * against an in-memory database and a controllable clock. Nothing is mocked
 * except the passage of time and the email transport, and the email transport is
 * the local sink the ADR permits for development and test.
 *
 * All identities and project content here are synthetic.
 */

import { DEFAULT_CONFIG, type PlatformConfig } from "../../lib/platform/config";
import { fixedClock } from "../../lib/platform/clock";
import { LocalEmailSink } from "../../lib/platform/local-email";
import { createPlatform, type CreatePlatformOptions, type Platform } from "../../lib/platform/container";
import { normalizeEmail } from "../../lib/platform/secrets";
import type { VerifiedSession } from "../../lib/platform/auth";

/** Fixed instant so nothing in the suite depends on the wall clock. */
export const START_TIME = Date.UTC(2026, 9, 1, 9, 0, 0);

export const OWNER_EMAIL = "owner@synthetic.example";
export const MEMBER_EMAIL = "member@synthetic.example";
export const OTHER_EMAIL = "other@synthetic.example";
export const CLIENT_KEY = "203.0.113.10";

export interface TestPlatform {
  platform: Platform;
  clock: ReturnType<typeof fixedClock>;
  email: LocalEmailSink;
}

export interface HarnessOptions {
  config?: Partial<PlatformConfig>;
  createOptions?: Partial<CreatePlatformOptions>;
}

export async function createTestPlatform(
  options: HarnessOptions = {},
): Promise<TestPlatform> {
  const clock = fixedClock(START_TIME);
  const email = new LocalEmailSink();
  const config: PlatformConfig = {
    ...DEFAULT_CONFIG,
    databasePath: ":memory:",
    // Fixed allow-list so origin checks are exercised explicitly rather than
    // relying on a derived host.
    allowedOrigins: ["https://portal.synthetic.example"],
    ...options.config,
  };
  const platform = await createPlatform({
    config,
    clock,
    email,
    signInPath: "/api/auth/verify",
    ...options.createOptions,
  });
  return { platform, clock, email };
}

/** Requests a link and returns the raw token from the captured message. */
export async function requestToken(
  harness: TestPlatform,
  emailAddress: string,
  clientKey = CLIENT_KEY,
): Promise<string> {
  await harness.platform.auth.requestSignInLink({
    email: emailAddress,
    clientKey,
  });
  const message = harness.email.lastMessageTo(normalizeEmail(emailAddress));
  if (!message) {
    throw new Error("No sign-in message was captured.");
  }
  const url = new URL(message.signInUrl, "https://portal.synthetic.example");
  const token = url.searchParams.get("token");
  if (!token) {
    throw new Error("The captured sign-in link carried no token.");
  }
  return token;
}

/** Runs the full passwordless sign-in and returns the established session. */
export async function signIn(
  harness: TestPlatform,
  emailAddress: string,
  clientKey = CLIENT_KEY,
): Promise<VerifiedSession> {
  const token = await requestToken(harness, emailAddress, clientKey);
  return harness.platform.auth.verifySignInLink({ token, clientKey });
}

/**
 * Signs a person in and creates their organization, returning the person id.
 * This is the signup path: email authentication, then organization creation with
 * the first user as owner.
 */
export async function signUpAsOwner(
  harness: TestPlatform,
  emailAddress: string,
  organizationName = "Synthetic Holdings Ltd",
): Promise<{ personId: string; organizationId: string; sessionId: string }> {
  const verified = await signIn(harness, emailAddress);
  const result = harness.platform.organizations.createForPerson(
    verified.person.id,
    organizationName,
  );
  return {
    personId: verified.person.id,
    organizationId: result.organization.id,
    sessionId: verified.sessionId,
  };
}

/**
 * Signs up an owner and starts one project, returning everything the project
 * suites need. Shared so the setup for a plain owner-with-project scenario is
 * written once rather than repeated in every suite.
 */
export async function signUpAsOwnerWithProject(
  harness: TestPlatform,
  emailAddress: string,
  organizationName = "Synthetic Holdings Ltd",
): Promise<{
  harness: TestPlatform;
  personId: string;
  organizationId: string;
  projectId: string;
  sessionId: string;
}> {
  const owner = await signUpAsOwner(harness, emailAddress, organizationName);
  const project = harness.platform.projects.createProject({
    personId: owner.personId,
    organizationId: owner.organizationId,
  });
  return { harness, projectId: project.project.id, ...owner };
}

/**
 * Adds a second person to an existing organization as an ordinary member.
 *
 * Member management UI is outside this slice, so the membership row is written
 * through the store port — the same seam a future member-management service will
 * use.
 */
export async function addOrdinaryMember(
  harness: TestPlatform,
  organizationId: string,
  emailAddress: string,
): Promise<{ personId: string; sessionId: string }> {
  const verified = await signIn(harness, emailAddress);
  harness.platform.store.createMembership({
    id: `membership-${verified.person.id}`,
    personId: verified.person.id,
    organizationId,
    role: "member",
    now: harness.clock.now(),
  });
  return { personId: verified.person.id, sessionId: verified.sessionId };
}