/**
 * 자율 보고 파이프라인이 Firestore에 남기는 산출물의 양식.
 * 데이터는 Firestore에만 두고, 여기에는 양식만 둔다. 파이프라인 도구(scripts/pipeline.ts)는
 * 이 양식에 맞는 문서만 쓴다. 단계별 쓰임은 src/pipeline/README.md.
 */
import { z } from 'zod'
import { SourceSchema } from '#/features/reports/schema'

const isoDate = z.iso.date()
const isoDateTime = z.iso.datetime({ offset: true })

/** 기관.사업 (예: goyang.autonomous-bus). 사업은 연도와 무관한 고정 id */
export const PROGRAM_ID = /^[a-z0-9-]+\.[a-z0-9-]+$/
/** 자료 id: m- + 원문 SHA-256 앞 12자리 */
export const MATERIAL_ID = /^m-[0-9a-f]{12}$/

/** 사업 카드: 사업의 정체성. 평가 시점과 무관하다 */
export const ProgramSchema = z.strictObject({
  name: z.string().min(1),
  /** 기관 id (goyang, goyang-council, me …) */
  org: z.string().regex(/^[a-z0-9-]+$/),
  /** 상위 사업 (달릴고양 ⊂ 거점형 스마트시티) */
  parent: z.string().regex(PROGRAM_ID).optional(),
  /** 국고보조사업이면 중앙 사업 */
  nationalProgram: z.string().regex(PROGRAM_ID).optional(),
  /** 연도별 공식 세부사업. 이름·코드가 해마다 바뀌어도 여기만 늘린다 */
  budgetLines: z
    .array(
      z.strictObject({
        year: z.number().int().min(2000).max(2100),
        code: z.string().min(1).optional(),
        name: z.string().min(1),
        /** 원 */
        amount: z.number().int().nonnegative(),
        /** 국비·도비·시군비·기금 */
        fund: z.enum(['국비', '도비', '시군비', '기금', '혼합']).optional(),
      }),
    )
    .default([]),
  status: z.enum(['계획', '진행 중', '완료', '중단']),
  priority: z.strictObject({
    score: z.enum(['high', 'medium', 'low']),
    why: z.string().min(1),
  }),
  updatedAt: isoDate,
})

/** 수집한 원자료 한 건. 원본 파일은 Cloud Storage(로컬에서는 resources/)에 둔다 */
export const MaterialSchema = z.strictObject({
  title: z.string().min(1),
  org: z.string().min(1),
  kind: SourceSchema.shape.kind,
  url: SourceSchema.shape.url,
  publishedAt: isoDate,
  fetchedAt: isoDate,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  license: z.string().min(1),
  /** 원본(또는 추출 텍스트) 위치 */
  file: z.string().min(1),
  programs: z.array(z.string().regex(PROGRAM_ID)).min(1),
})

/** 사실 원장 한 줄: 리포트의 숫자·판정은 모두 여기서 출발한다 */
export const FactSchema = z
  .strictObject({
    claim: z.string().min(1),
    kind: z.enum(['수치', '일정', '발언', '문서']),
    value: z.number().optional(),
    unit: z.enum(['krw', 'count', 'percent', 'month']).optional(),
    /** 원문 사실: 자료 + 위치 + 인용 */
    material: z.string().regex(MATERIAL_ID).optional(),
    /** 원문 안 위치: 쪽, 계약번호, 발언 순서 등 */
    locator: z.string().min(1).optional(),
    /** 원문 그대로, 짧게 */
    quote: z.string().min(1).max(500).optional(),
    /** 계산된 사실: 근거 사실 id + 계산식 */
    derivedFrom: z
      .array(z.string().regex(/^f\d+$/))
      .min(1)
      .optional(),
    formula: z.string().min(1).optional(),
    recordedAt: isoDate,
  })
  .refine(
    (f) =>
      Boolean(f.material && f.locator && f.quote) !==
      Boolean(f.derivedFrom && f.formula),
    {
      message:
        '원문 사실(material·locator·quote)과 계산된 사실(derivedFrom·formula) 중 하나만 채운다',
    },
  )

/** "공개 자료에서 찾지 못했다"의 근거: 어디를 찾아봤나 */
export const AbsenceSchema = z.strictObject({
  what: z.string().min(1),
  searched: z
    .array(
      z.strictObject({
        where: z.string().min(1),
        query: z.string().optional(),
        result: z.string().min(1),
      }),
    )
    .min(1),
  on: isoDate,
})

export const REVIEW_TYPES = [
  '수치 불일치',
  '출처 불일치',
  '근거 없음',
  '단정 표현',
  '빠진 반론',
] as const

/** 검증 기록: 작성자와 다른 에이전트가 리포트를 원장·원문과 대조한 결과 */
export const ReviewSchema = z
  .strictObject({
    /** 검증한 리포트 (reports/{asOf}) */
    report: isoDate,
    verdict: z.enum(['pass', 'fail']),
    findings: z.array(
      z.strictObject({
        /** 리포트 안 위치: 축별 근거 > ④ 비용 > 사실 2 */
        where: z.string().min(1),
        type: z.enum(REVIEW_TYPES),
        claim: z.string().min(1),
        evidence: z.string().min(1),
        severity: z.enum(['high', 'medium', 'low']),
      }),
    ),
    reviewedAt: isoDateTime,
  })
  .refine(
    (r) =>
      r.verdict === 'fail' || r.findings.every((f) => f.severity !== 'high'),
    { message: '중요도 높음 지적이 있으면 verdict는 fail' },
  )

/** 리포트 한 판. 본문은 리포트 문서 양식(src/content/reports/README.md)의 마크다운 */
export const ReportRecordSchema = z.strictObject({
  markdown: z.string().min(1),
  status: z.enum(['draft', 'in-review', 'published']),
  updatedAt: isoDateTime,
})

export const STAGES = [
  'triage',
  'collect-analyze',
  'assess-write',
  'verify',
] as const
export const TASK_STATUSES = ['queued', 'running', 'done', 'failed'] as const

/** 작업 큐 한 건 */
export const TaskSchema = z.strictObject({
  stage: z.enum(STAGES),
  program: z.string().regex(PROGRAM_ID).optional(),
  status: z.enum(TASK_STATUSES),
  attempt: z.number().int().nonnegative(),
  /** 실행 중인 작업을 다른 실행이 가져가지 못하는 시각 */
  leaseUntil: isoDateTime.optional(),
  /** 읽을 산출물 경로 */
  inputs: z.array(z.string().min(1)).default([]),
  /** 남긴 산출물 경로 */
  outputs: z.array(z.string().min(1)).default([]),
  error: z.string().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
})

export type Program = z.infer<typeof ProgramSchema>
export type Material = z.infer<typeof MaterialSchema>
export type Fact = z.infer<typeof FactSchema>
export type Absence = z.infer<typeof AbsenceSchema>
export type Review = z.infer<typeof ReviewSchema>
export type ReportRecord = z.infer<typeof ReportRecordSchema>
export type Task = z.infer<typeof TaskSchema>
export type Stage = (typeof STAGES)[number]
