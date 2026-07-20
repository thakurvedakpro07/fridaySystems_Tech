import { useCallback, useState } from "react";

const STORAGE_KEY = "resolvehq_saved_ticket_filters";

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStored(views) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    // localStorage unavailable (private browsing, quota) — saved filters
    // just won't persist; not worth surfacing an error for this.
  }
}

// Customer-side "saved filters" — persisted per-browser via localStorage,
// since no backend endpoint exists for per-user saved views and adding one
// is out of scope. `components/filters/QuickViews.jsx` already renders a
// generic { key, label, filters } list — this hook is what makes that list
// user-defined instead of a hardcoded static array.
export function useSavedFilters() {
  const [views, setViews] = useState(readStored);

  const saveView = useCallback((label, filters) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setViews((prev) => {
      const next = [...prev, { key: `saved-${Date.now()}`, label: trimmed, filters }];
      writeStored(next);
      return next;
    });
  }, []);

  const removeView = useCallback((key) => {
    setViews((prev) => {
      const next = prev.filter((v) => v.key !== key);
      writeStored(next);
      return next;
    });
  }, []);

  return { views, saveView, removeView };
}
