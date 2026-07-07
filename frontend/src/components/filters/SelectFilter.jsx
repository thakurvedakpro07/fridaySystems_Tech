export default function SelectFilter({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700
                 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:border-indigo-400 transition min-w-[160px]">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
