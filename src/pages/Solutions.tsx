import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AppBar } from '../components/AppBar'
import { SectionTitle } from '../components/SectionTitle'
import { IconChevronRight } from '../components/icons'
import { reviewPersonal } from '../ai/personal'
import { isSolutionTopic, solutionCatalog, solutionContent, solutionOfferById, solutionTopics, topicLabels } from '../ai/solutions'
import { activeDate, effectiveRecords, localTimestamp, useHealthState } from '../lib/healthStore'
import { useFollowUps } from '../lib/followUpStore'
import { completeMockOrder, createMockOrder, loadMockOrders, saveMockOrders, type MockOrder } from '../lib/mockOrders'

const productStyle: Record<string, { background: string; symbol: string }> = {
  课程: { background: 'bg-indigo-50 text-indigo-600', symbol: '✧' },
  服务: { background: 'bg-rose-50 text-rose-600', symbol: '♡' },
  设备: { background: 'bg-sky-50 text-sky-600', symbol: '◉' },
  健康用品: { background: 'bg-amber-50 text-amber-600', symbol: '✦' },
  营养食品: { background: 'bg-emerald-50 text-emerald-700', symbol: '◌' },
}
type Offer = (typeof solutionCatalog)[number]

function OfferVisual({ kind, large = false }: { kind: string; large?: boolean }) {
  const style = productStyle[kind] ?? productStyle['健康用品']
  return <div className={'flex items-center justify-center ' + (large ? 'h-44 text-[60px] ' : 'h-25 text-[40px] ') + style.background} aria-hidden="true">{style.symbol}</div>
}

function OrderSummary({ order }: { order: MockOrder }) {
  return <div className="card p-4">
    <p className="text-[11px] text-muted">模拟订单 · {order.id}</p>
    <p className="mt-2 text-[14px] font-semibold text-ink">{order.name}</p>
    <p className="mt-1 text-[12px] text-ink-soft">{order.kind} · ¥{order.unitPrice} × {order.quantity}</p>
    <div className="mt-3 flex justify-between border-t border-line-soft pt-3 text-[13px]"><span>演示合计</span><strong className="text-brand-deep">¥{order.total}</strong></div>
  </div>
}

