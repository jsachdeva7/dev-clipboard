import React from 'react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-30 dark:bg-opacity-50 flex items-center justify-center z-50"
      onClick={onCancel}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-5 max-w-sm w-full mx-4 border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-medium mb-2 text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors outline-none focus:outline-none border-transparent hover:border-transparent focus:border-transparent"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-500 transition-colors outline-none focus:outline-none border-transparent hover:border-transparent focus:border-transparent"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

