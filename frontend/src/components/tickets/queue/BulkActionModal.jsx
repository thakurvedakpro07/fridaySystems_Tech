import { motion } from "framer-motion";

// Shared chrome for the two-step bulk-action modals (BulkAssignModal,
// BulkStatusModal in OpsTicketQueue.jsx) — backdrop, dialog container,
// animation wrapper, title area, close button, and footer layout. Each
// modal still owns its own step state, body content, and submit logic;
// this only factors out what was byte-for-byte duplicated between them.
export default function BulkActionModal({
  title,
  subtitle,
  onClose,
  loading,
  children,
  cancelButtonText = "Cancel",
  primaryButtonText,
  onCancel,
  onConfirm,
  confirmDisabled,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
         onClick={(e) => !loading && e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose} disabled={loading}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {children}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {cancelButtonText}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all
                       ${confirmDisabled ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 shadow-sm"}`}>
            {primaryButtonText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
