/**
 * Extracts a human-readable error message from any Axios error.
 *
 * Priority order:
 *  1. Backend "detail" key (our standardised error shape)
 *  2. Backend "errors" dict — first field-level message
 *  3. HTTP status text fallback
 *  4. Network / timeout message
 *  5. Static fallback
 */
export function extractErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;

  const data = error.response?.data;

  // 1. Standardised backend shape: { detail, errors, status }
  if (data?.detail) return String(data.detail);

  // 2. Field-level validation errors dict
  if (data && typeof data === "object") {
    const keys = Object.keys(data).filter((k) => k !== "status");
    if (keys.length > 0) {
      const first = data[keys[0]];
      const msg = Array.isArray(first) ? first[0] : first;
      return `${keys[0]}: ${msg}`;
    }
  }

  // 3. Plain string body
  if (typeof data === "string" && data.trim()) return data.trim();

  // 4. HTTP status text
  if (error.response?.status) {
    const code = error.response.status;
    if (code === 401) return "Session expired. Please sign in again.";
    if (code === 403) return "You don't have permission to do that.";
    if (code === 404) return "That resource could not be found.";
    if (code === 429) return "Too many requests. Please wait a moment and try again.";
    if (code >= 500) return "Server error. Please try again shortly.";
  }

  // 5. Network / timeout
  if (error.code === "ECONNABORTED") return "Request timed out. Check your connection and try again.";
  if (!error.response) return "Network error. Check your internet connection.";

  return fallback;
}

/**
 * Returns the errors dict from a DRF validation response (field → messages[]).
 * Returns an empty object for non-validation errors.
 */
export function extractFieldErrors(error) {
  const data = error?.response?.data;
  if (!data || typeof data !== "object") return {};
  const { detail: _d, status: _s, ...fields } = data;
  return fields;
}

/**
 * Returns true when the error is a 401 (token expired / not authenticated).
 */
export function isUnauthorized(error) {
  return error?.response?.status === 401;
}

/**
 * Returns true when the error is a 403 (authenticated but forbidden).
 */
export function isForbidden(error) {
  return error?.response?.status === 403;
}
