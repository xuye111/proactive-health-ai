import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import Agent from './pages/Agent'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Record from './pages/Record'
import Safety from './pages/Safety'
import Graph from './pages/profile/Graph'
import Knowledge from './pages/profile/Knowledge'
import Memory from './pages/profile/Memory'

export default function App() {
  const { pathname } = useLocation()

  // 移动端页面切换后回到顶部（底部导航是 fixed，不参与滚动）
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="min-h-dvh bg-canvas md:bg-[#e8ecf1]">
      {/* 桌面端把手机宽度居中显示，移动端满宽 */}
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-canvas md:border-x md:border-line">
        <main className="main-safe-bottom flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/agent" element={<Agent />} />
            {/* 记录与趋势合并为一个入口，两个视图共用一份数据 */}
            <Route path="/record" element={<Record view="today" />} />
            <Route path="/trends" element={<Record view="trends" />} />
            {/* 计划页已并入记录页，保留旧地址重定向 */}
            <Route path="/plan" element={<Navigate to="/record" replace />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/memory" element={<Memory />} />
            <Route path="/profile/knowledge" element={<Knowledge />} />
            <Route path="/profile/graph" element={<Graph />} />
            <Route path="/profile/safety" element={<Safety />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
