import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import { usePageTitle } from "../hooks/usePageTitle";
import { getArticle } from "../api/knowledgeBase";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Skeleton from "../components/ui/Skeleton";
import Alert from "../components/ui/Alert";
import MarkdownRenderer from "../components/kb/MarkdownRenderer";
import { useRoles } from "../hooks/useRoles";

export default function KnowledgeBaseArticlePage() {
  const { id } = useParams();
  const { isAnyStaff } = useRoles();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  usePageTitle(article?.title ?? "Knowledge Base");

  useEffect(() => {
    setLoading(true);
    setError(null);
    getArticle(id)
      .then((res) => setArticle(res.data))
      .catch((e) => setError(e?.response?.status === 404
        ? "This article could not be found."
        : "Failed to load this article."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <AppShell maxWidth="max-w-3xl">
      <div className="space-y-4">
        <Link to="/knowledge-base" className="text-sm font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
          ← Back to Knowledge Base
        </Link>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3 rounded-lg" />
            <Skeleton className="h-4 w-1/3 rounded-lg" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        )}

        {!loading && error && <Alert severity="error">{error}</Alert>}

        {!loading && article && (
          <>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-page-title">{article.title}</h1>
              {article.status === "draft" && <Badge label="Draft" tone="amber" />}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {article.author_email && <span>By {article.author_email}</span>}
              <span>·</span>
              <span>{article.view_count} views</span>
              <span>·</span>
              <span>Updated {new Date(article.updated_at).toLocaleDateString()}</span>
            </div>

            <Card>
              <MarkdownRenderer>{article.body}</MarkdownRenderer>
            </Card>

            {isAnyStaff && article.related_tickets?.length > 0 && (
              <Card title="LINKED TICKETS">
                <div className="space-y-2">
                  {article.related_tickets.map((t) => (
                    <Link
                      key={t.ticket_id}
                      to={`/tickets/${t.ticket_id}`}
                      className="flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-slate-700">{t.ticket_title}</span>
                      <span className="text-xs font-semibold text-slate-400">{t.ticket_number}</span>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
