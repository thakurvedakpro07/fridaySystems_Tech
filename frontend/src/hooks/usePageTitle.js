import { useEffect } from "react";

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — ResolveHQ` : "ResolveHQ";
    return () => { document.title = "ResolveHQ"; };
  }, [title]);
}
