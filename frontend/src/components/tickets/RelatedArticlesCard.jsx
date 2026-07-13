import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../ui/Card";
import Modal from "../ui/Modal";
import SearchInput from "../filters/SearchInput";
import Skeleton from "../ui/Skeleton";
import { getTicketArticles, linkArticleToTicket, unlinkArticleFromTicket, listArticles } from "../../api/knowledgeBase";

function ArticleRow({ article, action }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <Link
        to={`/knowledge-base/${article.id}`}
        className="text-xs text-slate-700 hover:text-indigo-600 truncate"
      >
        {article.title}
      </Link>
      {action}
    </div>
  );
}

// Visible to every role — the Knowledge Base is customer self-service, not
// an internal-only tool. Staff additionally get a "Manage links" action to
// attach/detach articles manually.
export default function RelatedArticlesCard({ ticketId, canManage = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getTicketArticles(ticketId)
      .then((res) => setData(res.data))
      .catch(() => setData({ linked: [], suggested: [] }))
      .finally(() => setLoading(false));
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  const hasContent = data && (data.linked.length > 0 || data.suggested.length > 0);

  if (!loading && !hasContent && !canManage) return null;

  return (
    <>
      <Card title="RELATED ARTICLES">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 rounded" />
            <Skeleton className="h-4 rounded" />
          </div>
        ) : !hasContent ? (
          <p className="text-xs text-slate-400">No related articles yet.</p>
        ) : (
          <div className="space-y-3">
            {data.linked.length > 0 && (
              <div className="space-y-1">
                {data.linked.map((a) => (
                  <ArticleRow
                    key={a.id}
                    article={a}
                    action={canManage && (
                      <button
                        onClick={() => unlinkArticleFromTicket(ticketId, a.id).then(load)}
                        className="text-[10px] font-semibold text-slate-400 hover:text-rose-600 shrink-0"
                      >
                        Unlink
                      </button>
                    )}
                  />
                ))}
              </div>
            )}
            {data.suggested.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Suggested</p>
                {data.suggested.map((a) => (
                  <ArticleRow
                    key={a.id}
                    article={a}
                    action={canManage && (
                      <button
                        onClick={() => linkArticleToTicket(ticketId, a.id).then(load)}
                        className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 shrink-0"
                      >
                        Link
                      </button>
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {canManage && (
          <button
            onClick={() => setManageOpen(true)}
            className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Manage links →
          </button>
        )}
      </Card>

      {canManage && (
        <ManageLinksModal
          isOpen={manageOpen}
          onClose={() => setManageOpen(false)}
          ticketId={ticketId}
          linkedIds={new Set((data?.linked ?? []).map((a) => a.id))}
          onChange={load}
        />
      )}
    </>
  );
}

function ManageLinksModal({ isOpen, onClose, ticketId, linkedIds, onChange }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const t = setTimeout(() => {
      listArticles({ q: search })
        .then((res) => setResults(res.data?.results ?? res.data ?? []))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [isOpen, search]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Related Articles">
      <div className="space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search Knowledge Base…" />
        {loading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {results.map((a) => {
              const linked = linkedIds.has(a.id);
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <p className="text-sm text-slate-700 truncate">{a.title}</p>
                  <button
                    onClick={() => {
                      const action = linked
                        ? unlinkArticleFromTicket(ticketId, a.id)
                        : linkArticleToTicket(ticketId, a.id);
                      action.then(onChange);
                    }}
                    className={`text-xs font-semibold shrink-0 px-2.5 py-1 rounded-lg border transition-colors ${
                      linked
                        ? "text-rose-600 border-rose-200 hover:border-rose-300"
                        : "text-indigo-600 border-indigo-200 hover:border-indigo-300"
                    }`}
                  >
                    {linked ? "Unlink" : "Link"}
                  </button>
                </div>
              );
            })}
            {results.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">No articles found.</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
