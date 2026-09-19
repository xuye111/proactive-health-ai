import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronLeft } from './icons'

interface AppBarProps {
  title: string
  subtitle?: string
  /** 传入返回目标时显示返回箭头（二级页面用）。 */
  backTo?: string
  /** 需要「返回上一页」而不是固定目标时用它（与 backTo 二选一）。 */
  onBack?: () => void
  right?: ReactNode
}

export function AppBar({ title, subtitle, backTo, onBack, right }: AppBarProps) {
  const showsBack = backTo !== undefined || onBack !== undefined
  const backClass =
    '-ml-2 flex size-9 items-center justify-center rounded-full text-ink-soft transition-colors active:bg-line-soft'

  return (
    <header className="safe-top sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-4">
        {showsBack &&
          (onBack !== undefined ? (
            <button type="button" aria-label="返回" onClick={onBack} className={backClass}>
              <IconChevronLeft className="size-5" />
            </button>
          ) : (
            <Link to={backTo ?? '/'} aria-label="返回" className={backClass}>
              <IconChevronLeft className="size-5" />
            </Link>
          ))}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle !== undefined && (
            <p className="truncate text-[11px] text-muted">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
    </header>
  )
}
