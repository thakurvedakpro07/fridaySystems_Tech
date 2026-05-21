import Spinner from "./Spinner";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  type = "button",
  onClick,
  className = "",
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg " +
    "transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 " +
    "disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const variants = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 " +
      "focus:ring-indigo-500/50 shadow-sm hover:shadow",
    secondary:
      "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 " +
      "active:bg-slate-100 focus:ring-slate-300 shadow-sm",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 " +
      "focus:ring-rose-500/50 shadow-sm hover:shadow",
    ghost:
      "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 " +
      "active:bg-slate-200 focus:ring-slate-300",
    warning:
      "bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 " +
      "focus:ring-amber-400/50 shadow-sm",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-[0.9375rem]",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${variants[variant] ?? variants.primary} ${sizes[size] ?? sizes.md} ${className}`}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
