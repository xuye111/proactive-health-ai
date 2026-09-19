import { Link, useLocation } from 'react-router-dom'
import { ASSISTANT_NAME } from '../lib/assistant'
import { IconHome, IconRecord, IconSparkle, IconUser } from './icons'

interface Tab {
  to: string
  label: string
  Icon: typeof IconHome
  /** 哪些路由点亮这个 tab。 */
  active: (pathname: string) => boolean
}

const TABS: Tab[] = [
  { to: '/', label: '首页', Icon: IconHome, active: (p) => p === '/' },
  {
    to: '/agent',
    label: ASSISTANT_NAME,
    Icon: IconSparkle,
    active: (p) => p.startsWith('/agent'),
  },
  {
    to: '/record',
    label: '记录',
    Icon: IconRecord,
    // 趋势已并入记录页；/trends 与 /plan 都是历史/二级地址
    active: (p) => p.startsWith('/record') || p.startsWith('/trends') || p.startsWith('/plan'),
  },
  { to: '/profile', label: '我的', Icon: IconUser, active: (p) => p.startsWith('/profile') },
]

export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="主导航"
      className="nav-safe-bottom fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-surface/95 backdrop-blur-md"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ to, label, Icon, active }) => {
          const isActive = active(pathname)
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-[60px] flex-col items-center justify-center gap-1 transition-colors ${
                  isActive ? 'text-brand' : 'text-muted'
                }`}
              >
                <Icon className="size-[22px]" />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
