// 사업 목록 화면의 필터·정렬·부서별 묶음. 주소의 검색 조건(?dept=&stage=&sort=)으로 정한다.
import { z } from 'zod'
import type { WorkItem } from './server/worklist.server'
import { WORK_STAGES } from './stage'
import type { WorkStage } from './stage'

export const SORTS = {
  priority: '우선순위 높은 순',
  budget: '예산 큰 순',
  rate: '집행률 낮은 순',
  recent: '진행 많이 된 순',
} as const
export type Sort = keyof typeof SORTS

/** 단계 필터는 낱단계 말고 ‘작업 중’ 묶음도 받는다 */
export const STAGE_FILTERS = [
  '대기',
  '작업 중',
  '고침',
  '게시 대기',
  '게시',
] as const

export const WorklistSearchSchema = z.object({
  dept: z.string().min(1).optional().catch(undefined),
  /** 게시된 사업 아래 업체 줄: 펼침(기본)·접음 */
  vendors: z.enum(['open', 'closed']).optional().catch(undefined),
  /** 업체 작업이 남은 사업만: 목록화가 남았거나 게시 전 업체가 있는 사업 */
  vendorWork: z.boolean().optional().catch(undefined),
  stage: z.enum(STAGE_FILTERS).optional().catch(undefined),
  sort: z
    .enum(Object.keys(SORTS) as [Sort, ...Array<Sort>])
    .optional()
    .catch(undefined),
})
export type WorklistSearch = z.infer<typeof WorklistSearchSchema>

/** 부서를 모르는 사업을 고르는 필터 값 */
export const NO_DEPT = '부서 확인 전'

export type StageTone = 'wait' | 'work' | 'fix' | 'done'

export function stageTone(stage: WorkStage): StageTone {
  if (stage === '대기') return 'wait'
  if (stage === '고침') return 'fix'
  if (stage === '게시 대기' || stage === '게시') return 'done'
  return 'work'
}

function inStage(item: WorkItem, stage: WorklistSearch['stage']): boolean {
  if (!stage) return true
  if (stage === '작업 중') return stageTone(item.stage) === 'work'
  return item.stage === stage
}

function inDept(item: WorkItem, dept: string | undefined): boolean {
  if (!dept) return true
  return dept === NO_DEPT
    ? item.departments.length === 0
    : item.departments.includes(dept)
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const

/** 집행률 (예산이 없으면 null) */
export function spentRate(item: WorkItem): number | null {
  return item.budget && item.budget.amount > 0
    ? item.budget.spent / item.budget.amount
    : null
}

const byBudget = (a: WorkItem, b: WorkItem) =>
  (b.budget?.amount ?? 0) - (a.budget?.amount ?? 0)

const COMPARE: Record<Sort, (a: WorkItem, b: WorkItem) => number> = {
  // 게시한 사업을 앞에 두고, 그다음 우선순위 · 예산
  priority: (a, b) =>
    Number(b.stage === '게시') - Number(a.stage === '게시') ||
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    byBudget(a, b),
  budget: byBudget,
  rate: (a, b) => (spentRate(a) ?? 2) - (spentRate(b) ?? 2) || byBudget(a, b),
  recent: (a, b) =>
    WORK_STAGES.indexOf(b.stage) - WORK_STAGES.indexOf(a.stage) ||
    (b.latestReport ?? '').localeCompare(a.latestReport ?? '') ||
    byBudget(a, b),
}

/** 게시된 사업인데 업체 목록화를 하지 않았다 */
function needsListing(item: WorkItem): boolean {
  return item.stage === '게시' && !item.vendorsListedAt
}

function hasVendorWork(item: WorkItem): boolean {
  return needsListing(item) || item.vendors.some((v) => v.stage !== '게시')
}

/** 부서·단계 필터를 거쳐 정렬한 목록 */
export function filterItems(
  items: ReadonlyArray<WorkItem>,
  search: WorklistSearch,
): Array<WorkItem> {
  return items
    .filter(
      (i) =>
        inDept(i, search.dept) &&
        inStage(i, search.stage) &&
        (!search.vendorWork || hasVendorWork(i)),
    )
    .sort(COMPARE[search.sort ?? 'priority'])
}

/** 단계별 사업 수 (부서 필터만 적용한 범위) */
export function stageCounts(
  items: ReadonlyArray<WorkItem>,
): Record<WorkStage, number> {
  const counts = Object.fromEntries(WORK_STAGES.map((s) => [s, 0])) as Record<
    WorkStage,
    number
  >
  for (const i of items) counts[i.stage] += 1
  return counts
}

export interface DeptGroup {
  name: string
  count: number
  amount: number
  stages: Record<WorkStage, number>
}

/** 부서별 묶음: 사업이 많은 부서 순, 같으면 예산 큰 순. 부서를 모르는 사업은 따로 센다 */
export function deptGroups(items: ReadonlyArray<WorkItem>): {
  groups: Array<DeptGroup>
  unknown: number
} {
  const by = new Map<string, Array<WorkItem>>()
  for (const i of items)
    for (const d of i.departments) by.set(d, [...(by.get(d) ?? []), i])
  const groups = [...by].map(([name, list]) => ({
    name,
    count: list.length,
    amount: list.reduce((s, i) => s + (i.budget?.amount ?? 0), 0),
    stages: stageCounts(list),
  }))
  return {
    groups: groups.sort((a, b) => b.count - a.count || b.amount - a.amount),
    unknown: items.filter((i) => i.departments.length === 0).length,
  }
}

/** 원 → ‘450억’ · ‘3.2억’ · ‘4,500만’ */
export function eok(won: number): string {
  const v = won / 1e8
  if (v >= 10) return `${Math.round(v).toLocaleString('ko-KR')}억`
  if (v >= 1) return `${v.toFixed(1).replace(/\.0$/, '')}억`
  return `${Math.round(won / 1e4).toLocaleString('ko-KR')}만`
}

export interface VendorStats {
  /** 업체 카드 수 */
  cards: number
  published: number
  fix: number
  /** 수집·분석·작성·검증·게시 대기 */
  working: number
  waiting: number
  /** 업체 목록화가 남은 게시 사업 이름 */
  toList: Array<string>
}

/** 업체 리포트 작업 현황 (화면 위 숫자) */
export function vendorStats(items: ReadonlyArray<WorkItem>): VendorStats {
  const vendors = items.flatMap((i) => i.vendors)
  const count = (pick: (stage: WorkStage) => boolean) =>
    vendors.filter((v) => pick(v.stage)).length
  return {
    cards: vendors.length,
    published: count((s) => s === '게시'),
    fix: count((s) => s === '고침'),
    working: count((s) => s !== '게시' && s !== '고침' && s !== '대기'),
    waiting: count((s) => s === '대기'),
    toList: items.filter(needsListing).map((i) => i.name),
  }
}
