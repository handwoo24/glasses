// Firestore 경로 → 양식. 정해진 경로에만 쓸 수 있다.
import type { ZodType } from 'zod'
import {
  AbsenceSchema,
  FactSchema,
  MATERIAL_ID,
  MaterialSchema,
  PROGRAM_ID,
  ProgramSchema,
  ReportRecordSchema,
  ReviewSchema,
  TaskSchema,
} from './schemas'

export type Kind =
  'program' | 'fact' | 'absence' | 'review' | 'report' | 'material' | 'task'

interface Route {
  kind: Kind
  /** 문서 경로 */
  doc: RegExp
  schema: ZodType
}

const P = PROGRAM_ID.source.slice(1, -1)
const M = MATERIAL_ID.source.slice(1, -1)

const ROUTES: ReadonlyArray<Route> = [
  {
    kind: 'program',
    doc: new RegExp(`^programs/(${P})$`),
    schema: ProgramSchema,
  },
  {
    kind: 'fact',
    doc: new RegExp(`^programs/(${P})/facts/(f\\d+)$`),
    schema: FactSchema,
  },
  {
    kind: 'absence',
    doc: new RegExp(`^programs/(${P})/absences/(a\\d+)$`),
    schema: AbsenceSchema,
  },
  {
    kind: 'review',
    doc: new RegExp(`^programs/(${P})/reviews/([a-z0-9-]+)$`),
    schema: ReviewSchema,
  },
  {
    kind: 'report',
    doc: new RegExp(`^programs/(${P})/reports/(\\d{4}-\\d{2}-\\d{2})$`),
    schema: ReportRecordSchema,
  },
  {
    kind: 'material',
    doc: new RegExp(`^materials/(${M})$`),
    schema: MaterialSchema,
  },
  { kind: 'task', doc: /^tasks\/([a-z0-9-]+)$/, schema: TaskSchema },
]

export interface Resolved {
  kind: Kind
  schema: ZodType
  /** 경로에 들어 있는 사업 id (사업 아래 문서일 때) */
  program?: string
}

export const PATH_HELP = [
  'programs/{기관.사업}',
  'programs/{기관.사업}/facts/f{번호}',
  'programs/{기관.사업}/absences/a{번호}',
  'programs/{기관.사업}/reviews/{id}',
  'programs/{기관.사업}/reports/{YYYY-MM-DD}',
  'materials/m-{sha256 앞 12자리}',
  'tasks/{id}',
]

export function resolve(path: string): Resolved {
  for (const r of ROUTES) {
    const m = r.doc.exec(path)
    if (m)
      return {
        kind: r.kind,
        schema: r.schema,
        program: r.kind === 'material' || r.kind === 'task' ? undefined : m[1],
      }
  }
  throw new Error(
    `정해지지 않은 경로: ${path}\n쓸 수 있는 경로:\n  ${PATH_HELP.join('\n  ')}`,
  )
}

const COLLECTIONS: ReadonlyArray<RegExp> = [
  /^programs$/,
  new RegExp(`^programs/${P}/(facts|absences|reviews|reports)$`),
  /^materials$/,
  /^tasks$/,
]

/** 정해진 컬렉션 경로인지 */
export function isCollection(path: string): boolean {
  return COLLECTIONS.some((c) => c.test(path))
}
