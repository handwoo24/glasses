// 기관 고르기(/orgs) · 기관 페이지(/orgs/{코드}) · 사업 목록(/programs)이 읽는 것. 서버에서만.
// 기관 레지스트리, 사업 카드(정체성 필드만), 재정 문서, 게시 요약은 목록 스냅샷(snapshot.server.ts)에서 받는다.
import { CENTRAL_TYPES } from '#/pipeline/schemas'
import type { BudgetDoc, Org } from '#/pipeline/schemas'
import type { ReportSummary } from '#/features/reports/summary'
import { byOrgOrder, listedReport } from '../list'
import type { ListedReport } from '../list'
import type { DirectoryData } from '../snapshot'
import { orgCatalog } from './catalog.server'
import type { OrgCatalog } from './catalog.server'
import { directoryData } from './snapshot.server'

/** 기관 목록 한 칸 */
export interface DirOrg {
  id: string
  name: string
  type: Org['type']
  parent?: string
  region?: string
  /** 평가 대상 사업 카드 수 */
  cards: number
  /** 게시한 리포트 수 (사업 + 재정 문서) */
  published: number
}

export interface BudgetEntry {
  id: string
  doc: BudgetDoc
  summary: ReportSummary | null
}

export interface OrgPage {
  org: DirOrg & Pick<Org, 'lafCd' | 'sourceHosts'>
  parent: DirOrg | null
  children: Array<DirOrg>
  /** 같은 상급 기관 아래 다른 기관 수 */
  siblings: number
  catalog: OrgCatalog | null
  /** 이 기관의 게시 리포트. 부처면 그 부처가 맡은 국고보조사업의 지역 리포트도 */
  reports: Array<ListedReport>
  budgets: Array<BudgetEntry>
}

type Card = DirectoryData['cards'][number]

function indexed(data: DirectoryData) {
  return {
    orgs: new Map(data.orgs.map((o) => [o.id, o.org] as const)),
    cards: new Map(data.cards.map((c) => [c.id, c] as const)),
    budgetDocs: data.budgetDocs,
    summaries: data.summaries,
  }
}
type Snapshot = ReturnType<typeof indexed>

/** 스냅샷이 바뀔 때만 찾기용 표를 다시 만든다 */
const byData = new WeakMap<DirectoryData, Snapshot>()

async function snapshot(): Promise<Snapshot> {
  const data = await directoryData()
  const hit = byData.get(data)
  if (hit) return hit
  const made = indexed(data)
  byData.set(data, made)
  return made
}

/** 분야 이름의 가운뎃점은 출처마다 다르다(산업ㆍ중소기업 / 산업·중소기업). 한 글자로 맞춘다 */
const sectorOf = (card: Card | undefined) =>
  card?.field?.sector.replaceAll('ㆍ', '·')

const PROGRAM = /^programs\/([^/]+)$/
const BUDGET = /^orgs\/([^/]+)\/budgets\/[^/]+$/

const isMinistry = (all: Snapshot, org: string | undefined) =>
  org !== undefined &&
  CENTRAL_TYPES.has(all.orgs.get(org)?.type ?? '광역자치단체')

/** 게시 요약 → 목록 한 줄. 평가 대상을 모르는 옛 게시 문서는 뺀다 */
function toListed(all: Snapshot, s: ReportSummary): Array<ListedReport> {
  const program = s.subject?.match(PROGRAM)
  if (program) {
    const card = all.cards.get(program[1])
    if (!card) return []
    const org = all.orgs.get(card.org)
    const national = card.nationalProgram
      ? all.cards.get(card.nationalProgram.replace(/^programs\//, ''))
      : undefined
    const ministries = [
      ...(isMinistry(all, card.org) ? [card.org] : []),
      ...(national && isMinistry(all, national.org) ? [national.org] : []),
    ]
    return [
      listedReport(s, {
        kind: 'program',
        org: card.org,
        orgName: org?.name ?? card.org,
        region: card.region ?? org?.region,
        ministries,
        sector: sectorOf(card),
      }),
    ]
  }
  const budget = s.subject?.match(BUDGET)
  if (budget) {
    const org = all.orgs.get(budget[1])
    return [
      listedReport(s, {
        kind: 'budget',
        org: budget[1],
        orgName: org?.name ?? budget[1],
        region: org?.region,
        ministries: isMinistry(all, budget[1]) ? [budget[1]] : [],
      }),
    ]
  }
  return []
}

function listedAll(all: Snapshot): Array<ListedReport> {
  return all.summaries.flatMap((s) => toListed(all, s))
}

function dirOrgs(all: Snapshot, listed: ReadonlyArray<ListedReport>) {
  const cards = new Map<string, number>()
  for (const c of all.cards.values())
    cards.set(c.org, (cards.get(c.org) ?? 0) + 1)
  const published = new Map<string, number>()
  for (const r of listed) published.set(r.org, (published.get(r.org) ?? 0) + 1)
  return [...all.orgs]
    .map(([id, o]): DirOrg => ({
      id,
      name: o.name,
      type: o.type,
      parent: o.parent,
      region: o.region,
      cards: cards.get(id) ?? 0,
      published: published.get(id) ?? 0,
    }))
    .sort(byOrgOrder)
}

export interface Directory {
  orgs: Array<DirOrg>
  reports: Array<ListedReport>
  /** 목록에 나오는 분야 (사업 카드 기준) */
  sectors: Array<string>
}

/** 기관 레지스트리 전체와 게시 리포트 목록 */
export async function readDirectory(): Promise<Directory> {
  const all = await snapshot()
  const reports = listedAll(all)
  const sectors = [
    ...new Set(
      [...all.cards.values()].flatMap((c) => {
        const sector = sectorOf(c)
        return sector ? [sector] : []
      }),
    ),
  ].sort((a, b) => a.localeCompare(b))
  return { orgs: dirOrgs(all, reports), reports, sectors }
}

/** 기관 하나. 레지스트리에 없으면 null */
export async function readOrgPage(orgId: string): Promise<OrgPage | null> {
  const all = await snapshot()
  const registry = all.orgs.get(orgId)
  if (!registry) return null
  const catalog = await orgCatalog(orgId)
  const listed = listedAll(all)
  const orgs = dirOrgs(all, listed)
  const self = orgs.find((o) => o.id === orgId)
  if (!self) return null
  const reports = listed.filter(
    (r) => r.org === orgId || r.ministries.includes(orgId),
  )
  const bySubject = new Map(
    all.summaries.flatMap((s) => (s.subject ? [[s.subject, s] as const] : [])),
  )
  const budgets = all.budgetDocs
    .filter((b) => b.org === orgId)
    .map((b): BudgetEntry => ({
      id: b.id,
      doc: b.doc,
      summary: bySubject.get(`orgs/${orgId}/budgets/${b.id}`) ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
  return {
    org: { ...self, lafCd: registry.lafCd, sourceHosts: registry.sourceHosts },
    parent: orgs.find((o) => o.id === registry.parent) ?? null,
    children: orgs.filter((o) => o.parent === orgId),
    siblings: registry.parent
      ? orgs.filter((o) => o.parent === registry.parent && o.id !== orgId)
          .length
      : 0,
    catalog,
    reports,
    budgets,
  }
}
