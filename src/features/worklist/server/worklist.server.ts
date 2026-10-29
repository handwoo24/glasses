// 기관별 사업 목록과 작업 단계. 사업마다 따로 읽지 않고 컬렉션 그룹으로 한 번에 모아 60초 동안 나눠 쓴다.
import type { DocumentSnapshot } from 'firebase-admin/firestore'
import type { ZodType } from 'zod'
import {
  OrgSchema,
  ProgramSchema,
  PublishedSchema,
  PublishedVendorSchema,
  VendorCardSchema,
  VendorSchema,
} from '#/pipeline/schemas'
import type { Org, Vendor, VendorCard } from '#/pipeline/schemas'
import type { VendorSummary } from '#/features/vendors/summary'
import { db } from '#/pipeline/store'
import {
  memo,
  publishedSummaries,
} from '#/features/reports/server/report-docs.server'
import type { ReportSummary } from '#/features/reports/summary'
import {
  linesByCode,
  orgCatalog,
} from '#/features/directory/server/catalog.server'
import { vendorVerdict } from '#/features/vendors/list'
import type { Engagement, VendorListItem } from '#/features/vendors/list'
import { stageOf } from '../stage'
import type { WorkStage, SubjectProgress } from '../stage'

export interface WorkItem {
  id: string
  name: string
  departments: ReadonlyArray<string>
  sector?: string
  priority: 'high' | 'medium' | 'low'
  priorityWhy: string
  /** 가장 최근 회계연도의 예산현액·지출액 합 (원). 세부사업이 없으면 null */
  budget: { year: number; amount: number; spent: number } | null
  stage: WorkStage
  materials: number
  facts: number
  absences: number
  latestReport: string | null
  /** 게시한 사업의 홈·목록용 요약 */
  summary: ReportSummary | null
  /** 업체 루프가 이 사업의 참여 업체를 목록화한 날 */
  vendorsListedAt: string | null
  /** 이 사업의 업체 카드 (금액 큰 순) */
  vendors: Array<VendorWork>
}

/** 사업 줄 아래 업체 줄 하나 */
export interface VendorWork {
  bizno: string
  name: string
  role: string
  /** 이 사업 안 계약 금액 합계(원) */
  amount: number
  stage: WorkStage
  /** 게시한 업체 리포트의 요약과 주소 */
  summary: VendorSummary | null
  /** 같은 사업자등록번호가 업체 카드로 있는 사업 수 (이 사업 포함) */
  programs: number
}

export interface OrgWorklist {
  org: Pick<Org, 'name' | 'type' | 'parent'> & {
    id: string
    parentName?: string
  }
  /** 예산 카탈로그의 세부사업 수와 기준일 (가장 최근 회계연도) */
  catalog: { year: number; lines: number; asOf: string } | null
  items: Array<WorkItem>
}

type Budget = NonNullable<WorkItem['budget']>

/** 하위 컬렉션 문서 → 그 문서가 속한 평가 대상 경로 */
function subjectOf(doc: DocumentSnapshot): string | undefined {
  return doc.ref.parent.parent?.path
}

function group<T>(
  docs: ReadonlyArray<DocumentSnapshot>,
  pick: (d: DocumentSnapshot) => T,
): Map<string, Array<T>> {
  const out = new Map<string, Array<T>>()
  for (const d of docs) {
    const s = subjectOf(d)
    if (s) out.set(s, [...(out.get(s) ?? []), pick(d)])
  }
  return out
}

/**
 * 양식이 맞지 않는 문서 하나가 모든 기관의 목록을 막지 않게 건너뛴다.
 * 쓰기는 파이프라인 도구가 양식을 검사하므로 여기서 걸리는 것은 손으로 고친 문서뿐이다
 */
function parsed<T>(schema: ZodType<T>, d: DocumentSnapshot): Array<T> {
  const r = schema.safeParse(d.data())
  if (r.success) return [r.data]
  console.warn(`[worklist] 양식이 맞지 않아 건너뜀: ${d.ref.path}`)
  return []
}

