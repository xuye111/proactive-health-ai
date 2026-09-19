import { IconCheck } from './icons'

interface ChecklistItemProps {
  checked: boolean
  onToggle: () => void
  title: string
  /** 为什么给这条建议——保留依据，健康建议不能只有结论。 */
  reason?: string
}

export function ChecklistItem({ checked, onToggle, title, reason }: ChecklistItemProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span
          className={`mt-0.5 flex size-[19px] shrink-0 items-center justify-center rounded-md border transition-colors ${
            checked ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-transparent'
          }`}
        >
          <IconCheck className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[14px] leading-snug ${
              checked ? 'text-muted line-through' : 'text-ink'
            }`}
          >
            {title}
          </span>
          {reason !== undefined && (
            <span className="mt-0.5 block text-[11px] leading-snug text-muted">{reason}</span>
          )}
        </span>
      </button>
    </li>
  )
}
