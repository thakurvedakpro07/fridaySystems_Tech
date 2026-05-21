import { useState } from "react";
import { addComment } from "../../api/tickets";
import { useToast } from "../../context/ToastContext";
import { useComments } from "../../hooks/useComments";
import { useAuthStore } from "../../store/authStore";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";

function CommentBubble({ comment }) {
  const user = useAuthStore((s) => s.user);
  const isOwn = comment.author_email === user?.email;

  const timeLabel = new Date(comment.created_at).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-400">
          {comment.author_email ?? "Deleted User"}
          {comment.is_edited && <span className="ml-1 italic">(edited)</span>}
        </span>
        <span className="text-xs text-gray-300">·</span>
        <span className="text-xs text-gray-400">{timeLabel}</span>
      </div>

      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
          ${isOwn
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-800 rounded-bl-sm"
          }`}
      >
        {comment.body}
      </div>
    </div>
  );
}

export default function CommentSection({ ticketId }) {
  const { comments, loading, error, refetch } = useComments(ticketId);
  const [body, setBody]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;

    setSubmitting(true);
    try {
      await addComment(ticketId, body.trim());
      setBody("");
      refetch();
      toast("Comment posted", "success");
    } catch {
      toast("Failed to post comment. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSubmit(e);
    }
  };

  return (
    <div className="mt-6">
      {/* Comment list */}
      <div className="space-y-4 min-h-[60px]">
        {loading && (
          <div className="flex items-center gap-2 py-4">
            <Spinner size="sm" />
            <span className="text-sm text-gray-400">Loading comments…</span>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm">Could not load comments.</p>
        )}

        {!loading && !error && comments.length === 0 && (
          <p className="text-gray-400 text-sm">
            No comments yet. Be the first to reply.
          </p>
        )}

        {comments.map((c) => (
          <CommentBubble key={c.id} comment={c} />
        ))}
      </div>

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="mt-5">
        <label htmlFor="comment-body" className="sr-only">Write a comment</label>
        <textarea
          id="comment-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="Write a comment… (Ctrl+Enter to submit)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex justify-end mt-2">
          <Button
            type="submit"
            disabled={submitting || !body.trim()}
          >
            {submitting ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