async function readAll() {
  const store = db()
  const [
    orgs,
    programs,
    materials,
    facts,
    absences,
    reports,
    reviews,
    published,
    vendorCards,
    publishedVendors,
    vendorRegistry,
  ] = await Promise.all([
    store.collection('orgs').get(),
    store.collection('programs').get(),
    store.collection('materials').select('subjects').get(),
    store.collectionGroup('facts').select().get(),
    store.collectionGroup('absences').select().get(),
    store.collectionGroup('reports').select('status', 'updatedAt').get(),
    store
      .collectionGroup('reviews')
      .select('report', 'verdict', 'reviewedAt')
      .get(),
    store.collection('published').get(),
    // 사업 아래 업체 카드. 같은 이름의 최상위 레지스트리(vendors/{번호})는 아래에서 뺀다
    store.collectionGroup('vendors').get(),
    store.collection('publishedVendors').get(),
    store.collection('vendors').get(),
  ])
  const cards = programs.docs.flatMap((d) =>
    parsed(ProgramSchema, d).map((p) => ({ id: d.id, ...p })),
  )
  // 카탈로그는 전체를 읽지 않고 사업 카드가 가리키는 세부사업만
  const lines = await linesByCode(cards.flatMap((p) => p.budgetLines))
  const materialCount = new Map<string, number>()
  for (const d of materials.docs)
    for (const s of (d.get('subjects') as Array<string> | undefined) ?? [])
      materialCount.set(s, (materialCount.get(s) ?? 0) + 1)
  return {
    orgs: new Map(
      orgs.docs.flatMap((d) =>
        parsed(OrgSchema, d).map((o) => [d.id, o] as const),
      ),
    ),
    programs: cards,
    lines,
    materialCount,
    facts: group(facts.docs, () => 1),
    absences: group(absences.docs, () => 1),
    reports: group(reports.docs, (d) => ({
      asOf: d.id,
      status: d.get('status') as SubjectProgress['reports'][number]['status'],
      updatedAt: String(d.get('updatedAt')),
    })),
    reviews: group(reviews.docs, (d) => ({
      report: String(d.get('report')),
      verdict: d.get('verdict') as 'pass' | 'fail',
      reviewedAt: String(d.get('reviewedAt')),
    })),
    published: new Set(
      published.docs.flatMap((d) =>
        parsed(PublishedSchema, d).map((p) => p.subject),
      ),
    ),
    vendorCards: vendorCards.docs
      .filter((d) => d.ref.parent.parent !== null)
      .flatMap((d) =>
        parsed(VendorCardSchema, d).map((card) => ({
          program: d.ref.parent.parent?.path ?? '',
          bizno: d.id,
          card,
        })),
      ),
    publishedVendors: new Map(
      publishedVendors.docs.flatMap((d) =>
        parsed(PublishedVendorSchema, d).map(
          (p) =>
            [p.subject, { slug: d.id, summary: p.summary ?? null }] as const,
        ),
      ),
    ),
    vendorRegistry: new Map(
      vendorRegistry.docs.flatMap((d) =>
        parsed(VendorSchema, d).map((v) => [d.id, v] as const),
      ),
    ),
  }
}

type Snapshot = Awaited<ReturnType<typeof readAll>>

/** 평가 대상 하나의 작업 진행 (사업·업체 공통) */
function progressOf(all: Snapshot, path: string): SubjectProgress {
  return {
    materials: all.materialCount.get(path) ?? 0,
    facts: all.facts.get(path)?.length ?? 0,
    absences: all.absences.get(path)?.length ?? 0,
    reports: all.reports.get(path) ?? [],
    reviews: all.reviews.get(path) ?? [],
    published: all.published.has(path) || all.publishedVendors.has(path),
  }
}

