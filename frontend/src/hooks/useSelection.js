import { useCallback, useState } from "react";

/**
 * Generic multi-select state — a Set of selected ids plus toggle helpers.
 * Not tied to tickets specifically, so it's reusable anywhere a list needs
 * checkbox selection (bulk actions, etc).
 */
export function useSelection() {
  const [selected, setSelected] = useState(() => new Set());

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Select all of `ids` unless every one is already selected, in which case
  // deselect them — the standard "select all visible" checkbox behavior.
  const toggleAll = useCallback((ids) => {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  const isSelected = useCallback((id) => selected.has(id), [selected]);

  return { selected, toggle, toggleAll, clear, isSelected, count: selected.size };
}
