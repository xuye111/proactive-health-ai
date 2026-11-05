import type { GoutActivityPoint } from '../ai/goutActivity'

export function GoutActivityTrend({ points }: { points: readonly GoutActivityPoint[] }) {
  const baseline = points[0]
  const latest = points.at(-1)
  if (!baseline || !latest) return null

  const width = 300
  const height = 76
  const inset = 6
  const ceiling = Math.max(1, ...points.map(({ score }) => Math.ceil(score)))
  const dayTimes = points.map(({ assessedOn }) => Date.parse(assessedOn))
  const timeSpan = dayTimes[dayTimes.length - 1] - dayTimes[0]
  const coordinates = points.map(({ score }, index) => {
    const progress = timeSpan ? (dayTimes[index] - dayTimes[0]) / timeSpan : index / Math.max(1, points.length - 1)
    return {
      x: inset + progress * (width - 2 * inset),
      y: height - inset - score / ceiling * (height - 2 * inset),
    }
  })

  return <figure className="mt-4 rounded-2xl bg-white/10 p-3">
    {points.length > 1 && <svg viewBox={`0 0 ${width} ${height}`} className="h-[76px] w-full" role="img"
      aria-label={`活动度从基线 ${baseline.score.toFixed(2)} 到最近 ${latest.score.toFixed(2)}`}>
      <line x1={inset} x2={width - inset} y1={height - inset} y2={height - inset}
        stroke="currentColor" opacity=".2" strokeDasharray="4 4" />
      <polyline points={coordinates.map(({ x, y }) => `${x},${y}`).join(' ')}
        fill="none" stroke="#a7f3d0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {coordinates.map(({ x, y }, index) => <circle key={index} cx={x} cy={y} r="4" fill="#a7f3d0" />)}
    </svg>}
    <figcaption className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[12px] text-white/90">
      <span>活动度基线 {baseline.score.toFixed(2)} · {baseline.assessedOn}</span>
      {points.length > 1 && <span>最近 {latest.assessedOn}</span>}
    </figcaption>
  </figure>
}
