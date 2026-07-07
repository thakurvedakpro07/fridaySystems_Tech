// Thin grid wrapper so pages pass an array of KPI configs instead of
// hand-writing the same `grid grid-cols-2 lg:grid-cols-N gap-4` each time.
// Column classes are a static lookup (not a template literal) so Tailwind's
// content scanner can find the literal class names at build time.
import KpiCard from "./KpiCard";

const COLS = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

export default function KpiRow({ items, columns = 4, className = "" }) {
  return (
    <div className={`grid grid-cols-2 ${COLS[columns] ?? COLS[4]} gap-4 ${className}`}>
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  );
}
