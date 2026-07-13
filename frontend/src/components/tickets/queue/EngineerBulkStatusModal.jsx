import { useState } from "react";
import BulkActionModal from "./BulkActionModal";
import Alert from "../../ui/Alert";
import { freelancerUpdateStatus } from "../../../api/tickets";

// Options mirror the backend's allowed freelancer transitions exactly
// (_FREELANCER_STATUSES in serializers.py) — no new transitions invented.
const STATUS_OPTIONS = [
  { value: "in_progress", label: "Mark In Progress" },
  { value: "resolved", label: "Mark Resolved" },
];

// Same pattern as OpsTicketQueue's BulkStatusModal: no bulk endpoint exists,
// so this loops the existing single-ticket status endpoint sequentially —
// a failed ticket doesn't stop the rest from being tried.
export default function EngineerBulkStatusModal({ ticketIds, onClose, onDone }) {
  const [step, setStep] = useState("select"); // "select" | "confirm"
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const selectedLabel = STATUS_OPTIONS.find((o) => o.value === selected)?.label ?? selected;

  async function submit() {
    if (!selected) return;
    setLoading(true);
    setProgress(0);
    let succeeded = 0;
    let failed = 0;
    for (const ticketId of ticketIds) {
      try {
        await freelancerUpdateStatus(ticketId, selected);
        succeeded++;
      } catch {
        failed++;
      }
      setProgress((p) => p + 1);
    }
    setLoading(false);
    onDone({ succeeded, failed });
  }

  return (
    <BulkActionModal
      title="Update Status"
      subtitle={`${ticketIds.length} ticket${ticketIds.length !== 1 ? "s" : ""} selected`}
      onClose={onClose}
      loading={loading}
      primaryButtonText={loading ? "Updating…" : step === "confirm" ? "Update Tickets" : "Confirm"}
      onCancel={() => (step === "confirm" ? setStep("select") : onClose())}
      onConfirm={() => (step === "confirm" ? submit() : setStep("confirm"))}
      confirmDisabled={loading || !selected}
    >
      {step === "select" && (
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Status</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800
                       focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition"
          >
            <option value="">Select a status</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {step === "confirm" && !loading && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Update status of <span className="font-semibold">{ticketIds.length}</span> selected ticket{ticketIds.length !== 1 ? "s" : ""} to{" "}
            <span className="font-semibold">&ldquo;{selectedLabel}&rdquo;</span>?
          </p>
          {selected === "resolved" && (
            <Alert severity="warning" className="text-xs">
              &ldquo;Mark Resolved&rdquo; ends active work on these tickets. Double-check the selection before continuing.
            </Alert>
          )}
        </div>
      )}

      {loading && (
        <p className="text-xs text-slate-500">Updating {progress} of {ticketIds.length}…</p>
      )}
    </BulkActionModal>
  );
}
