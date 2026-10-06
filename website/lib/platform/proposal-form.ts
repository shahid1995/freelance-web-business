/**
 * Proposal form parsing.
 *
 * The boundary between a Founder's HTML form and the proposal domain. It lives
 * beside the domain rather than inside the route module for one concrete reason:
 * these rules must be testable without a running Next.js request, and a route
 * module imports through the `@/` alias and `server.ts`, which a Node test build
 * cannot resolve.
 *
 * It is a conversion, not the authority. The service re-reads everything it is
 * given and rejects anything invalid, so a mistake here cannot produce an
 * invalid stored version; it can only refuse or mis-shape input the service
 * would otherwise have accepted.
 */

import { ValidationError } from "./errors";

const MAX_CONTENT_LENGTH = 20000;

/**
 * The free-text fields every version form carries.
 *
 * Declared here as the single list the parser walks, so a field cannot be added
 * to the form without being parsed, or parsed without being expected.
 */
export const PROPOSAL_CONTENT_FIELDS = [
  "summary",
  "scopeIncluded",
  "scopeExcluded",
  "deliverables",
  "timeline",
  "assumptions",
  "commercialTerms",
] as const;

export type ProposalContentField = (typeof PROPOSAL_CONTENT_FIELDS)[number];

/**
 * The part of `FormData` these parsers use.
 *
 * Structural rather than the DOM type so the rules do not depend on a DOM lib,
 * and so a test can supply a two-line stand-in when a real `FormData` is not the
 * point of the test.
 */
export interface ProposalForm {
  get(name: string): unknown;
}

/** Reads a form value as trimmed text, treating a missing field as empty. */
function readTrimmed(form: ProposalForm, field: string): string {
  const raw = form.get(field);
  if (raw === null || raw === undefined) {
    return "";
  }
  return String(raw).trim();
}

/**
 * Reads one required free-text field.
 *
 * The length bound is enforced here so an oversized field is refused before it
 * reaches a database write. The service enforces the same bound and stays the
 * authority.
 */
export function readRequiredText(form: ProposalForm, field: string): string {
  const value = readTrimmed(form, field);
  if (value.length === 0) {
    throw new ValidationError(`${field} is required for a proposal version.`);
  }
  if (value.length > MAX_CONTENT_LENGTH) {
    throw new ValidationError(`Keep ${field} under ${MAX_CONTENT_LENGTH} characters.`);
  }
  return value;
}

/**
 * Reads the optional validity date.
 *
 * The form field is an HTML `datetime-local` input, so the browser submits a
 * local date-time string such as `2026-10-06T14:30` — not a number. Parsing it
 * as a number yields `NaN` and would reject every value the UI can produce, so it
 * is parsed as a date instead. A string without a timezone is read as local time,
 * which is what the input means.
 *
 * Empty and missing both mean "no expiry". An unparseable value is rejected;
 * the service validates the resulting timestamp, so this is a conversion.
 */
export function readOptionalValidUntil(form: ProposalForm): number | null {
  const value = readTrimmed(form, "validUntil");
  if (value === "") {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError("Validity must be a date the Founder has chosen.");
  }
  return parsed;
}

/**
 * Reads the content block every version form carries.
 *
 * One helper for both the create and create-version intents: the two forms are
 * the same shape, and duplicating the field list would let one drift from the
 * other.
 */
export function readProposalContent(form: ProposalForm): Record<string, unknown> {
  const content: Record<string, unknown> = {};
  for (const field of PROPOSAL_CONTENT_FIELDS) {
    content[field] = readRequiredText(form, field);
  }
  content.validUntil = readOptionalValidUntil(form);
  return content;
}

/**
 * Reads the version number a publish action targets.
 *
 * A version number is a positive integer written in decimal, so `"1"` is valid.
 * Anything else is refused here rather than handed to the service. The service
 * re-validates the number and rejects anything below 1, so this only has to
 * refuse what the service would refuse anyway.
 */
export function readVersionNumber(form: ProposalForm): number {
  const value = readTrimmed(form, "versionNumber");
  if (!/^\d+$/.test(value)) {
    throw new ValidationError("That proposal version is not recognised.");
  }
  return Number(value);
}
