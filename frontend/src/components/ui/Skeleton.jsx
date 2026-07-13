// Thin wrapper around the `.shimmer` loading utility (index.css) — replaces
// one-off `<div className="... shimmer ...">` blocks hand-rolled per page.
export default function Skeleton({ className = "" }) {
  return <div className={`shimmer ${className}`} aria-hidden="true" />;
}
