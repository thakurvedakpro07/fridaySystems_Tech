/**
 * Modal — a dialog overlay for confirmations and forms.
 * Usage:
 *   <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Confirm">
 *     <p>Are you sure?</p>
 *   </Modal>
 */
export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    // Dark overlay — clicking it closes the modal
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      {/* Modal box — stop click from propagating to the overlay */}
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
