export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-800">SupportMitra</span>
          <span className="text-slate-300 text-xs">·</span>
          <span className="text-xs text-slate-400">© {new Date().getFullYear()} SupportMitra Technologies</span>
        </div>
        <div className="flex gap-5">
          {["Terms", "Privacy", "Contact"].map((item) => (
            <a key={item} href="#" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
              {item}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
