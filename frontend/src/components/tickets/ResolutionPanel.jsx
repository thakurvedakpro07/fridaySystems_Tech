/**
 * ResolutionPanel — structured Resolution Summary capture/display.
 *
 * Persists the 5 structured fields through the existing internal-note
 * channel (see utils/resolution.js for why, and the required backend work
 * still outstanding to make this genuinely structured data).
 *
 * This is the non-resolving "Capture Resolution / Update" flow only — it
 * lets staff/engineers record or update a resolution summary at any point
 * without changing the ticket's status. Actually marking a ticket resolved
 * now happens on its own dedicated page (/tickets/:id/resolve, see
 * ResolveTicketPage), not here — "Mark Resolved" navigates there directly
 * instead of opening this drawer.
 */
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { addComment } from "../../api/tickets";
import { useToast } from "../../context/ToastContext";
import { useRoles } from "../../hooks/useRoles";
import { FIELDS, composeBody, findLatestResolution } from "../../utils/resolution";
import Button from "../ui/Button";
import Drawer from "../ui/Drawer";

export default function ResolutionPanel({ ticketId, feedItems, onCaptured, role }) {
  const { isTicketManagementStaff, isEngineer } = useRoles();
  const canCapture = isTicketManagementStaff || isEngineer;
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  const latest = findLatestResolution(feedItems);
  const hasAnyField = latest && FIELDS.some(({ key }) => latest[key]);

  const closeForm = () => setShowForm(false);

  const openForm = () => {
    setValues(latest ?? {});
    setShowForm(true);
  };

  const handleFieldChange = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!FIELDS.some(({ key }) => (values[key] ?? "").toString().trim())) {
      toast("Add at least one field before saving.", "error");
      return;
    }

    setSaving(true);
    try {
      await addComment(ticketId, composeBody(values), true);
      onCaptured();
      toast("Resolution summary saved.", "success");
      closeForm();
    } catch (err) {
      toast(err.response?.data?.detail ?? "Could not save resolution summary. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Internal-only by nature (posted as is_internal:true) — never rendered
  // for a customer, matching Phase 2's exact composer visibility rule.
  if (role === "customer") return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
         style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <p className="text-base font-semibold text-slate-900 tracking-tight">Resolution Summary</p>
          {hasAnyField && latest.capturedAt && (
            <p className="text-xs text-slate-400 mt-0.5">
              Last updated {new Date(latest.capturedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              {latest.capturedBy ? ` by ${latest.capturedBy}` : ""}
            </p>
          )}
        </div>
        {canCapture && (
          <Button variant="secondary" size="sm" onClick={openForm}>
            {hasAnyField ? "Update" : "Capture Resolution"}
          </Button>
        )}
      </div>

      <div className="p-5">
        {!hasAnyField ? (
          <p className="text-sm text-slate-500">
            {canCapture ? "No resolution summary captured yet." : "No resolution summary has been added yet."}
          </p>
        ) : (
          <dl className="space-y-3">
            {FIELDS.map(({ key, label }) => latest[key] && (
              <div key={key}>
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</dt>
                <dd className="text-sm text-slate-800 whitespace-pre-wrap">{latest[key]}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Right-side drawer, not a centered modal — the ticket detail page
          stays fully visible and scrollable while this is open (no body
          scroll lock, no blocking backdrop). Mounted/unmounted by `showForm`
          rather than an `isOpen` prop so AnimatePresence can play the
          slide-out exit animation; see Drawer.jsx for why this isn't built
          on Modal.jsx. */}
      <AnimatePresence>
        {showForm && (
          <Drawer
            onClose={() => !saving && closeForm()}
            title="Resolution Summary"
            footer={
              <div className="flex items-center justify-end gap-3">
                <Button variant="secondary" size="lg" onClick={closeForm} disabled={saving} className="h-11 w-24">
                  Cancel
                </Button>
                <Button size="lg" onClick={handleSubmit} loading={saving} disabled={saving} className="h-11">
                  {saving ? "Saving…" : "Save Resolution Summary"}
                </Button>
              </div>
            }
          >
            <div className="space-y-5">
              {FIELDS.map(({ key, label, type }) => (
                <div key={key}>
                  <label htmlFor={`res-${key}`} className="block text-sm font-medium text-slate-700 mb-4">
                    {label}{key === "timeSpent" ? " (minutes)" : ""}
                  </label>
                  {type === "number" ? (
                    <input
                      id={`res-${key}`}
                      type="number"
                      min="0"
                      placeholder="e.g. 45"
                      value={values[key] ?? ""}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      className="input-base"
                    />
                  ) : (
                    <textarea
                      id={`res-${key}`}
                      value={values[key] ?? ""}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      rows={key === "rootCause" || key === "prevention" ? 2 : 3}
                      className="input-base resize-none"
                    />
                  )}
                </div>
              ))}
            </div>
          </Drawer>
        )}
      </AnimatePresence>
    </div>
  );
}
