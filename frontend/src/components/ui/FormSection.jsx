// Gradient-topped white card used to group a labelled block of form fields
// (title + optional description + children). Extracted from SettingsPage's
// local `SectionCard` — same markup, same visual output.
export default function FormSection({ title, description, children }) {
  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
      style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.07)" }}
    >
      <div className="h-0.5 bg-brand-gradient" />
      <div className="p-6">
        <div className="mb-5">
          <h2 className="text-section-title">{title}</h2>
          {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
