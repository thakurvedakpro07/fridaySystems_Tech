import { useEffect, useRef } from "react";

// Plain checkbox that also supports the (non-JSX-expressible) indeterminate
// state, needed for "select all visible" header controls. Promoted from
// tickets/queue/TicketQueueTable.jsx (was a local, unexported function
// there) so the Ops Ticket Queue and the Engineer Workspace's
// TicketSectionList share one implementation instead of two.
export default function RowCheckbox({ checked, indeterminate = false, onChange, ariaLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 cursor-pointer"
    />
  );
}
