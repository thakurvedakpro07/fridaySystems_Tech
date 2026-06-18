/**
 * getDisplayName — resolves the best human-readable name for a user object.
 *
 * Priority order:
 *   1. first_name                     → "Vedak"
 *   2. first_name + last_name         → "Vedak Thakur"
 *   3. full_name / display_name       → future-proof for profile enrichment
 *   4. Empty string                   → caller decides the fallback label
 *
 * Never returns an email address or email prefix.
 *
 * @param {object} user  - The Zustand auth store user object
 * @param {"first"|"full"} [mode]  - "first" returns only first name (default);
 *                                   "full" returns first + last name if available
 * @returns {string}
 */
export function getDisplayName(user, mode = "first") {
  if (!user) return "";

  const first = (user.first_name ?? "").trim();
  const last  = (user.last_name  ?? "").trim();

  if (mode === "full") {
    if (first && last) return `${first} ${last}`;
    if (first) return first;
    if (last)  return last;
    return "";
  }

  // mode === "first"
  return first;
}
