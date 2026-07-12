// Shared card chrome for the Ticket Detail sidebar — one consistent
// bg/border/radius/shadow/padding definition instead of each card
// hand-rolling its own (previously duplicated with slightly different
// values across TicketHeroHeader, ResolutionSummary, PostPaymentCard, etc).
export default function Card({ title, children, className = "" }) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-2xl p-5 ${className}`}
      style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}
    >
      {title && (
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}
