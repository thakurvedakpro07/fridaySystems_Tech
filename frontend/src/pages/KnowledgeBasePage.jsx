import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/layout/AppShell";
import { usePageTitle } from "../hooks/usePageTitle";
import { listArticles, listCategories } from "../api/knowledgeBase";
import PageHeader from "../components/ui/PageHeader";
import FilterBar from "../components/filters/FilterBar";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";
import Alert from "../components/ui/Alert";
import ArticleCard from "../components/kb/ArticleCard";
import { useRoles } from "../hooks/useRoles";
import { BookOpenIcon } from "../components/tickets/ActionIcons";

export default function KnowledgeBasePage() {
  usePageTitle("Knowledge Base");
  const { isAnyStaff } = useRoles();

  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    listCategories().then((res) => setCategories(res.data.categories)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search) params.q = search;
      if (category) params.category = category;
      const res = await listArticles(params);
      setArticles(res.data?.results ?? res.data ?? []);
    } catch {
      setError("Failed to load Knowledge Base articles.");
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search-as-you-type
    return () => clearTimeout(t);
  }, [load]);

  const categoryOptions = [
    { value: "", label: "All Categories" },
    ...categories.map((c) => ({ value: c.key, label: c.name })),
  ];

  return (
    <AppShell maxWidth="max-w-7xl">
      <div className="space-y-6">
        <PageHeader
          title="Knowledge Base"
          description="Self-service guides and troubleshooting articles."
          actions={isAnyStaff ? (
            <a href="/operations/knowledge-base"
               className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
              Manage articles →
            </a>
          ) : undefined}
        />

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search articles…"
          status={category}
          onStatusChange={setCategory}
          statusOptions={categoryOptions}
          onClear={() => { setSearch(""); setCategory(""); }}
        />

        {error && <Alert severity="error">{error}</Alert>}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        ) : articles.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl">
            <EmptyState
              icon={<BookOpenIcon className="w-8 h-8 text-slate-500" />}
              title="No articles found"
              description={search || category ? "Try a different search or category." : "No Knowledge Base articles have been published yet."}
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((a) => <ArticleCard key={a.id} article={a} categories={categories} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}
