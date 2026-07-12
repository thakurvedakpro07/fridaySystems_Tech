// Unifies the two independently-drifted file-type-color mappings previously
// hand-rolled in ResolutionSummary.jsx (pdf/zip/image/other) and
// ConversationFeed.jsx (pdf/zip/sheet/text/other, no image case, used
// brand-* instead of indigo-*) — union of both case sets, one palette.
function resolve(mimeType, fileName) {
  const ext = (fileName?.split(".").pop() || "").toUpperCase();
  if (mimeType?.includes("pdf")) return { label: "PDF", classes: "bg-red-50 text-red-600 ring-red-100" };
  if (mimeType?.includes("zip")) return { label: "ZIP", classes: "bg-amber-50 text-amber-600 ring-amber-100" };
  if (mimeType?.startsWith("image/")) return { label: ext || "IMG", classes: "bg-violet-50 text-violet-600 ring-violet-100" };
  if (mimeType?.includes("sheet") || mimeType?.includes("excel")) return { label: ext || "XLS", classes: "bg-emerald-50 text-emerald-600 ring-emerald-100" };
  if (mimeType?.startsWith("text/")) return { label: ext || "TXT", classes: "bg-slate-100 text-slate-600 ring-slate-200" };
  return { label: ext || "FILE", classes: "bg-indigo-50 text-indigo-600 ring-indigo-100" };
}

export default function FileTypeBadge({ mimeType, fileName, className = "w-8 h-8 text-[9px]" }) {
  const { label, classes } = resolve(mimeType, fileName);
  return (
    <span
      data-ds="file-type-badge"
      className={`rounded-md ring-1 flex items-center justify-center font-bold shrink-0 ${classes} ${className}`}
    >
      {label}
    </span>
  );
}
