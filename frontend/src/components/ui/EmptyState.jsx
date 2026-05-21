export default function EmptyState({ icon = "📭", title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <span className="text-2xl" role="img" aria-hidden="true">{icon}</span>
      </div>
      <p className="text-slate-800 font-semibold text-sm mb-1">{title}</p>
      {description && (
        <p className="text-slate-400 text-sm max-w-xs mb-5">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
