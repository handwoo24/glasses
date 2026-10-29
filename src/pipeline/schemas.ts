/**
 * 자율 보고 파이프라인이 Firestore에 남기는 산출물의 양식.
 * 데이터는 Firestore에만 두고, 여기에는 양식만 둔다. 파이프라인 도구(scripts/pipeline.ts)는
 * 이 양식에 맞는 문서만 쓴다. 단계별 쓰임은 src/pipeline/README.md.
 */
import { z } from 'zod'
import { ReportSummarySchema } from '#/features/reports/summary'
import { VendorSummarySchema } from '#/features/vendors/summary'

const isoDate = z.iso.date()
const isoDateTime = z.iso.datetime({ offset: true })
const httpsUrl = z.url({ protocol: /^https?$/ })

/**
 * 기관 id: 행정표준 기관코드 7자리(고양시 3940000). 공공기관은 ALIO 기관코드에 alio- 접두어.
 * 지방재정365 세부사업 코드의 앞 7자리와 같다.
 */
export const ORG = '(?:\\d{7}|alio-[A-Za-z0-9]+)'
export const ORG_ID = new RegExp(`^${ORG}$`)
/** 사업 id: 기관코드.사업 (3940000.autonomous-bus). 연도와 무관한 고정 id */
export const PROGRAM_ID = new RegExp(`^${ORG}\\.[a-z0-9-]+$`)
/** 재정 문서 id: 연도-구분 (2026-original, 2026-supplementary-3, 2025-settlement) */
export const BUDGET_ID = /^\d{4}-(?:original|supplementary-\d+|settlement)$/
/** 평가 대상 경로: 사업 또는 재정 문서 */
export const SUBJECT_PATH = new RegExp(
  `^(?:programs/${ORG}\\.[a-z0-9-]+|orgs/${ORG}/budgets/\\d{4}-(?:original|supplementary-\\d+|settlement))$`,
)
/** 사업자등록번호 10자리 (하이픈 없이). 업체 id로 쓴다 */
export const BIZNO = '\\d{10}'
/** 업체 평가 대상: 사업 안의 업체 하나 (programs/{기관코드}.{사업}/vendors/{사업자등록번호}) */
export const VENDOR_SUBJECT_PATH = new RegExp(
  `^programs/${ORG}\\.[a-z0-9-]+/vendors/${BIZNO}$`,
)
/** 사실·부재 기록·리포트·검증 기록을 둘 수 있는 평가 대상: 사업·재정 문서·업체 */
export function isEvaluationSubject(path: string): boolean {
  return SUBJECT_PATH.test(path) || VENDOR_SUBJECT_PATH.test(path)
}
const EvaluationSubject = z
  .string()
  .refine(isEvaluationSubject, '평가 대상 경로가 아니다')
/** 다른 평가 대상의 사실 경로 (업체 리포트가 사업 쪽 계약 사실을 가리킬 때) */
const FACT_PATH = new RegExp(
  `^programs/${ORG}\\.[a-z0-9-]+(?:/vendors/${BIZNO})?/facts/f\\d+$`,
)
/** 자료 id: m- + 원본 파일 SHA-256 앞 12자리 */
export const MATERIAL_ID = /^m-[0-9a-f]{12}$/

export const ORG_TYPES = [
  '중앙행정기관',
  '광역자치단체',
  '기초자치단체',
  '지방의회',
  '교육청',
  '공공기관',
] as const

/** 기관 레지스트리 */
export const OrgSchema = z.strictObject({
  name: z.string().min(1),
  type: z.enum(ORG_TYPES),
  /** 상급 기관 (기초 → 광역, 소속기관 → 부처) */
  parent: z.string().regex(ORG_ID).optional(),
  /** 행정구역 코드 (시도 2자리 + 시군구 3자리, 고양시 41280) */
  region: z
    .string()
    .regex(/^\d{2}(?:\d{3})?$/)
    .optional(),
  /** 지방재정365 자치단체 코드 (고양시 4120000) */
  lafCd: z
    .string()
    .regex(/^\d{7}$/)
    .optional(),
  /** 주소·표시용 별칭 (goyang). 겹칠 수 있으므로 id로 쓰지 않는다 */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  /** 리포트 출처로 허용할 이 기관의 누리집 */
  sourceHosts: z.array(z.string().min(1)).default([]),
  updatedAt: isoDate,
})

