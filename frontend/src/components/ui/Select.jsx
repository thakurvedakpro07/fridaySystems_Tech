// See Input.jsx — same size/error API, applied to a <select>. Adds a small
// chevron affordance via appearance-none + background so it doesn't look
// like a plain browser default dropped into an otherwise-styled form.
export default function Select({ size = "md", error = false, className = "", children, ...rest }) {
  const base = size === "lg" ? "input-auth" : "input-base";
  const errorClasses = error
    ? "border-rose-300 focus:ring-rose-500/30 focus:border-rose-500"
    : "";

  return (
    <select className={`${base} ${errorClasses} appearance-none cursor-pointer ${className}`} {...rest}>
      {children}
    </select>
  );
}
