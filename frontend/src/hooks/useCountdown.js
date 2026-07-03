/**
 * useCountdown — live "time remaining until" display for an SLA deadline.
 *
 * Returns { label, overdue } where label reads e.g. "22m remaining",
 * "6h remaining", or "Overdue by 1h" once the deadline has passed.
 * Ticks every 30s — fine-grained enough to feel live without hammering
 * the render loop for a value nobody needs to the second.
 */
import { useEffect, useState } from "react";

function formatDuration(ms) {
  const totalMinutes = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  const days    = Math.floor(totalMinutes / (60 * 24));
  const hours   = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0)  return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function useCountdown(targetDate) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetDate) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!targetDate) return { label: null, overdue: false };

  const diff = new Date(targetDate).getTime() - now;
  const overdue = diff < 0;

  return {
    label: overdue ? `Overdue by ${formatDuration(diff)}` : `${formatDuration(diff)} remaining`,
    overdue,
  };
}
