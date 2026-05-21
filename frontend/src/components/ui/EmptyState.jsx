/**
 * EmptyState — a consistent, friendly placeholder for empty list views.
 *
 * Usage:
 *   <EmptyState
 *     icon="🎫"
 *     title="No tickets yet"
 *     description="Open your first support ticket to get started."
 *     action={<Link to="/tickets/new">Create ticket</Link>}
 *   />
 */
export default function EmptyState({ icon = "📭", title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <span className="text-5xl mb-4 select-none" role="img" aria-hidden="true">
        {icon}
      </span>
      <p className="text-gray-800 font-medium text-base mb-1">{title}</p>
      {description && (
        <p className="text-gray-400 text-sm max-w-xs mb-5">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
