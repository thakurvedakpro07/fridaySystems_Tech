// Wraps the two competing hand-typed input styles that previously lived only
// as CSS classes (.input-base, .input-auth in index.css) so pages stop
// choosing between them ad hoc. `size="md"` == .input-base (default, used
// almost everywhere), `size="lg"` == .input-auth (taller/rounder, used on
// auth pages).
export default function Input({ size = "md", error = false, className = "", ...rest }) {
  const base = size === "lg" ? "input-auth" : "input-base";
  const errorClasses = error
    ? "border-rose-300 focus:ring-rose-500/30 focus:border-rose-500"
    : "";

  return <input className={`${base} ${errorClasses} ${className}`} {...rest} />;
}
