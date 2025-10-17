'use client'

export function PageOverlay({
  show,
  label = 'Kaydediliyor…',
}: {
  show: boolean
  label?: string
}) {
  if (!show) return null
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-white/70 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600" />
        <div className="text-sm font-medium text-neutral-700">{label}</div>
      </div>
    </div>
  )
}
