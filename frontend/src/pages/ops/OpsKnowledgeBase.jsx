import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppShell from "../../components/layout/AppShell";
import { usePageTitle } from "../../hooks/usePageTitle";
import {
  listArticles, listCategories, createArticle, updateArticle, deleteArticle,
} from "../../api/knowledgeBase";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import TableCard from "../../components/table/TableCard";
import FilterBar from "../../components/filters/FilterBar";
import ArticleEditorForm from "../../components/kb/ArticleEditorForm";

const GRID = "grid-cols-[2fr_1fr_0.7fr_0.7fr_auto]";

export default function OpsKnowledgeBase() {
  usePageTitle("Knowledge Base — Operations");

  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState({ open: false, article: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    listCategories().then((res) => setCategories(res.data.categories)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;
      const res = await listArticles(params);
      setArticles(res.data?.results ?? res.data ?? []);
    } catch {
      showToast("Failed to load articles.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const handleSave = async (formData) => {
    setActionLoading(true);
    try {
      if (modal.article) {
        await updateArticle(modal.article.id, formData);
        showToast("Article updated.");
      } else {
        await createArticle(formData);
        showToast(formData.status === "published" ? "Article published." : "Draft saved.");
      }
      setModal({ open: false, article: null });
      load();
    } catch (e) {
      showToast(e?.response?.data?.detail ?? "Failed to save article.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (article) => {
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
    try {
      await deleteArticle(article.id);
      showToast("Article deleted.");
      load();
    } catch {
      showToast("Failed to delete article.", "error");
    }
  };

  const categoryName = (key) => categories.find((c) => c.key === key)?.name ?? key;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <PageHeader title="Knowledge Base" description="Author and manage self-service articles." />
          <Button onClick={() => setModal({ open: true, article: null })}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Article
          </Button>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className={`px-4 py-3 rounded-xl text-sm font-semibold ${
                toast.type === "error" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search articles…"
          status={statusFilter}
          onStatusChange={setStatusFilter}
          statusOptions={[
            { value: "", label: "All Status" },
            { value: "draft", label: "Draft" },
            { value: "published", label: "Published" },
          ]}
          onClear={() => { setSearch(""); setStatusFilter(""); }}
        />

        <TableCard
          columns={["Title", "Category", "Status", "Views", ""]}
          gridColsClassName={GRID}
          loading={loading}
          isEmpty={!loading && articles.length === 0}
          emptyState={
            <EmptyState size="compact" icon="📄" title="No articles yet"
              description="Create your first Knowledge Base article." />
          }
        >
          {articles.map((a) => (
            <div key={a.id} className={`grid ${GRID} gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors`}>
              <p className="text-sm font-semibold text-slate-800 truncate">{a.title}</p>
              <p className="text-sm text-slate-500 truncate">{categoryName(a.category)}</p>
              <Badge label={a.status === "published" ? "Published" : "Draft"}
                     tone={a.status === "published" ? "emerald" : "amber"} shape="pill" />
              <p className="text-sm text-slate-500">{a.view_count}</p>
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setModal({ open: true, article: a })}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(a)}
                  className="text-xs font-semibold text-rose-600 border border-rose-200 hover:border-rose-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </TableCard>
      </div>

      <Modal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, article: null })}
        title={modal.article ? "Edit Article" : "New Article"}
      >
        <ArticleEditorForm
          initial={modal.article}
          categories={categories}
          onSave={handleSave}
          onCancel={() => setModal({ open: false, article: null })}
          loading={actionLoading}
        />
      </Modal>
    </AppShell>
  );
}