/** 공식 분야·부문 (기능별 분류). 이름만 알면 이름만 적는다 */
const FieldSchema = z.strictObject({
  sector: z.string().min(1),
  subsector: z.string().min(1).optional(),
})

/** 사업 카드: 사업의 정체성. 평가 시점과 무관하다 */
export const ProgramSchema = z.strictObject({
  name: z.string().min(1),
  org: z.string().regex(ORG_ID),
  /** 조회용으로 기관의 행정구역을 함께 적는다 */
  region: z
    .string()
    .regex(/^\d{2}(?:\d{3})?$/)
    .optional(),
  field: FieldSchema.optional(),
  /** 상위 사업 (달릴고양 ⊂ 거점형 스마트시티) */
  parent: z.string().regex(PROGRAM_ID).optional(),
  /** 국고보조사업이면 중앙 사업 */
  nationalProgram: z.string().regex(PROGRAM_ID).optional(),
  /** 세부사업 코드 (예산 카탈로그 budgetLines/{코드}-{연도}). 사업이 여러 세부사업에 걸치면 모두 적는다 */
  budgetLines: z.array(z.string().min(1)).default([]),
  /** 담당 부서 (예산서 세출 사업명세서의 부서 이름). 여러 부서가 나눠 맡으면 모두 적는다 */
  departments: z.array(z.string().min(1)).default([]),
  status: z.enum(['계획', '진행 중', '완료', '중단']),
  /** 업체 루프가 이 사업의 참여 업체를 목록화한 날. 평가할 업체가 없어도 적어서 다시 훑지 않는다 */
  vendorsListedAt: isoDate.optional(),
  priority: z.strictObject({
    score: z.enum(['high', 'medium', 'low']),
    why: z.string().min(1),
  }),
  updatedAt: isoDate,
})

/** 재정 문서: 본예산·추경·결산 한 판 (orgs/{기관}/budgets/{연도-구분}) */
export const BudgetDocSchema = z.strictObject({
  name: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  kind: z.enum(['본예산', '추경', '결산']),
  /** 추경 차수 */
  round: z.number().int().positive().optional(),
  /** 의회 의결일 */
  decidedAt: isoDate.optional(),
  /** 총액(원) */
  total: z.number().int().nonnegative().optional(),
  updatedAt: isoDate,
})

/**
 * 예산 카탈로그 한 줄: 공식 세부사업의 한 해 (budgetLines/{세부사업 코드}-{연도}).
 * 지방은 지방재정365 세부사업 코드(3940000202330652: 기관코드 + 처음 등록한 해 + 일련번호)로,
 * 코드가 해마다 유지되므로 사업 카드에는 연도 없이 코드만 적는다. 중앙은 cg-{열린재정 코드}.
 */
export const BudgetLineSchema = z.strictObject({
  code: z.string().regex(/^[A-Za-z0-9-]+$/),
  org: z.string().regex(ORG_ID),
  year: z.number().int().min(2000).max(2100),
  name: z.string().min(1),
  account: z.string().min(1).optional(),
  field: FieldSchema.optional(),
  /** 원 단위. 지방재정365는 예산현액·국비·시도비·시군구비·기타·지출액·집행잔액 */
  amounts: z.record(z.string(), z.number()),
  /** 연결된 사업 (없으면 아직 사업으로 정리하지 않은 항목) */
  program: z.string().regex(PROGRAM_ID).optional(),
  source: z.string().min(1),
  asOf: isoDate,
})

export const MATERIAL_KINDS = [
  '보도자료',
  '예산서',
  '회의록',
  '계약정보',
  '공고',
  '집행정보',
  '감사',
  '법령',
  '목록',
  '기타',
] as const

