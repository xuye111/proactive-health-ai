import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronRight } from './icons'

interface SectionTitleProps {
  title: string
  hint?: string
  action?: { label: string; to: string }
  children?: ReactNode
}

export function SectionTitle({ title, hint, action, children }: SectionTitleProps) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-wide text-ink-soft">{title}</h2>
        {hint !== undefined && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
      </div>
      {action !== undefined ? (
        <Link
          to={action.to}
          className="flex shrink-0 items-center gap-0.5 text-[12px] font-medium text-brand"
        >
          {action.label}
          <IconChevronRight className="size-3.5" />
        </Link>
      ) : (
        children
      )}
    </div>
  )
}
