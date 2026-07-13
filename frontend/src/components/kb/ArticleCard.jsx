import { Link } from "react-router-dom";
import Badge from "../ui/Badge";

const CATEGORY_LABELS = {
  general: "General",
};

function categoryLabel(category, categories) {
  return categories?.find((c) => c.key === category)?.name ?? CATEGORY_LABELS[category] ?? category;
}

export default function ArticleCard({ article, categories }) {
  return (
    <Link
      to={`/knowledge-base/${article.id}`}
      className="block bg-white border border-slate-200 rounded-2xl p-5 shadow-card-sm
                 hover:shadow-card-hover hover:border-slate-300 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-bold text-slate-900 leading-snug">{article.title}</p>
        {article.status === "draft" && <Badge label="Draft" tone="amber" size="sm" />}
      </div>
      <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">{article.excerpt}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
          {categoryLabel(article.category, categories)}
        </span>
        <span className="text-[11px] text-slate-400">{article.view_count} views</span>
      </div>
    </Link>
  );
}
