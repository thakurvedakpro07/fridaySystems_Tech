/**
 * Time formatting utilities.
 * formatRelativeTime: "just now", "5m ago", "3h ago", "2d ago", "12 May"
 * formatAbsoluteTime: "12 May, 02:30 PM"  (used in tooltips)
 */

export function formatRelativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs  = Math.floor(diff / 1_000);
  if (secs < 60)  return "just now";
  const mins  = Math.floor(secs  / 60);
  if (mins < 60)  return `${mins}m ago`;
  const hours = Math.floor(mins  / 60);
  if (hours < 24) return `${hours}h ago`;
  const days  = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatAbsoluteTime(dateStr) {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Groups a sorted (newest-first) array of items by date bucket. */
export function groupByDate(items, getDate) {
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  const buckets = { Today: [], Yesterday: [], Earlier: [] };

  for (const item of items) {
    const d = new Date(getDate(item)); d.setHours(0,0,0,0);
    if (d >= today)          buckets.Today.push(item);
    else if (d >= yesterday) buckets.Yesterday.push(item);
    else                     buckets.Earlier.push(item);
  }

  return Object.entries(buckets).filter(([, v]) => v.length > 0);
}
