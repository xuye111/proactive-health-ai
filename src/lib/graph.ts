import data from '../data/graph.json'

/**
 * 知识图谱（方案 §25 的 MVP 边界：不做完整图推理）。
 *
 * 这里呈现的是「知识条目与记忆里的实体关系」，按选中实体做局部邻域视图；
 * 完整的图路径检索属于第四阶段，页面上如实标注。
 */

export type EntityType = 'metric' | 'behavior' | 'event' | 'state' | 'signal' | 'concept' | 'goal'

export interface GraphEntity {
  id: string
  name: string
  type: EntityType
}

export interface GraphRelation {
  from: string
  label: string
  to: string
  /** 这条关系来自哪一层：知识条目 / 趋势判断 / 长期记忆 / 计划。 */
  source: string
}

export const ENTITIES: GraphEntity[] = data.entities as GraphEntity[]
export const RELATIONS: GraphRelation[] = data.relations as GraphRelation[]

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  metric: '指标',
  behavior: '行为',
  event: '事件',
  state: '状态',
  signal: '信号',
  concept: '概念',
  goal: '目标',
}

export const ENTITY_TYPE_COLOR: Record<EntityType, string> = {
  metric: 'var(--color-sleep)',
  behavior: 'var(--color-activity)',
  event: 'var(--color-mind)',
  state: 'var(--color-warn)',
  signal: 'var(--color-danger)',
  concept: 'var(--color-muted)',
  goal: 'var(--color-brand)',
}

export interface Neighbor {
  relation: GraphRelation
  entity: GraphEntity
  /** out = 从当前实体指出；in = 指向当前实体。 */
  direction: 'out' | 'in'
}

const byId = new Map(ENTITIES.map((entity) => [entity.id, entity]))

export const entityById = (id: string): GraphEntity | undefined => byId.get(id)

/** 一个实体的局部邻域，按关系表推导。 */
export function neighborsOf(id: string): Neighbor[] {
  const neighbors: Neighbor[] = []
  for (const relation of RELATIONS) {
    if (relation.from === id) {
      const entity = byId.get(relation.to)
      if (entity !== undefined) neighbors.push({ relation, entity, direction: 'out' })
    }
    if (relation.to === id) {
      const entity = byId.get(relation.from)
      if (entity !== undefined) neighbors.push({ relation, entity, direction: 'in' })
    }
  }
  return neighbors
}

/** 连接度最高的实体，作为图谱页的默认选中项。 */
export function defaultEntityId(): string {
  let best = ENTITIES[0]?.id ?? ''
  let bestCount = -1
  for (const entity of ENTITIES) {
    const count = neighborsOf(entity.id).length
    if (count > bestCount) {
      best = entity.id
      bestCount = count
    }
  }
  return best
}
