"use client"

type Props = {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export default function ConfirmModal({
  open,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  danger = true,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
        <p className="text-sm text-gray-800 whitespace-pre-wrap mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm hover:bg-gray-50 text-gray-700"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors ${danger ? "bg-[#D85A30] hover:bg-[#c04d26]" : "bg-[#1D9E75] hover:bg-[#178a64]"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