export default function Solutions() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [orders, setOrders] = useState<MockOrder[]>(loadMockOrders)
  const [error, setError] = useState('')
  const selected = params.get('topic')
  const requestedTopic = isSolutionTopic(selected) ? selected : selected === 'all' ? undefined : 'sleep'
  const item = solutionOfferById(params.get('item') ?? '')
  const step = params.get('step')
  const quantityFromUrl = Number(params.get('qty'))
  const checkoutQuantity = step === 'checkout' && Number.isInteger(quantityFromUrl) && quantityFromUrl >= 1 && quantityFromUrl <= 9 ? quantityFromUrl : 1
  const view = params.get('view')
  const orderId = params.get('order') ?? ''
  const order = orders.find((entry) => entry.id === orderId)
  const health = useHealthState()
  const date = activeDate(health)
  const personal = reviewPersonal(health.records, date)
  const experience = reviewPersonal(effectiveRecords(health), date)
  const signal = personal.signals[0] ?? experience.signals[0]
  const followUps = useFollowUps()
  const safety = followUps.find((entry) => entry.status === '建议就医')
  const currentAction = followUps.find((entry) => entry.status === '进行中' || entry.status === '待回访')?.action
  const focus = solutionContent(signal?.type, Boolean(safety), requestedTopic)
  const relatedNames = new Set(solutionContent(signal?.type).offers.map((offer) => offer.name))
  const offers = solutionContent(undefined, Boolean(safety), requestedTopic).offers.filter((offer) =>
    (offer.name + offer.kind).includes(search.trim()),
  )
  const pageKey = params.toString()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pageKey])
  useEffect(() => { setQuantity(1) }, [item?.id])

  const placeOrder = () => {
    if (!item || safety) return
    try {
      const created = createMockOrder(orders, item, checkoutQuantity, localTimestamp())
      const next = [...orders, created].slice(-100)
      saveMockOrders(next)
      setOrders(next)
      setError('')
      navigate('/solutions?view=payment&order=' + encodeURIComponent(created.id))
    } catch (cause) { setError(cause instanceof Error ? cause.message : '模拟下单失败') }
  }
  const finishOrder = () => {
    if (!order || safety) return
    try {
      const next = completeMockOrder(orders, order.id, localTimestamp())
      saveMockOrders(next)
      setOrders(next)
      setError('')
      navigate('/solutions?view=success&order=' + encodeURIComponent(order.id))
    } catch (cause) { setError(cause instanceof Error ? cause.message : '模拟付款未完成') }
  }

  const title = view === 'orders' ? '我的模拟订单' : view === 'payment' ? '模拟付款' : view === 'success' ? '订单完成'
    : view === 'order' ? '订单详情' : item ? step === 'checkout' ? '确认订单' : '项目详情' : '健康方案'
  const backTo = view === 'orders' ? '/solutions' : view === 'order' ? '/solutions?view=orders'
    : view === 'payment' ? '/solutions?view=orders' : view === 'success' ? '/solutions?view=orders'
      : item ? step === 'checkout' ? '/solutions?item=' + item.id : '/solutions' : undefined
  const showSafety = Boolean(safety) && view !== 'orders' && view !== 'order' && view !== 'success'

  return <>
    <AppBar title={title} subtitle={item || view ? '本机演示流程 · 不发生真实交易' : '课程、服务与非药品健康用品'} backTo={backTo}
      right={view === 'orders' ? undefined : <Link to="/solutions?view=orders" className="text-[12px] font-medium text-brand-deep">订单</Link>} />
    <div className="space-y-5 px-4 pt-4">
      {showSafety ? <section role="alert" className="rounded-2xl border border-danger/40 bg-danger/5 p-4">
        <p className="text-[14px] font-semibold text-danger">请先处理需要就医评估的问题</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{safety?.topic}。目前暂停展示和下单，请查看小满给出的就医提示。</p>
        <Link to="/agent" className="mt-3 inline-flex items-center text-[12px] font-medium text-danger">查看提示 <IconChevronRight className="size-4" /></Link>
      </section> : view === 'orders' ? <>
        {orders.length === 0 ? <div className="card p-5 text-[13px] text-ink-soft">还没有模拟订单。可以先到健康方案里选择一个项目体验下单。</div>
          : <div className="space-y-3">{[...orders].reverse().map((entry) => <Link key={entry.id} to={'/solutions?view=order&order=' + encodeURIComponent(entry.id)} className="card block p-4">
            <p className="text-[11px] text-muted">{entry.id} · {entry.createdAt.slice(0, 16).replace('T', ' ')}</p>
            <p className="mt-2 text-[14px] font-medium text-ink">{entry.name}</p>
            <div className="mt-2 flex justify-between text-[12px]"><span className={entry.status === '演示已完成' ? 'text-brand-deep' : 'text-warn'}>{entry.status}</span><strong>演示金额 ¥{entry.total}</strong></div>
          </Link>)}</div>}
        <Link to="/solutions" className="inline-flex text-[12px] font-medium text-brand-deep">继续逛健康方案 →</Link>
      </> : view === 'order' && order ? <>
        <OrderSummary order={order} />
        <p className="card p-4 text-[13px] text-ink">订单状态：<strong className="text-brand-deep">{order.status}</strong>{order.completedAt && <span className="mt-1 block text-[11px] text-muted">完成于 {order.completedAt.slice(0, 16).replace('T', ' ')}</span>}</p>
        {order.status === '待模拟付款' && <Link to={'/solutions?view=payment&order=' + encodeURIComponent(order.id)} className="block rounded-xl bg-brand p-3 text-center text-[13px] font-medium text-white">继续模拟付款</Link>}
        <p className="text-[11px] text-muted">订单仅保存在当前浏览器，不代表真实支付、开通或发货。</p>
      </> : view === 'payment' && order ? <>
        <OrderSummary order={order} />
        <section className="card p-4"><p className="text-[13px] font-medium text-ink">模拟付款</p><p className="mt-2 text-[12px] leading-relaxed text-ink-soft">点击下方按钮只会把本机演示订单标记为完成。不会打开支付平台、扣款或生成真实交易。</p></section>
        {order.status === '待模拟付款' ? <button type="button" onClick={finishOrder} className="w-full rounded-xl bg-brand p-3 text-[13px] font-medium text-white">确认模拟付款 · ¥{order.total}</button>
          : <Link to={'/solutions?view=success&order=' + encodeURIComponent(order.id)} className="block rounded-xl bg-brand p-3 text-center text-[13px] font-medium text-white">查看完成结果</Link>}
      </> : view === 'success' && order?.status === '演示已完成' ? <>
        <section className="card p-6 text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-soft text-[28px] text-brand-deep">✓</span><h1 className="mt-3 text-[19px] font-semibold text-ink">模拟订单已完成</h1><p className="mt-2 text-[12px] text-ink-soft">这是本机演示，不会扣款、发货或开通服务。</p></section>
        <OrderSummary order={order} />
        <Link to={'/solutions?view=order&order=' + encodeURIComponent(order.id)} className="block rounded-xl bg-brand p-3 text-center text-[13px] font-medium text-white">查看订单详情</Link>
        <Link to="/solutions" className="block text-center text-[12px] text-brand-deep">返回健康方案</Link>
      </> : item && !view && step === 'checkout' ? <>
        <section className="card p-4"><p className="text-[11px] text-muted">商品信息</p><p className="mt-2 text-[15px] font-semibold text-ink">{item.name}</p><p className="mt-1 text-[12px] text-ink-soft">{item.kind} · 数量 {checkoutQuantity}</p></section>
        <section className="card p-4"><div className="flex justify-between text-[13px]"><span>演示单价</span><span>¥{item.demoPrice}</span></div><div className="mt-2 flex justify-between text-[13px]"><span>数量</span><span>× {checkoutQuantity}</span></div><div className="mt-3 flex justify-between border-t border-line-soft pt-3 text-[15px] font-semibold"><span>演示合计</span><span className="text-brand-deep">¥{item.demoPrice * checkoutQuantity}</span></div></section>
        <section className="card p-4"><p className="text-[13px] font-medium">交付与付款</p><p className="mt-2 text-[12px] leading-relaxed text-ink-soft">仅演示下单和付款状态，不填写地址，也不会收款、发货或开通服务。</p></section>
        <button type="button" onClick={placeOrder} className="w-full rounded-xl bg-brand p-3 text-[13px] font-medium text-white">提交模拟订单</button>
      </> : item && !view ? <>
        <article className="overflow-hidden rounded-2xl border border-line bg-surface"><OfferVisual kind={item.kind} large /><div className="p-4"><p className="text-[11px] text-brand-deep">{item.kind} · 模拟项目</p><h1 className="mt-1 text-[19px] font-semibold text-ink">{item.name}</h1><p className="mt-2 text-[17px] font-semibold text-brand-deep">¥{item.demoPrice} <span className="text-[11px] font-normal text-muted">演示金额</span></p></div></article>
        <section className="card p-4"><p className="text-[13px] font-medium">项目说明</p><p className="mt-2 text-[12px] leading-relaxed text-ink-soft">这是用于体验商城流程的名称与分类，尚无真实供应商、商品详情或功效核验。选择项目不代表小满判断它适合你。</p>{item.kind === '营养食品' && <p className="mt-2 text-[11px] text-warn">营养食品的配方和适宜人群尚未核对，请勿据此决定实际使用。</p>}</section>
        <section className="card flex items-center justify-between p-4"><span className="text-[13px]">数量</span><div className="flex items-center gap-3"><button type="button" aria-label="减少数量" disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)} className="flex size-8 items-center justify-center rounded-lg border border-line disabled:opacity-40">−</button><span className="w-4 text-center text-[13px]">{quantity}</span><button type="button" aria-label="增加数量" disabled={quantity >= 9} onClick={() => setQuantity((value) => value + 1)} className="flex size-8 items-center justify-center rounded-lg border border-line disabled:opacity-40">+</button></div></section>
        <Link to={'/solutions?item=' + item.id + '&step=checkout&qty=' + quantity} className="block rounded-xl bg-brand p-3 text-center text-[13px] font-medium text-white">去确认订单 · 演示金额 ¥{item.demoPrice * quantity}</Link>
        <Link to="/agent" className="block text-center text-[12px] text-brand-deep">先和小满聊聊这个目标</Link>
      </> : !item && !view ? <>
        <section className="status-hero p-5 text-white"><p className="text-[11px] text-white/75">当前关注 · {selected ? '你选择的主题' : '首批入睡场景'}</p><h1 className="mt-1.5 text-[20px] font-semibold">{requestedTopic ? topicLabels[requestedTopic] : signal?.label ?? '从一个日常目标开始'}</h1><p className="mt-2 text-[12px] leading-relaxed text-white/85">{focus.step}</p><Link to="/agent" className="mt-4 inline-flex items-center rounded-lg bg-white px-3 py-2 text-[12px] font-semibold text-brand-deep">和小满聊聊 <IconChevronRight className="ml-1 size-4" /></Link></section>
        {currentAction && <section className="rounded-xl border border-brand/20 bg-brand-soft/45 px-4 py-3"><p className="text-[11px] font-medium text-brand-deep">正在执行的行动</p><p className="mt-1 text-[12px] text-ink">{currentAction.text}</p></section>}
        <section aria-label="浏览健康方案"><SectionTitle title="逛逛健康方案" hint="模拟商品与服务" />
          <label className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5"><span aria-hidden="true" className="text-[16px] text-muted">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} type="search" aria-label="搜索方案项目" placeholder="搜索课程、设备、健康用品…" className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted" /></label>
          <nav aria-label="方案分类" className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1"><Link to="/solutions?topic=all" aria-current={!requestedTopic ? 'page' : undefined} className={'shrink-0 rounded-full px-3.5 py-1.5 text-[12px] ' + (!requestedTopic ? 'bg-brand text-white' : 'border border-line bg-surface text-ink-soft')}>全部</Link>{solutionTopics.map((topic) => <Link key={topic} to={'/solutions?topic=' + topic} aria-current={requestedTopic === topic ? 'page' : undefined} className={'shrink-0 rounded-full px-3.5 py-1.5 text-[12px] ' + (requestedTopic === topic ? 'bg-brand text-white' : 'border border-line bg-surface text-ink-soft')}>{topicLabels[topic]}</Link>)}</nav>
          <p className="mb-3 text-[11px] text-muted">{requestedTopic ? topicLabels[requestedTopic] : '全部项目'} · {offers.length} 项</p>
          {offers.length > 0 ? <div className="grid grid-cols-2 gap-3">{offers.map((offer: Offer) => <Link key={offer.id} to={'/solutions?item=' + offer.id} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"><OfferVisual kind={offer.kind} /><div className="min-h-35 p-3"><p className="text-[10px] font-medium text-brand-deep">{offer.kind} · 模拟项目</p><h2 className="mt-1.5 text-[13px] font-semibold leading-snug text-ink">{offer.name}</h2><p className="mt-2 text-[14px] font-semibold text-brand-deep">¥{offer.demoPrice} <span className="text-[10px] font-normal text-muted">演示</span></p>{signal && relatedNames.has(offer.name) && <p className="mt-1 text-[10px] text-muted">{personal.signals.length > 0 ? '与当前记录相关' : '与模拟关注相关'}</p>}</div></Link>)}</div> : <p className="card p-4 text-[12px] text-ink-soft">没有找到相关项目，试试其他关键词或分类。</p>}
          <p className="mt-3 text-[11px] leading-relaxed text-muted">所有名称和金额均为演示，不代表真实销售。营养食品未核对配方及适宜人群；项目不能替代必要的专业评估。</p>
        </section>
        <details className="card p-4"><summary className="cursor-pointer text-[13px] font-medium text-ink">方案怎样持续跟进</summary><ol className="mt-3 space-y-2 text-[12px] text-ink-soft"><li>1. 小满发现并与你确认变化</li><li>2. 一起确定一项可执行的行动</li><li>3. 需要时了解课程、服务、设备或非药品健康用品</li><li>4. 记录执行结果，到期回访并调整</li></ol></details>
      </> : <section className="card p-4"><p className="text-[13px] text-ink">未找到这个演示项目或订单。</p><Link to="/solutions" className="mt-2 inline-flex text-[12px] text-brand-deep">返回健康方案 →</Link></section>}
      {error && <p role="alert" className="rounded-lg bg-danger/5 p-3 text-[12px] text-danger">{error}</p>}
    </div>
  </>
}
