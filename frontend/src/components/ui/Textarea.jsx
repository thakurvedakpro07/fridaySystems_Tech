// See Input.jsx — same size/error API, applied to a <textarea>.
export default function Textarea({ size = "md", error = false, className = "", ...rest }) {
  const base = size === "lg" ? "input-auth" : "input-base";
  const errorClasses = error
    ? "border-rose-300 focus:ring-rose-500/30 focus:border-rose-500"
    : "";

  return <textarea className={`${base} ${errorClasses} ${className}`} {...rest} />;
}
