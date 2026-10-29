// 예산 카탈로그(budgetLines) 읽기. 서울·경기·중앙까지 세부사업이 수만 건이라 화면은 전체를 읽지 않는다:
// 기관 합계는 집계 쿼리로, 사업 카드의 금액은 카드가 가리키는 코드만 읽는다.
import { AggregateField, FieldPath } from 'firebase-admin/firestore'
import { BudgetLineSchema } from '#/pipeline/schemas'
import { db } from '#/pipeline/store'
import { memo } from '#/features/reports/server/report-docs.server'

export interface OrgCatalog {
  year: number
  /** 그 해 세부사업 수 */
  lines: number
  /** 그 해 예산현액 합(원) */
  amount: number
  asOf: string
}

/** Firestore `in` 조건에 넣을 수 있는 값 수 */
const IN_LIMIT = 30
/** 카탈로그를 찾아볼 회계연도 수 (올해부터 거꾸로) */
const YEARS_BACK = 3

const LineFields = BudgetLineSchema.pick({
  code: true,
  org: true,
  year: true,
  amounts: true,
  asOf: true,
})
export type LineFields = ReturnType<typeof LineFields.parse>

async function readOrgCatalog(org: string): Promise<OrgCatalog | null> {
  const lines = db().collection('budgetLines').where('org', '==', org)
  const thisYear = new Date().getFullYear()
  for (let year = thisYear; year > thisYear - YEARS_BACK; year--) {
    const scoped = lines.where('year', '==', year)
    const agg = await scoped
      .aggregate({
        lines: AggregateField.count(),
        amount: AggregateField.sum(new FieldPath('amounts', '예산현액')),
      })
      .get()
    const { lines: count, amount } = agg.data()
    if (!count) continue
    const one = await scoped.select('asOf').limit(1).get()
    const asOf = one.docs[0]?.get('asOf')
    return {
      year,
      lines: count,
      amount,
      asOf: typeof asOf === 'string' ? asOf : '',
    }
  }
  return null
}

const catalogs = new Map<string, (now?: number) => Promise<OrgCatalog | null>>()

/**
 * 기관의 가장 최근 회계연도 카탈로그 합계. 없으면 null.
 * 레지스트리에 있는 기관만 부른다(캐시가 기관 수만큼만 자란다). 합계를 못 읽어도 페이지는 그린다
 */
export async function orgCatalog(org: string): Promise<OrgCatalog | null> {
  let read = catalogs.get(org)
  if (!read) {
    read = memo(() => readOrgCatalog(org))
    catalogs.set(org, read)
  }
  try {
    return await read()
  } catch (e) {
    console.error(`[catalog] ${org} 카탈로그 합계를 읽지 못함`, e)
    return null
  }
}

/** 세부사업 코드들의 카탈로그 줄 (모든 회계연도) */
export async function linesByCode(
  codes: ReadonlyArray<string>,
): Promise<Array<LineFields>> {
  const unique = [...new Set(codes)]
  const chunks = Array.from(
    { length: Math.ceil(unique.length / IN_LIMIT) },
    (_, i) => unique.slice(i * IN_LIMIT, (i + 1) * IN_LIMIT),
  )
  const snaps = await Promise.all(
    chunks.map((c) =>
      db()
        .collection('budgetLines')
        .where('code', 'in', c)
        .select('code', 'org', 'year', 'amounts', 'asOf')
        .get(),
    ),
  )
  // 양식이 틀린 줄 하나가 모든 작업 현황을 막지 않게 건너뛴다
  return snaps.flatMap((s) =>
    s.docs.flatMap((d) => {
      const r = LineFields.safeParse(d.data())
      if (r.success) return [r.data]
      console.warn(`[catalog] 양식이 맞지 않아 건너뜀: ${d.ref.path}`)
      return []
    }),
  )
}
