import { useEffect, useState } from "react";

// Touch-primary devices (phones, tablets) have coarse pointer and no hover.
// Mice/trackpads have fine pointer and hover — those are our "desktop" targets
// that cannot place phone calls.
const TOUCH_MQ = "(hover: none) and (pointer: coarse)";

export function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(TOUCH_MQ).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(TOUCH_MQ);
    const update = (e) => setMobile(e.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return mobile;
}
