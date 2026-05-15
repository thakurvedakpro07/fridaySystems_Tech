export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-gray-500">
        <span>© {new Date().getFullYear()} SupportMitra Technologies</span>
        <div className="flex gap-4">
          <a href="#" className="hover:text-gray-800">Terms</a>
          <a href="#" className="hover:text-gray-800">Privacy</a>
          <a href="#" className="hover:text-gray-800">Contact</a>
        </div>
      </div>
    </footer>
  );
}
