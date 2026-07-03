/**
 * FreelancerProfileCard — rich public profile card for verified engineers.
 *
 * Used on:
 *  - Landing page engineer showcase section
 *  - Ticket detail page (assigned engineer)
 *  - Future /engineers/:id public profile page
 *
 * Props:
 *  - engineer: object with all profile fields
 *  - size: "compact" | "full" (default "full")
 */
export default function FreelancerProfileCard({ engineer, size = "full" }) {
  if (!engineer) return null;

  const {
    name, title, bio, skills = [], yearsExp, certifications = [],
    ticketsSolved, avgResponseTime, successRate, rating,
    gradient = "from-indigo-500 to-violet-600",
    initials, status = "online",
  } = engineer;

  const Stars = ({ value }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= Math.round(value) ? "text-amber-400" : "text-slate-200"}`}
             viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ))}
      <span className="text-xs font-semibold text-slate-700 ml-1">{value?.toFixed(1)}</span>
    </div>
  );

  if (size === "compact") {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-default"
           style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.06)" }}>
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} text-white text-sm font-bold
                            flex items-center justify-center select-none shadow-sm`}>
              {initials}
            </div>
            {status === "online" && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold text-slate-900 leading-tight">{name}</p>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                               bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-600">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{title}</p>
            <div className="mt-1.5">
              <Stars value={rating} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
          <div>
            <p className="text-base font-black text-slate-900">{yearsExp}+</p>
            <p className="text-[10px] text-slate-500 font-medium leading-tight">yrs exp</p>
          </div>
          <div className="border-x border-slate-100">
            <p className="text-base font-black text-slate-900">{ticketsSolved}</p>
            <p className="text-[10px] text-slate-500 font-medium leading-tight">resolved</p>
          </div>
          <div>
            <p className="text-base font-black text-slate-900">{avgResponseTime}</p>
            <p className="text-[10px] text-slate-500 font-medium leading-tight">response</p>
          </div>
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {skills.slice(0, 4).map((s) => (
              <span key={s}
                    className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-full">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full card
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default"
         style={{ boxShadow: "0 2px 12px 0 rgb(0 0 0 / 0.06)" }}>
      {/* Header gradient */}
      <div className={`h-20 bg-gradient-to-br ${gradient} relative`}>
        <div className="absolute inset-0 opacity-20"
             style={{ backgroundImage: "radial-gradient(circle at 30% 50%, rgba(255,255,255,0.3), transparent 60%)" }} />
      </div>

      <div className="px-5 pb-5">
        {/* Avatar floats over header */}
        <div className="relative -mt-8 mb-3 flex items-end justify-between">
          <div className="relative">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} text-white text-lg font-black
                            flex items-center justify-center select-none shadow-lg border-3 border-white`}
                 style={{ border: "3px solid white" }}>
              {initials}
            </div>
            {status === "online" && (
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
            )}
          </div>
          {/* Verified badge */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                           bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-600 mb-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Verified Engineer
          </span>
        </div>

        {/* Name + title */}
        <h3 className="text-lg font-black text-slate-900 leading-tight">{name}</h3>
        <p className="text-sm text-slate-500 mt-0.5 font-medium">{title}</p>

        {/* Stars */}
        <div className="flex items-center gap-2 mt-2">
          <Stars value={rating} />
          {successRate && (
            <span className="text-[11px] text-slate-500">· {successRate}% success rate</span>
          )}
        </div>

        {/* Bio */}
        {bio && (
          <p className="text-sm text-slate-500 mt-3 leading-relaxed line-clamp-2">{bio}</p>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mt-4 py-4 border-y border-slate-100 text-center">
          <div>
            <p className="text-xl font-black text-slate-900">{yearsExp}+</p>
            <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">Yrs Experience</p>
          </div>
          <div>
            <p className="text-xl font-black text-slate-900">{ticketsSolved}</p>
            <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">Tickets Solved</p>
          </div>
          <div>
            <p className="text-xl font-black text-slate-900">{avgResponseTime}</p>
            <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">Avg Response</p>
          </div>
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s}
                      className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700
                                 text-[11px] font-semibold rounded-full">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Certifications</p>
            <div className="flex flex-wrap gap-1.5">
              {certifications.map((c) => (
                <span key={c}
                      className="px-2.5 py-1 bg-amber-50 border border-amber-100 text-amber-700
                                 text-[11px] font-semibold rounded-full flex items-center gap-1">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Online status */}
        <div className="mt-4 flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <p className="text-xs text-emerald-700 font-semibold">Available for new tickets</p>
        </div>
      </div>
    </div>
  );
}
