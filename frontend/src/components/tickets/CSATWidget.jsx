/**
 * CSATWidget — lets customers rate their experience on resolved/closed tickets.
 * Only shown when: ticket.status is "resolved" or "closed" AND no rating exists yet.
 *
 * Props:
 *   ticket   — the full ticket object (needs ticket.id, ticket.csat_score)
 *   onUpdate — callback fired after a successful submission
 */
import { useState } from "react";
import { submitCSAT } from "../../api/tickets";
import { useToast } from "../../context/ToastContext";
import Button from "../ui/Button";

const SCORES = [
  { value: 5, label: "Excellent", emoji: "😄" },
  { value: 4, label: "Good",      emoji: "🙂" },
  { value: 3, label: "Neutral",   emoji: "😐" },
  { value: 2, label: "Poor",      emoji: "😕" },
  { value: 1, label: "Terrible",  emoji: "😞" },
];

export default function CSATWidget({ ticket, onUpdate }) {
  const toast = useToast();
  const [score, setScore]       = useState(null);
  const [comment, setComment]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!["resolved", "closed"].includes(ticket.status)) return null;
  if (ticket.csat_score != null) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-500">
        You rated this ticket <strong>{ticket.csat_score}/5</strong>. Thank you for your feedback!
      </div>
    );
  }
  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-sm text-green-700">
        Thank you for your feedback!
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!score) return;
    setSaving(true);
    try {
      await submitCSAT(ticket.id, score, comment);
      toast("Thank you for your feedback!", "success");
      setSubmitted(true);
      onUpdate();
    } catch (err) {
      toast(err.response?.data?.detail ?? "Could not submit rating.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <p className="text-sm font-medium text-blue-800 mb-3">How was your experience?</p>

      {/* Star-style score selector */}
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
            <span className="text-xs text-gray-500 mt-1">{label}</span>
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Optional: tell us more…"
        className="w-full border border-blue-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3"
      />

      <Button disabled={!score || saving} onClick={handleSubmit}>
        {saving ? "Submitting…" : "Submit Rating"}
      </Button>
    </div>
  );
}
