// Extracted as-is from OpsTicketQueue.jsx. Note: this currently only
// renders the ticket-count line — there is no Previous/Next/page-number
// UI or "Showing X–Y of Z" text anywhere in the source being extracted,
// since the page never reads the API's count/next/previous pagination
// fields. Real pagination controls are a separate follow-up, not part
// of this extraction.
export default function Pagination({ loading, count }) {
  if (loading || count === 0) return null;

  return (
    <p className="text-xs text-slate-500 text-center">{count} ticket{count !== 1 ? "s" : ""} shown</p>
  );
}