/**
 * 수집한 원자료 한 건 (materials/{자료 id}). 파일은 Storage의 materials/{자료 id}/ 아래에 둔다.
 * 경로가 내용 해시로만 정해지므로 기관·사업 정리가 바뀌어도 파일은 움직이지 않는다.
 */
export const MaterialSchema = z.strictObject({
  title: z.string().min(1),
  kind: z.enum(MATERIAL_KINDS),
  /** 원문을 공개한 곳 (조달청 나라장터, 고양특례시의회 …) */
  publisher: z.string().min(1),
  url: httpsUrl,
  /** 요청 파라미터가 있는 조회 결과면 그 값 */
  params: z.string().optional(),
  publishedAt: isoDate.optional(),
  fetchedAt: isoDate,
  /** 원본 파일 SHA-256 */
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  files: z.strictObject({
    /** materials/{자료 id}/original.{확장자} */
    original: z.string().min(1),
    /** 추출 텍스트 materials/{자료 id}/text.txt (원본이 글자가 아닐 때) */
    text: z.string().min(1).optional(),
  }),
  textSha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  license: z.string().min(1).optional(),
  /** 다루는 기관 (레지스트리에 있는 기관만) */
  about: z.array(z.string().regex(ORG_ID)).default([]),
  /** 쓰이는 평가 대상 */
  subjects: z.array(EvaluationSubject).default([]),
})

/**
 * 업체 레지스트리 (vendors/{사업자등록번호}): 공식 등록 정보만. 여러 사업에 나오는 업체를 한 곳에 묶는다.
 * 대표자·직원 이름은 받지 않는다(strictObject).
 */
export const VendorSchema = z.strictObject({
  /** 공식 기록의 법인명 그대로 */
  name: z.string().min(1),
  type: z.enum(['법인', '개인']),
  /** 본사 소재 시군구 (경기도 고양시 일산동구) */
  region: z.string().min(1).optional(),
  openedAt: isoDate.optional(),
  employees: z.number().int().nonnegative().optional(),
  /** 나라장터 등록 업무 (물품, 용역, 공사 …) */
  businesses: z.array(z.string().min(1)).default([]),
  /** 마지막으로 부정당 제재를 조회한 날과 그때 유효한 제재 수 */
  sanctions: z
    .strictObject({
      checkedAt: isoDate,
      active: z.number().int().nonnegative(),
    })
    .optional(),
  updatedAt: isoDate,
})

export const CONTRACT_KINDS = ['용역', '공사', '물품'] as const

/**
 * 업체 카드 (programs/{사업}/vendors/{사업자등록번호}): 사업 안에서 업체 하나가 맡은 일. 업체 리포트의 평가 대상.
 * 카드 목록이 업체 루프의 조사 목록이 되고, 작업 단계는 남은 산출물로 계산한다.
 */
export const VendorCardSchema = z.strictObject({
  name: z.string().min(1),
  /** 맡은 일 한 줄 (스마트시티센터 정보시스템 유지보수) */
  role: z.string().min(1),
  contracts: z
    .array(
      z.strictObject({
        name: z.string().min(1),
        /** 계약번호·통합계약번호 */
        no: z.string().min(1),
        /** 최종 계약 금액(원) */
        amount: z.number().int().nonnegative(),
        from: isoDate,
        to: isoDate,
        kind: z.enum(CONTRACT_KINDS),
      }),
    )
    .min(1),
  /** 공동수급이면 이 업체의 지분(%) */
  share: z.number().min(0).max(100).optional(),
  priority: z.strictObject({
    score: z.enum(['high', 'medium', 'low']),
    why: z.string().min(1),
  }),
  updatedAt: isoDate,
})

/** 사람이 남긴 배경 메모 (수집 노트, 사업 요약). 평가 근거가 아니라 작업 맥락이다 */
export const NoteSchema = z.strictObject({
  title: z.string().min(1),
  markdown: z.string().min(1),
  updatedAt: isoDate,
})

