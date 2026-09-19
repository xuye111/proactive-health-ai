import { useId, useState } from 'react'
import { AppBar } from '../../components/AppBar'
import { SectionTitle } from '../../components/SectionTitle'
import { StageNotice } from '../../components/StageNotice'
import {
  ENTITIES,
  ENTITY_TYPE_COLOR,
  ENTITY_TYPE_LABEL,
  RELATIONS,
  defaultEntityId,
  entityById,
  neighborsOf,
  type EntityType,
} from '../../lib/graph'

const WIDTH = 320
const HEIGHT = 250
const CENTER_X = 160
const CENTER_Y = 125
const RADIUS = 88

const TYPE_ORDER: EntityType[] = ['metric', 'behavior', 'event', 'state', 'signal', 'concept', 'goal']

const nodeName = (id: string): string => entityById(id)?.name ?? id

export default function Graph() {
  const arrowId = useId()
  const [selectedId, setSelectedId] = useState(defaultEntityId)

  const selected = entityById(selectedId)
  const neighbors = neighborsOf(selectedId)

  const positions = neighbors.map((_, index) => {
    const angle = ((-90 + (360 / Math.max(neighbors.length, 1)) * index) * Math.PI) / 180
    return { x: CENTER_X + RADIUS * Math.cos(angle), y: CENTER_Y + RADIUS * Math.sin(angle) }
  })

  const presentTypes = TYPE_ORDER.filter((type) =>
    ENTITIES.some((entity) => entity.type === type),
  )

  return (
    <>
      <AppBar title="知识图谱" subtitle="知识实体与关系 · 局部视图" backTo="/profile" />

      <div className="space-y-5 px-4 pt-4">
        <StageNotice>
          按方案 §25 的 MVP 边界，这里不做完整图推理与路径检索：图谱由知识条目与长期记忆里的实体关系构成，
          选中一个实体可以看到它的邻域。第四阶段再接入路径检索（沿关系找解释链）。
        </StageNotice>

        {/* 实体选择 */}
        <div>
          <p className="mb-2 px-1 text-[11px] text-muted">
            共 {ENTITIES.length} 个实体 · {RELATIONS.length} 条关系，点节点可继续走
          </p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {ENTITIES.map((entity) => {
              const active = entity.id === selectedId
              return (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => setSelectedId(entity.id)}
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] transition-colors ${
                    active ? 'border-brand bg-brand-soft/50 text-brand-deep' : 'border-line bg-surface text-ink-soft'
                  }`}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: ENTITY_TYPE_COLOR[entity.type] }}
                  />
                  {entity.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* 邻域视图 */}
        <section className="card p-3">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`${selected?.name ?? ''} 的关系邻域`}>
            <defs>
              <marker
                id={arrowId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="var(--color-muted)" />
              </marker>
            </defs>

            {neighbors.map((neighbor, index) => {
              const { x, y } = positions[index]
              const dx = x - CENTER_X
              const dy = y - CENTER_Y
              const length = Math.hypot(dx, dy) || 1
              const ux = dx / length
              const uy = dy / length
              const start = { x: CENTER_X + ux * 46, y: CENTER_Y + uy * 20 }
              const end = { x: x - ux * 40, y: y - uy * 18 }
              const badge = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
              return (
                <g key={`${neighbor.relation.from}-${neighbor.relation.label}-${neighbor.relation.to}`}>
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="var(--color-line)"
                    strokeWidth="1.4"
                    markerEnd={neighbor.direction === 'out' ? `url(#${arrowId})` : undefined}
                    markerStart={neighbor.direction === 'in' ? `url(#${arrowId})` : undefined}
                  />
                  <circle cx={badge.x} cy={badge.y} r="8" fill="var(--color-surface)" stroke="var(--color-line)" />
                  <text
                    x={badge.x}
                    y={badge.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="9"
                    fill="var(--color-ink-soft)"
                  >
                    {index + 1}
                  </text>
                </g>
              )
            })}

            {neighbors.map((neighbor, index) => {
              const { x, y } = positions[index]
              const color = ENTITY_TYPE_COLOR[neighbor.entity.type]
              return (
                <g
                  key={`node-${neighbor.entity.id}`}
                  onClick={() => setSelectedId(neighbor.entity.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={x - 37}
                    y={y - 15}
                    width="74"
                    height="30"
                    rx="9"
                    fill={color}
                    fillOpacity="0.12"
                    stroke={color}
                    strokeOpacity="0.45"
                  />
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="10.5"
                    fill="var(--color-ink)"
                  >
                    {neighbor.entity.name}
                  </text>
                </g>
              )
            })}

            {/* 中心实体 */}
            <rect
              x={CENTER_X - 43}
              y={CENTER_Y - 17}
              width="86"
              height="34"
              rx="10"
              fill="var(--color-brand)"
            />
            <text
              x={CENTER_X}
              y={CENTER_Y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="11.5"
              fill="#ffffff"
            >
              {selected?.name ?? ''}
            </text>
          </svg>

          <p className="px-1 pb-1 text-center text-[10px] text-muted">
            箭头表示关系方向 · 编号对应下方关系列表
          </p>
        </section>

        {/* 关系列表 */}
        <section>
          <SectionTitle title={`${selected?.name ?? ''} 的关系`} hint={`${neighbors.length} 条`} />
          <ul className="card divide-y divide-line-soft">
            {neighbors.map((neighbor, index) => (
              <li key={`list-${neighbor.entity.id}-${neighbor.relation.label}`}>
                <button
                  type="button"
                  onClick={() => setSelectedId(neighbor.entity.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-canvas text-[10px] text-ink-soft">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink">
                      {nodeName(neighbor.relation.from)}
                      <span className="mx-1.5 text-muted">→</span>
                      {nodeName(neighbor.relation.to)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      关系：{neighbor.relation.label} · 来源：{neighbor.relation.source}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {neighbors.length === 0 && (
            <p className="card px-4 py-6 text-center text-[12px] text-muted">这个实体还没有已登记的关系</p>
          )}
        </section>

        {/* 类型图例 */}
        <section>
          <SectionTitle title="实体类型" />
          <div className="card flex flex-wrap gap-x-4 gap-y-2 p-4">
            {presentTypes.map((type) => (
              <span key={type} className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                <span className="size-2.5 rounded-full" style={{ background: ENTITY_TYPE_COLOR[type] }} />
                {ENTITY_TYPE_LABEL[type]}
              </span>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
