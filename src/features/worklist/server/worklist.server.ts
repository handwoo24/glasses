// 기관별 사업 목록과 작업 단계. 사업마다 따로 읽지 않고 컬렉션 그룹으로 한 번에 모아 60초 동안 나눠 쓴다.
import type { DocumentSnapshot } from 'firebase-admin/firestore'
import type { ZodType } from 'zod'
import {
  BudgetLineSchema,
  OrgSchema,
  ProgramSchema,
  PublishedSchema,
} from '#/pipeline/schemas'
import type { Org } from '#/pipeline/schemas'
import { db } from '#/pipeline/store'
import {
  memo,
  publishedSummaries,
} from '#/features/reports/server/report-docs.server'
import type { ReportSummary } from '#/features/reports/summary'
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

const LineFields = BudgetLineSchema.pick({
  code: true,
  org: true,
  year: true,
  amounts: true,
  asOf: true,
})

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
    lines,
    materials,
    facts,
    absences,
    reports,
    reviews,
    published,
  ] = await Promise.all([
    store.collection('orgs').get(),
    store.collection('programs').get(),
    store
      .collection('budgetLines')
      .select('code', 'org', 'year', 'amounts', 'asOf')
      .get(),
    store.collection('materials').select('subjects').get(),
    store.collectionGroup('facts').select().get(),
    store.collectionGroup('absences').select().get(),
    store.collectionGroup('reports').select('status', 'updatedAt').get(),
    store
      .collectionGroup('reviews')
      .select('report', 'verdict', 'reviewedAt')
      .get(),
    store.collection('published').get(),
  ])
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
    programs: programs.docs.flatMap((d) =>
      parsed(ProgramSchema, d).map((p) => ({ id: d.id, ...p })),
    ),
    lines: lines.docs.map((d) => LineFields.parse(d.data())),
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
  }
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

function catalogOf(
  lines: ReadonlyArray<{ year: number; asOf: string }>,
): OrgWorklist['catalog'] {
  if (!lines.length) return null
  const year = Math.max(...lines.map((l) => l.year))
  const same = lines.filter((l) => l.year === year)
  return {
    year,
    lines: same.length,
    asOf:
      same
        .map((l) => l.asOf)
        .sort()
        .at(-1) ?? '',
  }
}

/** 기관 하나의 사업 카드와 각 사업의 작업 단계. 기관이 레지스트리에 없으면 null */
export async function readOrgWorklist(
  orgId: string,
): Promise<OrgWorklist | null> {
  const [all, summaries] = await Promise.all([snapshot(), publishedSummaries()])
  const org = all.orgs.get(orgId)
  if (!org) return null
  const orgLines = all.lines.filter((l) => l.org === orgId)
  const budgets = latestBudgets(orgLines)
  const bySubject = new Map(
    summaries.flatMap((s) => (s.subject ? [[s.subject, s] as const] : [])),
  )

  const items = all.programs
    .filter((p) => p.org === orgId)
    .map((p): WorkItem => {
      const path = `programs/${p.id}`
      const progress: SubjectProgress = {
        materials: all.materialCount.get(path) ?? 0,
        facts: all.facts.get(path)?.length ?? 0,
        absences: all.absences.get(path)?.length ?? 0,
        reports: all.reports.get(path) ?? [],
        reviews: all.reviews.get(path) ?? [],
        published: all.published.has(path),
      }
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
    catalog: catalogOf(orgLines),
    items,
  }
}
