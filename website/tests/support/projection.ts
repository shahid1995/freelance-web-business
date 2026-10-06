/**
 * Projection-boundary helper.
 *
 * Recursively collects every key present in a value, so a boundary test can
 * assert that internal fields are absent from a customer-facing projection at
 * any depth. Shared between the boundary suites so the traversal is written
 * once rather than copied into each one.
 */
export function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}
