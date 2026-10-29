// Firestore 경로 → 양식. 정해진 경로에만 쓸 수 있다.
import type { ZodType } from 'zod'
import {
  AbsenceSchema,
  BudgetDocSchema,
  BudgetLineSchema,
  FactSchema,
  MATERIAL_ID,
  MaterialSchema,
  NoteSchema,
  ORG,
  OrgSchema,
  ProgramSchema,
  PublishedSchema,
  PublishedVendorSchema,
  ReportRecordSchema,
  ReviewSchema,
  TaskSchema,
  VendorCardSchema,
  VendorSchema,
} from './schemas'

export type Kind =
  | 'org'
  | 'program'
  | 'budget'
  | 'budgetLine'
  | 'fact'
  | 'absence'
  | 'review'
  | 'report'
  | 'note'
  | 'material'
  | 'task'
  | 'published'
  | 'vendor'
  | 'vendorCard'
  | 'publishedVendor'

const BIZNO = '\\d{10}'
/** 평가 대상: 사업, 사업 안의 업체, 재정 문서 */
const SUBJECT = `(programs/${ORG}\\.[a-z0-9-]+(?:/vendors/${BIZNO})?|orgs/${ORG}/budgets/\\d{4}-(?:original|supplementary-\\d+|settlement))`
const M = MATERIAL_ID.source.slice(1, -1)
const SLUG = '[a-z0-9-]+'

interface Route {
  kind: Kind
  doc: RegExp
  schema: ZodType
}

const ROUTES: ReadonlyArray<Route> = [
  { kind: 'org', doc: new RegExp(`^orgs/(${ORG})$`), schema: OrgSchema },
  {
    kind: 'program',
    doc: new RegExp(`^(programs/${ORG}\\.${SLUG})$`),
    schema: ProgramSchema,
  },
  {
    kind: 'budget',
    doc: new RegExp(
      `^(orgs/${ORG}/budgets/\\d{4}-(?:original|supplementary-\\d+|settlement))$`,
    ),
    schema: BudgetDocSchema,
  },
  {
    kind: 'note',
    doc: new RegExp(`^(orgs/${ORG})/notes/(${SLUG})$`),
    schema: NoteSchema,
  },
  {
    kind: 'fact',
    doc: new RegExp(`^${SUBJECT}/facts/(f\\d+)$`),
    schema: FactSchema,
  },
  {
    kind: 'absence',
    doc: new RegExp(`^${SUBJECT}/absences/(a\\d+)$`),
    schema: AbsenceSchema,
  },
  {
    kind: 'report',
    doc: new RegExp(`^${SUBJECT}/reports/(\\d{4}-\\d{2}-\\d{2})$`),
    schema: ReportRecordSchema,
  },
  {
    kind: 'review',
    doc: new RegExp(`^${SUBJECT}/reviews/(${SLUG})$`),
    schema: ReviewSchema,
  },
  {
    kind: 'note',
    doc: new RegExp(`^${SUBJECT}/notes/(${SLUG})$`),
    schema: NoteSchema,
  },
  {
    kind: 'budgetLine',
    doc: /^budgetLines\/([A-Za-z0-9-]+-\d{4})$/,
    schema: BudgetLineSchema,
  },
  {
    kind: 'material',
    doc: new RegExp(`^materials/(${M})$`),
    schema: MaterialSchema,
  },
  { kind: 'task', doc: /^tasks\/([a-z0-9-]+)$/, schema: TaskSchema },
  {
    kind: 'published',
    doc: new RegExp(`^published/(${SLUG})$`),
    schema: PublishedSchema,
  },
  {
    kind: 'vendor',
    doc: new RegExp(`^vendors/(${BIZNO})$`),
    schema: VendorSchema,
  },
  {
    kind: 'vendorCard',
    doc: new RegExp(`^(programs/${ORG}\\.${SLUG})/vendors/(${BIZNO})$`),
    schema: VendorCardSchema,
  },
  {
    kind: 'publishedVendor',
    doc: new RegExp(`^publishedVendors/(${SLUG})$`),
    schema: PublishedVendorSchema,
  },
]

export interface Resolved {
  kind: Kind
  schema: ZodType
  /** 문서가 속한 평가 대상·기관의 경로 (사업·재정 문서·기관 아래 문서일 때) */
  parent?: string
}

export const PATH_HELP = [
  'orgs/{기관코드}',
  'orgs/{기관코드}/notes/{id}',
  'orgs/{기관코드}/budgets/{연도-구분}',
  'programs/{기관코드}.{사업}',
  'programs/{기관코드}.{사업}/vendors/{사업자등록번호 10자리}   업체 카드',
  'vendors/{사업자등록번호 10자리}   업체 레지스트리',
  '{평가 대상}/facts/f{번호} · absences/a{번호} · reports/{YYYY-MM-DD} · reviews/{id} · notes/{id}',
  '  (평가 대상 = programs/{기관코드}.{사업} · programs/{기관코드}.{사업}/vendors/{사업자등록번호} · orgs/{기관코드}/budgets/{연도-구분})',
  'budgetLines/{세부사업 코드}-{연도}',
  'materials/m-{원본 sha256 앞 12자리}',
  'tasks/{id}',
  'published/{주소}',
  'publishedVendors/{주소}   업체 리포트 게시',
]

/** 경로의 부모(평가 대상·기관). 최상위 문서는 없음 */
function parentOf(kind: Kind, match: RegExpExecArray): string | undefined {
  if (
    ['fact', 'absence', 'report', 'review', 'note', 'vendorCard'].includes(kind)
  )
    return match[1]
  if (kind === 'budget') return match[1].split('/budgets/')[0]
  return undefined
}

export function resolve(path: string): Resolved {
  for (const r of ROUTES) {
    const m = r.doc.exec(path)
    if (m)
      return { kind: r.kind, schema: r.schema, parent: parentOf(r.kind, m) }
  }
  throw new Error(
    `정해지지 않은 경로: ${path}\n쓸 수 있는 경로:\n  ${PATH_HELP.join('\n  ')}`,
  )
}

const COLLECTIONS: ReadonlyArray<RegExp> = [
  /^(orgs|programs|budgetLines|materials|tasks|published|vendors|publishedVendors)$/,
  new RegExp(`^orgs/${ORG}/(budgets|notes)$`),
  new RegExp(`^programs/${ORG}\\.${SLUG}/vendors$`),
  new RegExp(`^${SUBJECT}/(facts|absences|reports|reviews|notes)$`),
]

/** 정해진 컬렉션 경로인지 */
export function isCollection(path: string): boolean {
  return COLLECTIONS.some((c) => c.test(path))
}
