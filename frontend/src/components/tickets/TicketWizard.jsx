/**
 * TicketWizard — multi-step Create Ticket flow (Service → Priority →
 * Description → Attachments → Review), replacing the old single-page
 * TicketForm. Reuses TicketForm.jsx's pricing logic/severity catalog
 * (still the single source of truth for those), the shared StepIndicator,
 * and ConversationFeed's attachment validation constants — no new pricing
 * or validation rules invented here.
 *
 * Attachments: the backend only accepts file uploads against an existing
 * ticket (no multipart support on ticket-create), so files are staged
 * client-side through the wizard and uploaded one by one via the existing
 * per-attachment endpoint immediately after ticket creation succeeds.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTicket, listServices } from "../../api/tickets";
import { uploadAttachment } from "../../api/attachments";
import { useToast } from "../../context/ToastContext";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import StepIndicator from "../ui/StepIndicator";
import FileTypeBadge from "../ui/FileTypeBadge";
import Badge from "../ui/Badge";
import OnboardingStepHeader from "../onboarding/OnboardingStepHeader";
import { UploadIcon } from "./ActionIcons";
import { MAX_SIZE_MB, ALLOWED_EXT } from "./ConversationFeed";
import { PricingPreview, SEVERITY_OPTIONS, SEVERITY_LABELS } from "./TicketForm";

const STEPS = ["Service", "Priority", "Description", "Attachments", "Review"];

const FIELD_LABELS = {
  title:        "Issue title",
  description:  "Problem description",
  service_type: "Service",
  severity:     "Urgency",
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function humanize(str) {
  if (!str) return "";
  return str.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Step 1: Service ──────────────────────────────────────────────
// Availability is entirely data-driven: GET /api/services/ includes
// is_available for every listed service (Operations → Services can mark
// any service temporarily unavailable, or archive it out of this list
// entirely — see Service.is_active/is_available in models.py). No code
// change is needed here when an admin changes a service's availability;
// this component just renders whatever the API currently says.
function estimatedTimeHint(s) {
  const fmtH = (min) => (min % 60 === 0 ? `${min / 60}h` : `${min}m`);
  if (s.estimated_response_minutes == null && s.estimated_resolution_minutes == null) return null;
  const parts = [];
  if (s.estimated_response_minutes != null) parts.push(`~${fmtH(s.estimated_response_minutes)} response`);
  if (s.estimated_resolution_minutes != null) parts.push(`~${fmtH(s.estimated_resolution_minutes)} resolution`);
  return parts.join(" · ");
}

function ServiceStep({ services, serviceError, catalog, value, onChange }) {
  const selected = services.find((s) => s.key === value) ?? null;
  return (
    <div>
      <OnboardingStepHeader
        eyebrow="Step 1"
        title="What do you need help with?"
        description="Pick the service category closest to your issue — this routes your ticket to the right engineer."
        accentClassName="text-indigo-600"
      />
      {serviceError ? (
        <Alert severity="error">Could not load services. Please refresh the page.</Alert>
      ) : !catalog ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <div key={n} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {services.map((s) => {
            const isSelected = value === s.key;
            const unavailable = s.is_available === false;
            const hint = estimatedTimeHint(s);
            return (
              <button
                key={s.key}
                type="button"
                disabled={unavailable}
                aria-disabled={unavailable}
                onClick={() => { if (!unavailable) onChange(s.key); }}
                className={`text-left p-3.5 rounded-xl border transition-all duration-150 ${
                  unavailable
                    ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                    : isSelected
                    ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-semibold flex items-center gap-1.5 ${
                    unavailable ? "text-slate-500" : isSelected ? "text-indigo-900" : "text-slate-800"
                  }`}>
                    {s.icon && <span aria-hidden="true">{s.icon}</span>}
                    {s.name}
                  </p>
                  {unavailable ? (
                    <Badge tone="amber" shape="soft" label="Temporarily unavailable" />
                  ) : s.featured ? (
                    <Badge tone="violet" shape="soft" label="Popular" />
                  ) : null}
                </div>
                {s.scope && (
                  <p className={`text-xs leading-snug mt-1 ${unavailable ? "text-slate-400" : "text-slate-500"}`}>
                    {s.scope}
                  </p>
                )}
                {hint && !unavailable && (
                  <p className="text-[10px] font-semibold text-slate-500 mt-1.5">{hint}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
      {selected?.scope && (
        <p className="text-xs text-indigo-600 font-medium mt-3">Selected: {selected.name}</p>
      )}
    </div>
  );
}

// ── Step 2: Priority ─────────────────────────────────────────────
function PriorityStep({ value, onChange }) {
  return (
    <div>
      <OnboardingStepHeader
        eyebrow="Step 2"
        title="How urgent is this?"
        description="Priority determines how quickly a Support Agent contacts you — it does not affect resolution speed."
        accentClassName="text-indigo-600"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {SEVERITY_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-150 ${
                selected
                  ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  selected ? "border-indigo-600" : "border-slate-300"
                }`}
              >
                {selected && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${selected ? "text-indigo-900" : "text-slate-800"}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-slate-500 leading-snug mt-0.5">{opt.hint}</p>
                <p className={`text-[10px] font-semibold mt-1 ${selected ? "text-indigo-600" : "text-slate-500"}`}>
                  {opt.sla}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 3: Description ──────────────────────────────────────────
function DescriptionStep({ title, description, onTitleChange, onDescriptionChange }) {
  return (
    <div>
      <OnboardingStepHeader
        eyebrow="Step 3"
        title="Describe the problem"
        description="The more detail you provide, the faster your engineer can help."
        accentClassName="text-indigo-600"
      />
      <div className="space-y-4">
        <div>
          <label htmlFor="wizard-title" className="block text-sm font-semibold text-slate-700 mb-1.5">
            What's the issue? <span className="text-rose-500">*</span>
          </label>
          <Input
            id="wizard-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g. Cannot SSH into production server after reboot"
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor="wizard-description" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Problem description <span className="text-rose-500">*</span>
          </label>
          <Textarea
            id="wizard-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={5}
            placeholder="What happened? When did it start? What have you already tried?"
            className="w-full resize-none"
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Attachments (frontend-only staging — see file header) ──
function AttachmentsStep({ files, onAdd, onRemove }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const validateAndAdd = (fileList) => {
    setError("");
    const accepted = [];
    for (const file of fileList) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`${file.name} is larger than ${MAX_SIZE_MB}MB and was skipped.`);
        continue;
      }
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        setError(`${file.name} has an unsupported file type and was skipped.`);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) onAdd(accepted);
  };

  return (
    <div>
      <OnboardingStepHeader
        eyebrow="Step 4"
        title="Add supporting files"
        description="Screenshots, logs, or config files help your engineer diagnose faster. Optional — you can also add these later from the ticket page."
        accentClassName="text-indigo-600"
      />

      <div
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); validateAndAdd(Array.from(e.dataTransfer.files)); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <UploadIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-700">Drag files here or click to browse</p>
        <p className="text-xs text-slate-500 mt-1">Max {MAX_SIZE_MB}MB per file · {ALLOWED_EXT.join(", ")}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { validateAndAdd(Array.from(e.target.files)); e.target.value = ""; }}
        />
      </div>

      {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200">
              <FileTypeBadge mimeType={f.type} fileName={f.name} />
              <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 truncate">{f.name}</span>
              <span className="text-xs text-slate-400 shrink-0">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${f.name}`}
                className="text-slate-400 hover:text-rose-600 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step 5: Review ───────────────────────────────────────────────
function ReviewStep({ form, selectedService, severitySurcharges, consultingFee, files }) {
  return (
    <div>
      <OnboardingStepHeader
        eyebrow="Step 5"
        title="Review your ticket"
        description="Confirm the details below before submitting."
        accentClassName="text-indigo-600"
      />

      <dl className="space-y-3 mb-5">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-xs font-medium text-slate-500 shrink-0 pt-0.5">Service</dt>
          <dd className="text-sm font-semibold text-slate-800 text-right">{selectedService?.name ?? "—"}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-xs font-medium text-slate-500 shrink-0 pt-0.5">Priority</dt>
          <dd className="text-right"><Badge label={form.severity} domain="severity" /></dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-xs font-medium text-slate-500 shrink-0 pt-0.5">Issue</dt>
          <dd className="text-sm font-semibold text-slate-800 text-right max-w-[70%]">{form.title}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 mb-1">Description</dt>
          <dd className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 whitespace-pre-wrap">
            {form.description}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-xs font-medium text-slate-500 shrink-0 pt-0.5">Attachments</dt>
          <dd className="text-sm font-semibold text-slate-800 text-right">
            {files.length === 0 ? "None" : `${files.length} file${files.length !== 1 ? "s" : ""}`}
          </dd>
        </div>
      </dl>

      {selectedService && severitySurcharges ? (
        <PricingPreview
          service={selectedService}
          severity={form.severity}
          severitySurcharges={severitySurcharges}
          consultingFee={consultingFee}
        />
      ) : (
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
          <span>A <strong>₹299 + GST consulting fee</strong> is charged when you open your ticket.</span>
        </div>
      )}
    </div>
  );
}

// ── Root wizard component ────────────────────────────────────────
export default function TicketWizard() {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState(null);
  const [serviceError, setServiceError] = useState(false);
  const [form, setForm] = useState({ service_type: "", severity: "medium", title: "", description: "" });
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    listServices()
      .then(({ data }) => setCatalog(data))
      .catch(() => setServiceError(true));
  }, []);

  const services = catalog?.services ?? [];
  const severitySurcharges = catalog?.severity_surcharges ?? null;
  const consultingFee = catalog?.consulting_fee ?? 299;
  const selectedService = services.find((s) => s.key === form.service_type) ?? null;

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const CAN_CONTINUE = [
    !!form.service_type,                              // step 0 — Service
    true,                                              // step 1 — Priority (default always set)
    !!(form.title.trim() && form.description.trim()),  // step 2 — Description
    true,                                               // step 3 — Attachments (optional)
  ];
  const canContinue = CAN_CONTINUE[step] ?? true;

  const back = () => setStep((s) => Math.max(s - 1, 0));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

  const addFiles = (newFiles) => setFiles((f) => [...f, ...newFiles]);
  const removeFile = (idx) => setFiles((f) => f.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrors([]);
    try {
      const { data: ticket } = await createTicket({
        title: form.title,
        description: form.description,
        service_type: form.service_type,
        severity: form.severity,
      });

      if (files.length > 0) {
        const results = await Promise.allSettled(files.map((f) => uploadAttachment(ticket.id, f)));
        const failedCount = results.filter((r) => r.status === "rejected").length;
        if (failedCount > 0) {
          toast(
            `Ticket created — ${failedCount} attachment${failedCount !== 1 ? "s" : ""} failed to upload. Add ${failedCount !== 1 ? "them" : "it"} again from the ticket page.`,
            "warning",
          );
        }
      }

      toast("Ticket created! Redirecting to your ticket…", "success");
      navigate(`/tickets/${ticket.id}`);
    } catch (err) {
      const responseData = err.response?.data || {};
      const msgs = [];
      Object.entries(responseData).forEach(([key, val]) => {
        const list = Array.isArray(val) ? val : [val];
        list.forEach((m) => {
          const label = key === "detail" || key === "non_field_errors" ? null : (FIELD_LABELS[key] ?? null);
          msgs.push(label ? `${label}: ${m}` : String(m));
        });
      });
      if (msgs.length === 0) msgs.push("Failed to create ticket. Please try again.");
      setErrors(msgs);
      toast(msgs[0], "error");
    } finally {
      setSubmitting(false);
    }
  };

  const isLastStep = step === STEPS.length - 1;

  return (
    <div>
      <StepIndicator current={step} total={STEPS.length} labels={STEPS} />

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7"
           style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}>

        {errors.length > 0 && (
          <Alert severity="error" className="mb-5">
            {errors.length === 1 ? errors[0] : (
              <ul className="list-disc list-inside space-y-0.5">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </Alert>
        )}

        {step === 0 && (
          <ServiceStep
            services={services}
            serviceError={serviceError}
            catalog={catalog}
            value={form.service_type}
            onChange={setField("service_type")}
          />
        )}
        {step === 1 && <PriorityStep value={form.severity} onChange={setField("severity")} />}
        {step === 2 && (
          <DescriptionStep
            title={form.title}
            description={form.description}
            onTitleChange={setField("title")}
            onDescriptionChange={setField("description")}
          />
        )}
        {step === 3 && <AttachmentsStep files={files} onAdd={addFiles} onRemove={removeFile} />}
        {step === 4 && (
          <ReviewStep
            form={form}
            selectedService={selectedService}
            severitySurcharges={severitySurcharges}
            consultingFee={consultingFee}
            files={files}
          />
        )}

        {/* ── Footer nav ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
          {step > 0 ? (
            <Button variant="secondary" onClick={back} disabled={submitting}>← Back</Button>
          ) : <span />}

          {isLastStep ? (
            <Button onClick={handleSubmit} loading={submitting} disabled={serviceError || !catalog}>
              {submitting ? "Creating ticket…" : "Create Ticket →"}
            </Button>
          ) : (
            <Button onClick={next} disabled={!canContinue}>Continue →</Button>
          )}
        </div>
      </div>

      {isLastStep && (
        <p className="text-xs text-slate-500 text-center mt-3">Payment is collected on the next screen.</p>
      )}
    </div>
  );
}