/** 게시: 사이트에 보이는 리포트 (published/{주소}). 사람이 승인해 쓴다 */
export const PublishedSchema = z.strictObject({
  /** 게시할 리포트 경로 (…/reports/{기준일}) */
  report: z.string().min(1),
  subject: z.string().regex(SUBJECT_PATH),
  /** 홈 목록 순서 (작을수록 앞) */
  order: z.number().int().nonnegative(),
  publishedAt: isoDateTime,
  /** 홈·목록용 요약. 게시할 때 파이프라인 도구가 리포트에서 계산해 채운다 */
  summary: ReportSummarySchema.optional(),
})

/** 업체 리포트 게시 (publishedVendors/{주소}). 사업·재정 문서 게시와 화면·요약이 달라 따로 둔다 */
export const PublishedVendorSchema = z.strictObject({
  report: z.string().min(1),
  subject: z.string().regex(VENDOR_SUBJECT_PATH),
  publishedAt: isoDateTime,
  /** 업체 목록용 요약. 게시할 때 파이프라인 도구가 리포트에서 계산해 채운다 */
  summary: VendorSummarySchema.optional(),
})

/** 사람 이름을 가리는 표기. 원문 검사(check-facts)에서는 아무 이름(한글 2~4자)과 맞춰 본다 */
export const NAME_MASK = '○○○'

/** 회의록 화자 표기: ○직함 이름 / ○ 이름 위원 */
const SPEAKER_NAMES: ReadonlyArray<RegExp> = [
  /○\s?[가-힣·]*(?:과장|국장|실장|시장|담당관|팀장|소장|본부장|원장|센터장)\s([가-힣]{2,4})(?=[\s.,…]|$)/g,
  /○\s([가-힣]{2,4})\s(?:위원장|위원|의원|부의장|의장)/g,
]

/** 가리지 않은 화자 이름 */
export function unmaskedNames(text: string): Array<string> {
  return SPEAKER_NAMES.flatMap((re) => [...text.matchAll(re)].map((m) => m[1]))
}

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
    /** 같은 평가 대상의 f{n}, 또는 다른 평가 대상 사실의 경로 */
    derivedFrom: z
      .array(
        z.string().refine((r) => /^f\d+$/.test(r) || FACT_PATH.test(r), {
          message: 'f{번호} 또는 programs/…/facts/f{번호}',
        }),
      )
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
  .refine(
    (f) => unmaskedNames(`${f.quote ?? ''}\n${f.locator ?? ''}`).length === 0,
    {
      message: `인용·위치의 사람 이름은 ${NAME_MASK}로 가린다 (○스마트시티과장 ${NAME_MASK}, ○ ${NAME_MASK} 위원)`,
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
  /** 독자가 읽을 수 없는 표기: 자료의 필드 이름, 코드 낱말, 풀지 않은 원값 */
  '표기',
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

/** 리포트 한 판. 본문은 리포트 문서 양식(src/features/reports/doc/FORMAT.md)의 마크다운 */
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
  /** 평가 대상 (programs/… · orgs/…/budgets/… · programs/…/vendors/…) */
  subject: EvaluationSubject.optional(),
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

export type Org = z.infer<typeof OrgSchema>
export type Program = z.infer<typeof ProgramSchema>
export type Vendor = z.infer<typeof VendorSchema>
export type VendorCard = z.infer<typeof VendorCardSchema>
export type PublishedVendor = z.infer<typeof PublishedVendorSchema>
export type BudgetDoc = z.infer<typeof BudgetDocSchema>
export type BudgetLine = z.infer<typeof BudgetLineSchema>
export type Note = z.infer<typeof NoteSchema>
export type Published = z.infer<typeof PublishedSchema>
export type Material = z.infer<typeof MaterialSchema>
export type Fact = z.infer<typeof FactSchema>
export type Absence = z.infer<typeof AbsenceSchema>
export type Review = z.infer<typeof ReviewSchema>
export type ReportRecord = z.infer<typeof ReportRecordSchema>
export type Task = z.infer<typeof TaskSchema>
export type Stage = (typeof STAGES)[number]
