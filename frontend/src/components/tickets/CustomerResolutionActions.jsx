/**
 * CustomerResolutionActions — shown to the ticket owner when status is "resolved".
 *
 * Flow:
 *   resolved → [Accept Solution] → star rating form → submit → ticket becomes closed
 *   resolved → [Issue Still Exists] → optional note → submit → ticket returns to in_progress
 *
 * The rating (CSAT) is collected inline during acceptance so the close and rate
 * happen in a single API call.  The CSATWidget handles the separate "already closed"
 * display case (e.g. admin-closed tickets).
 */
import { useEffect, useRef, useState } from "react";
import { acceptResolution, rejectResolution } from "../../api/tickets";
import { useToast } from "../../context/ToastContext";
import Button from "../ui/Button";

const SCORES = [
  { value: 5, label: "Excellent", emoji: "😄" },
  { value: 4, label: "Good",      emoji: "🙂" },
  { value: 3, label: "Neutral",   emoji: "😐" },
  { value: 2, label: "Poor",      emoji: "😕" },
  { value: 1, label: "Terrible",  emoji: "😞" },
];

export default function CustomerResolutionActions({ ticket, onUpdate }) {
  const toast = useToast();
  const [view, setView]       = useState("decision"); // "decision" | "accepting" | "rejecting"
  const [score, setScore]     = useState(null);
  const [comment, setComment] = useState("");
  const [note, setNote]       = useState("");
  const [saving, setSaving]   = useState(false);
  // useRef provides a synchronous in-flight guard. setSaving(true) only queues
  // a state update and re-render — the button stays enabled in the DOM until
  // React processes that update. A fast double-click can therefore fire
  // handleAccept twice before the re-render with disabled=true lands.
  // submittingRef.current flips synchronously in the same JS task, so the
  // second call sees it immediately and exits before touching the API.
  const submittingRef = useRef(false);

  // Orphaned-state detection: ticket.csat_score is set but status is still
  // "resolved".  This means the UI has stale data (e.g. the old submit_csat
  // endpoint was called before it was restricted to closed-only tickets).
  // Trigger a re-fetch so the parent receives the actual closed state and
  // CSATWidget can render the existing rating.  useEffect runs after render
  // so it avoids the React "side-effect during render" rule.
  const isOrphaned = ticket.status === "resolved" && ticket.csat_score != null;
  useEffect(() => {
    if (isOrphaned) onUpdate();
  // onUpdate identity is stable (useCallback in TicketDetailPage); isOrphaned
  // changes only when ticket data changes, so this fires at most once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOrphaned]);

  if (ticket.status !== "resolved") return null;
  if (isOrphaned) return null; // hide form while parent re-fetches

  // ── Accept flow ────────────────────────────────────────────────
  const handleAccept = async () => {
    if (!score || submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const { data: updatedTicket } = await acceptResolution(ticket.id, score, comment);
      toast("Solution accepted — ticket is now closed. Thank you!", "success");
      onUpdate(updatedTicket);
    } catch (err) {
      if (err.response?.status === 409) {
        // Backend says already accepted — our data is stale.  Re-fetch so the
        // UI transitions to the correct closed state without a manual refresh.
        onUpdate();
      } else {
        toast(err.response?.data?.detail ?? "Could not accept resolution.", "error");
      }
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  // ── Reject flow ────────────────────────────────────────────────
  const handleReject = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const { data: updatedTicket } = await rejectResolution(ticket.id, note);
      toast("Ticket reopened — your engineer has been notified.", "info");
      onUpdate(updatedTicket);
    } catch (err) {
      toast(err.response?.data?.detail ?? "Could not reopen ticket.", "error");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  // ── Rating form (after "Accept Solution" is clicked) ──────────
  if (view === "accepting") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-semibold text-emerald-800">Rate your experience to confirm</p>
        </div>
        <p className="text-xs text-emerald-700 mb-4 ml-6">Your rating closes the ticket and helps us improve.</p>

        <div className="flex gap-3 mb-4">
          {SCORES.map(({ value, label, emoji }) => (
            <button
              key={value}
              onClick={() => setScore(value)}
              title={label}
              className={`flex flex-col items-center text-2xl transition-transform hover:scale-110 ${
                score === value ? "scale-110 opacity-100" : "opacity-50"
              }`}
            >
              {emoji}
              <span className="text-xs text-slate-500 mt-1">{label}</span>
            </button>
          ))}
        </div>

        <label htmlFor="accept-comment" className="sr-only">Additional feedback (optional)</label>
        <textarea
          id="accept-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Optional: share any additional feedback…"
          className="input-base resize-none mb-3"
        />

        <div className="flex items-center gap-2">
          <Button
            disabled={!score || saving}
            loading={saving}
            onClick={handleAccept}
          >
            {saving ? "Closing ticket…" : "Confirm & Close Ticket"}
          </Button>
          <Button variant="ghost" disabled={saving} onClick={() => setView("decision")}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  // ── Rejection note form (after "Issue Still Exists" is clicked) ─
  if (view === "rejecting") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-semibold text-amber-800">Describe what's still not working</p>
        </div>
        <p className="text-xs text-amber-700 mb-4 ml-6">This is optional but helps your engineer fix the right thing.</p>

        <label htmlFor="reject-note" className="sr-only">What's still not working (optional)</label>
        <textarea
          id="reject-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. The login page still shows error 403 after logging in…"
          className="input-base resize-none mb-3"
        />

        <div className="flex items-center gap-2">
          <Button
            variant="warning"
            loading={saving}
            disabled={saving}
            onClick={handleReject}
          >
            {saving ? "Reopening…" : "Reopen Ticket"}
          </Button>
          <Button variant="ghost" disabled={saving} onClick={() => setView("decision")}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  // ── Default: decision panel ────────────────────────────────────
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5"
         style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm font-semibold text-slate-800">Has your issue been resolved?</p>
      </div>
      <p className="text-xs text-slate-500 mb-4 ml-6">
        Your engineer has marked this ticket as resolved. Please confirm or let us know if you need more help.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={() => setView("accepting")} className="flex-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Accept Solution
        </Button>
        <Button variant="secondary" onClick={() => setView("rejecting")} className="flex-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          Issue Still Exists
        </Button>
      </div>
    </div>
  );
}
