import type { ReactNode } from 'react'

/**
 * 阶段说明条。
 * 第一阶段的页面里有不少「看起来能用、其实还没接后端」的地方，
 * 统一用它标注，避免演示时被误读成已完成能力。
 */
export function StageNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-line bg-calm/70 px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
      {children}
    </p>
  )
}