/** 사업의 업체 줄 */
function vendorsOf(all: Snapshot, program: string): Array<VendorWork> {
  return all.vendorCards
    .filter((v) => v.program === program)
    .map(({ bizno, card }) => {
      const path = `${program}/vendors/${bizno}`
      return {
        bizno,
        name: card.name,
        role: card.role,
        amount: card.contracts.reduce((s, c) => s + c.amount, 0),
        stage: stageOf(progressOf(all, path)),
        summary: all.publishedVendors.get(path)?.summary ?? null,
        programs: all.vendorCards.filter((x) => x.bizno === bizno).length,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

const snapshot = memo(readAll)

/** 세부사업 코드 → 가장 최근 회계연도의 금액 */
function latestBudgets(
  lines: ReadonlyArray<{
    code: string
    year: number
    amounts: Record<string, number>
  }>,
) {
  const out = new Map<string, Budget>()
  for (const l of lines) {
    const prev = out.get(l.code)
    if (prev && prev.year >= l.year) continue
    out.set(l.code, {
      year: l.year,
      amount: l.amounts['예산현액'] ?? 0,
      spent: l.amounts['지출액'] ?? 0,
    })
  }
  return out
}

function sumBudget(
  codes: ReadonlyArray<string>,
  budgets: Map<string, Budget>,
): WorkItem['budget'] {
  const found = codes.flatMap((c) => budgets.get(c) ?? [])
  if (!found.length) return null
  const year = Math.max(...found.map((b) => b.year))
  const same = found.filter((b) => b.year === year)
  return {
    year,
    amount: same.reduce((s, b) => s + b.amount, 0),
    spent: same.reduce((s, b) => s + b.spent, 0),
  }
}

/** 기관 하나의 사업 카드와 각 사업의 작업 단계. 기관이 레지스트리에 없으면 null */
export async function readOrgWorklist(
  orgId: string,
): Promise<OrgWorklist | null> {
  const [all, summaries] = await Promise.all([snapshot(), publishedSummaries()])
  const org = all.orgs.get(orgId)
  if (!org) return null
  const catalog = await orgCatalog(orgId)
  const orgLines = all.lines.filter((l) => l.org === orgId)
  const budgets = latestBudgets(orgLines)
  const bySubject = new Map(
    summaries.flatMap((s) => (s.subject ? [[s.subject, s] as const] : [])),
  )

  const items = all.programs
    .filter((p) => p.org === orgId)
    .map((p): WorkItem => {
      const path = `programs/${p.id}`
      const progress = progressOf(all, path)
      const latest = progress.reports
        .map((r) => r.asOf)
        .sort()
        .at(-1)
      return {
        id: p.id,
        name: p.name,
        departments: p.departments,
        sector: p.field?.sector,
        priority: p.priority.score,
        priorityWhy: p.priority.why,
        budget: sumBudget(p.budgetLines, budgets),
        stage: stageOf(progress),
        materials: progress.materials,
        facts: progress.facts,
        absences: progress.absences,
        latestReport: latest ?? null,
        summary: bySubject.get(path) ?? null,
        vendorsListedAt: p.vendorsListedAt ?? null,
        vendors: vendorsOf(all, path),
      }
    })
  return {
    org: {
      id: orgId,
      name: org.name,
      type: org.type,
      parent: org.parent,
      parentName: org.parent ? all.orgs.get(org.parent)?.name : undefined,
    },
    catalog: catalog && {
      year: catalog.year,
      lines: catalog.lines,
      asOf: catalog.asOf,
    },
    items,
  }
}

/** 업체 페이지: 업체 하나가 평가 대상 사업에서 맡은 일 */
export interface VendorPage {
  bizno: string
  registry: Vendor | null
  /** 사업마다 하나. 게시된 리포트 먼저, 그다음 금액 큰 순 */
  engagements: Array<{
    program: string
    programName: string
    orgName: string
    /** 업체 카드의 법인명 */
    name: string
    departments: ReadonlyArray<string>
    role: string
    contracts: VendorCard['contracts']
    amount: number
    stage: WorkStage
    summary: VendorSummary | null
  }>
}

/** 사업자등록번호 하나의 업체 페이지. 업체 카드가 하나도 없으면 null */
export async function readVendorPage(
  bizno: string,
): Promise<VendorPage | null> {
  const all = await snapshot()
  const cards = all.vendorCards.filter((v) => v.bizno === bizno)
  if (!cards.length) return null
  const programs = new Map(all.programs.map((p) => [`programs/${p.id}`, p]))
  const engagements = cards
    .map(({ program, card }) => {
      const p = programs.get(program)
      const path = `${program}/vendors/${bizno}`
      return {
        program,
        programName: p?.name ?? program,
        name: card.name,
        orgName: (p && all.orgs.get(p.org)?.name) ?? '',
        departments: p?.departments ?? [],
        role: card.role,
        contracts: card.contracts,
        amount: card.contracts.reduce((s, c) => s + c.amount, 0),
        stage: stageOf(progressOf(all, path)),
        summary: all.publishedVendors.get(path)?.summary ?? null,
      }
    })
    .sort(
      (a, b) =>
        Number(b.summary !== null) - Number(a.summary !== null) ||
        b.amount - a.amount,
    )
  return {
    bizno,
    registry: all.vendorRegistry.get(bizno) ?? null,
    engagements,
  }
}

/** 용역 탭: 평가 대상 사업에 업체 카드가 있는 업체 전체. 사업자등록번호 하나가 한 줄 */
export async function readVendorList(): Promise<{
  items: Array<VendorListItem>
  orgs: Array<{ id: string; name: string; region?: string }>
}> {
  const all = await snapshot()
  const programs = new Map(all.programs.map((p) => [`programs/${p.id}`, p]))
  const byBizno = new Map<string, Array<Engagement>>()
  const names = new Map<string, string>()
  for (const { program, bizno, card } of all.vendorCards) {
    const p = programs.get(program)
    const org = p ? all.orgs.get(p.org) : undefined
    const path = `${program}/vendors/${bizno}`
    const summary = all.publishedVendors.get(path)?.summary ?? null
    const e: Engagement = {
      program,
      programName: p?.name ?? program,
      org: p?.org ?? '',
      orgName: org?.name ?? '',
      region: p?.region ?? org?.region,
      role: card.role,
      amount: card.contracts.reduce((s, c) => s + c.amount, 0),
      contracts: card.contracts.length,
      stage: stageOf(progressOf(all, path)),
      summary,
      verdict: summary ? vendorVerdict(summary) : null,
    }
    byBizno.set(bizno, [...(byBizno.get(bizno) ?? []), e])
    names.set(bizno, card.name)
  }
  const items = [...byBizno].map(([bizno, engagements]): VendorListItem => {
    const reg = all.vendorRegistry.get(bizno)
    return {
      bizno,
      name: reg?.name ?? names.get(bizno) ?? bizno,
      type: reg?.type,
      home: reg?.region,
      sanctions: reg?.sanctions,
      engagements: [...engagements].sort((a, b) => b.amount - a.amount),
      amount: engagements.reduce((s, e) => s + e.amount, 0),
    }
  })
  const orgIds = new Set(items.flatMap((v) => v.engagements.map((e) => e.org)))
  const orgs = [...orgIds].flatMap((id) => {
    const o = all.orgs.get(id)
    return o ? [{ id, name: o.name, region: o.region }] : []
  })
  return { items, orgs }
}
