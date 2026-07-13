import ReactMarkdown from "react-markdown";

// Thin wrapper so every KB surface renders markdown with the same
// typography. No @tailwindcss/typography plugin is installed in this repo
// (tailwind.config.js plugins: []), so elements are styled directly via
// react-markdown's `components` prop instead of `prose` utility classes.
const COMPONENTS = {
  h1: (props) => <h1 className="text-lg font-bold text-slate-900 mt-5 mb-2 first:mt-0" {...props} />,
  h2: (props) => <h2 className="text-base font-bold text-slate-900 mt-5 mb-2 first:mt-0" {...props} />,
  h3: (props) => <h3 className="text-sm font-bold text-slate-900 mt-4 mb-1.5 first:mt-0" {...props} />,
  p:  (props) => <p className="text-sm text-slate-700 leading-relaxed mb-3" {...props} />,
  a:  (props) => <a className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer" {...props} />,
  strong: (props) => <strong className="font-semibold text-slate-900" {...props} />,
  ul: (props) => <ul className="list-disc list-outside pl-5 text-sm text-slate-700 mb-3 space-y-1" {...props} />,
  ol: (props) => <ol className="list-decimal list-outside pl-5 text-sm text-slate-700 mb-3 space-y-1" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  code: (props) => <code className="text-xs text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded" {...props} />,
  blockquote: (props) => (
    <blockquote className="border-l-2 border-slate-200 pl-3 text-sm text-slate-500 italic mb-3" {...props} />
  ),
};

export default function MarkdownRenderer({ children }) {
  return (
    <div className="max-w-none">
      <ReactMarkdown components={COMPONENTS}>{children}</ReactMarkdown>
    </div>
  );
}
