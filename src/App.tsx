import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import Agent from './pages/Agent'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Record from './pages/Record'
import Safety from './pages/Safety'

export default function App() {
  const { pathname } = useLocation()
  const main = useRef<HTMLElement>(null)
  const phonePreview = typeof window !== 'undefined' &&
    new URLSearchParams(window.location?.search).get('preview') === 'phone'

  useEffect(() => {
    if (phonePreview) main.current?.scrollTo({ top: 0 })
    else window.scrollTo({ top: 0 })
  }, [pathname, phonePreview])

  return (
    <div className={phonePreview ? 'phone-preview' : 'min-h-dvh bg-canvas md:bg-[#e8ecf1]'}>
      <div className={phonePreview
        ? 'phone-preview-screen relative flex w-full flex-col bg-canvas'
        : 'relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-canvas md:border-x md:border-line'}>
        {phonePreview && <div className="phone-preview-status" aria-hidden="true">
          <span>9:41</span>
          <span className="phone-preview-island" />
          <svg viewBox="0 0 58 16" width="58" height="16" fill="currentColor">
            <path d="M1 12h2v3H1zm4-3h2v6H5zm4-3h2v9H9zm4-3h2v12h-2z" />
            <path d="M20 6a12 12 0 0 1 16 0l-1.4 1.4a10 10 0 0 0-13.2 0zm3 3a7.5 7.5 0 0 1 10 0l-1.4 1.4a5.5 5.5 0 0 0-7.2 0zm3 3a3 3 0 0 1 4 0l-2 2z" />
            <rect x="40" y="4" width="15" height="9" rx="2" fill="none" stroke="currentColor" />
            <rect x="42" y="6" width="11" height="5" rx="1" />
            <path d="M56 7h1v3h-1z" />
          </svg>
        </div>}
        <main ref={main} className="main-safe-bottom flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/agent" element={<Agent />} />
            <Route path="/solutions" element={<Navigate to="/" replace />} />
            <Route path="/record" element={<Record />} />
            <Route path="/trends" element={<Navigate to="/record" replace />} />
            <Route path="/plan" element={<Navigate to="/record" replace />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/memory" element={<Navigate to="/profile" replace />} />
            <Route path="/profile/knowledge" element={<Navigate to="/profile/safety" replace />} />
            <Route path="/profile/graph" element={<Navigate to="/profile" replace />} />
            <Route path="/profile/safety" element={<Safety />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
        <BottomNav />
        {phonePreview && <div className="phone-preview-home" aria-hidden="true"><span /></div>}
      </div>
    </div>
  )
}
