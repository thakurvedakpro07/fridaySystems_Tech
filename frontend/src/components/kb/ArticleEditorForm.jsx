import { useEffect, useState } from "react";
import FormSection from "../ui/FormSection";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import Select from "../ui/Select";
import Button from "../ui/Button";
import MarkdownRenderer from "./MarkdownRenderer";

const EMPTY = { title: "", body: "", category: "general", tags: "", status: "draft" };

export default function ArticleEditorForm({ initial, categories, onSave, onCancel, loading }) {
  const [form, setForm] = useState(initial ?? EMPTY);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setForm(initial ?? EMPTY);
  }, [initial]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (status) => {
    if (!form.title.trim() || !form.body.trim()) return;
    onSave({ ...form, status });
  };

  return (
    <div className="space-y-4">
      <FormSection title="Article Details" description="Written in Markdown — supports headings, lists, links, and code.">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <Input value={form.title} onChange={set("title")} placeholder="e.g. Resolving VPN disconnect issues" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Category</label>
              <Select value={form.category} onChange={set("category")}>
                {(categories ?? []).map((c) => (
                  <option key={c.key} value={c.key}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tags</label>
              <Input value={form.tags} onChange={set("tags")} placeholder="comma, separated, tags" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-500">
                Body (Markdown) <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                {showPreview ? "Edit" : "Preview"}
              </button>
            </div>
            {showPreview ? (
              <div className="border border-slate-200 rounded-xl p-4 min-h-[200px] bg-slate-50">
                <MarkdownRenderer>{form.body || "*Nothing to preview yet.*"}</MarkdownRenderer>
              </div>
            ) : (
              <Textarea
                value={form.body}
                onChange={set("body")}
                rows={12}
                className="font-mono text-xs resize-y"
                placeholder="## Overview&#10;&#10;Describe the issue and resolution steps…"
              />
            )}
          </div>
        </div>
      </FormSection>

      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button variant="secondary" onClick={() => handleSubmit("draft")} loading={loading} disabled={!form.title.trim() || !form.body.trim()}>
          Save as Draft
        </Button>
        <Button onClick={() => handleSubmit("published")} loading={loading} disabled={!form.title.trim() || !form.body.trim()}>
          Publish
        </Button>
      </div>
    </div>
  );
}
