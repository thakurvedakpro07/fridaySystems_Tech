import { useEffect } from "react";

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — SupportMitra` : "SupportMitra";
    return () => { document.title = "SupportMitra"; };
  }, [title]);
}
