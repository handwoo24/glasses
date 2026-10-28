import { z } from 'zod'

/**
 * 리포트 양식(v0.5) — 감시(watchdog) 리포트.
 * 시민이 읽는 본문(30초 요약 → 판정과 알아야 할 것 → 돈의 흐름 → 잘 됐나 → 다음에 할 일)과
 * 접어 두는 감사용 상세(점검표·위험 신호·계약·감시 기록·공개 문서)로 나뉜다.
 * 모든 수치·판단은 sources의 id로 근거를 단다. 등급 계산 규칙은 rubric.ts.
 */

export const ALLOWED_SOURCE_HOSTS = [
  'www.goyang.go.kr',
  'www.goyangcouncil.go.kr',
  'www.lofin365.go.kr',
  'www.ev.or.kr',
  'www.g2b.go.kr',
  'contract.anyang.go.kr',
  'www.bai.go.kr',
  'www.gg.go.kr',
  'www.law.go.kr',
  'eminwon.goyang.go.kr',
  'www.paju.go.kr',
  'www.gimpo.go.kr',
] as const

/** 시민이 직접 할 일(청구·민원·방청)로 안내하는 곳 */
export const ALLOWED_ACTION_HOSTS = [
  'www.open.go.kr',
  'www.epeople.go.kr',
  'www.goyangcouncil.go.kr',
  'www.goyang.go.kr',
] as const

export const GRADES = ['good', 'caution', 'poor', 'insufficient'] as const
export const CHECK_RESULTS = ['pass', 'warn', 'fail', 'unknown'] as const
export const AREAS = [
  'budget',
  'execution',
  'contract',
  'process',
  'outcome',
  'oversight',
  'disclosure',
] as const

const isoDate = z.iso.date()
const sourceId = z.string().regex(/^s\d+$/, 'source id는 s1, s2 … 형식')
const cite = z.array(sourceId).min(1, '근거(cite)가 하나 이상 필요')

const httpsUrl = (hosts: ReadonlyArray<string>) =>
  z.url({ protocol: /^https$/ }).refine((value) => {
    try {
      const u = new URL(value)
      return hosts.includes(u.hostname) && !u.username && !u.password && !u.port
    } catch {
      return false
    }
  }, '허용되지 않은 주소 (허용 도메인의 https 주소만, 사용자 정보·포트 불가)')

const sourceUrl = httpsUrl(ALLOWED_SOURCE_HOSTS)
const actionUrl = httpsUrl(ALLOWED_ACTION_HOSTS)
/** 문서 본문에 거는 링크: 출처 도메인이나 시민 안내 도메인의 https 주소만 */
export const LinkUrlSchema = httpsUrl([
  ...new Set([...ALLOWED_SOURCE_HOSTS, ...ALLOWED_ACTION_HOSTS]),
])

export const SourceSchema = z.object({
  id: sourceId,
  title: z.string().min(1),
  org: z.string().min(1),
  kind: z.enum(['보도자료', '예산서', '회의록', '계약정보', '공고', '기타']),
  date: isoDate,
  url: sourceUrl,
  license: z.string().min(1),
  locator: z.string().optional(),
})

export const MoneyFlowSchema = z
  .object({
    title: z.string().min(1),
    start: z.object({ label: z.string(), amount: z.number(), cite }),
    steps: z
      .array(z.object({ label: z.string(), delta: z.number(), cite }))
      .min(1),
    end: z.object({ label: z.string(), amount: z.number(), cite }),
  })
  .refine(
    (f) =>
      f.start.amount + f.steps.reduce((s, x) => s + x.delta, 0) ===
      f.end.amount,
    { message: 'start + 단계별 증감의 합이 end와 같아야 함' },
  )

/** 돈이 실제로 지나간 길: 재원 → 시 → 받은 곳 → 그다음. 예산 단계가 아니라 실제 흐름을 보여 준다 */
export const MoneyPathSchema = z.object({
  title: z.string().min(1),
  caption: z.string().optional(),
  nodes: z
    .array(
      z.object({
        label: z.string().min(1),
        amount: z.string().optional(),
        detail: z.string().min(1),
        cite,
      }),
    )
    .min(2),
})

/** 감시 점검 항목: 질문 하나에 결과 하나. 비전문가를 위해 왜 중요한지 적는다. */
export const CheckSchema = z
  .object({
    area: z.enum(AREAS),
    question: z.string().min(1),
    result: z.enum(CHECK_RESULTS),
    finding: z.string().min(1),
    /** 판단 기준: 법령·규정 조항 또는 비교 수치. 무엇에 비춰 ○△✕를 정했는지 */
    criterion: z.string().min(1),
    why: z.string().optional(),
    /** 이 지적에 걸린 금액(원). scope.total 대비 비중을 보여 주고 경미 여부를 가린다 */
    amount: z.number().nonnegative().optional(),
    /** 같은 원인에서 나온 점검끼리 같은 키를 주면 등급에는 한 번만 센다 */
    group: z.string().optional(),
    cite: z.array(sourceId),
  })
  .refine((c) => c.result === 'unknown' || c.cite.length > 0, {
    message: '확인 불가가 아닌 점검은 근거가 필요',
  })

/** 계약 금액은 계약정보공개시스템 단위 그대로 원(₩) */
export const ContractSchema = z.object({
  name: z.string().min(1),
  vendor: z.string().min(1),
  kind: z.enum(['용역', '물품', '공사']),
  method: z.string().min(1),
  date: isoDate,
  period: z.string().optional(),
  baseAmount: z.number().optional(),
  awardAmount: z.number().optional(),
  contractAmount: z.number().optional(),
  rate: z.number().optional(),
  paid: z.number().optional(),
  reason: z.string().optional(),
  flag: z.string().optional(),
  /** 입찰 과정: 공고·자격·평가·응찰 수 (모르는 것은 비워 둔다) */
  bid: z
    .object({
      notice: z.string().optional(),
      eligibility: z.string().optional(),
      evaluation: z.string().optional(),
      bidders: z.number().int().nonnegative().optional(),
    })
    .optional(),
  /** 이행 과정: 감독, 검사, 대금 지급, 변경, 하도급 */
  performance: z
    .object({
      supervisor: z.boolean().optional(),
      inspection: z.string().optional(),
      payments: z
        .array(
          z.object({
            date: isoDate,
            kind: z.enum(['선급금', '기성금', '준공금', '기타']),
            amount: z.number(),
          }),
        )
        .default([]),
      changes: z
        .array(
          z.object({ date: isoDate, delta: z.number(), reason: z.string() }),
        )
        .default([]),
      subcontracts: z.number().int().nonnegative().optional(),
    })
    .optional(),
  cite,
})

/** 예산 누수 위험 신호: 그 자체로 위법은 아니지만 확인이 필요한 객관적 지표 */
export const RiskSignalSchema = z
  .object({
    signal: z.string().min(1),
    status: z.enum(['detected', 'clear', 'unknown']),
    severity: z.enum(['high', 'medium', 'low']),
    detail: z.string().min(1),
    cite: z.array(sourceId),
  })
  .refine((r) => r.status === 'unknown' || r.cite.length > 0, {
    message: '확인 불가가 아닌 위험 신호는 근거가 필요',
  })

/**
 * 있어야 할 문서가 공개됐는지.
 * 공개 의무가 있는데 게시하지 않은 것, 청구했는데 거부된 것, 아직 청구하지 않은 것은 무게가 다르다.
 */
export const DisclosureItemSchema = z
  .object({
    doc: z.string().min(1),
    status: z.enum(['public', 'partial', 'missing', 'unknown']),
    /** mandatory: 법령상 게시 의무 / request: 청구하면 공개 대상 / unknown: 확인 못 함 */
    duty: z.enum(['mandatory', 'request', 'unknown']),
    /** 정보공개청구 진행 상황 */
    request: z
      .enum(['not-filed', 'pending', 'granted', 'denied', 'no-answer'])
      .default('not-filed'),
    note: z.string().min(1),
    cite: z.array(sourceId),
  })
  .refine((d) => d.status === 'unknown' || d.cite.length > 0, {
    message: '확인 불가가 아닌 공개 항목은 근거가 필요',
  })

/** 누가 감시·감사했나 */
export const OversightSchema = z
  .object({
    body: z.string().min(1),
    when: z.string().min(1),
    status: z.enum(['done', 'partial', 'none', 'unknown']),
    finding: z.string().min(1),
    followUp: z.string().min(1),
    cite: z.array(sourceId),
  })
  .refine((o) => o.status === 'unknown' || o.cite.length > 0, {
    message: '확인 불가가 아닌 감사 이력은 근거가 필요',
  })

const ChartUnit = z.enum(['krw-thousand', 'krw', 'count', 'percent'])
const ChartRow = z.object({ label: z.string().min(1), value: z.number() })
const ChartSection = z.enum(['budget', 'execution', 'contract'])
/** 차트 id. 알아야 할 것(points)의 근거로 붙일 때 쓴다. 제목은 결론 문장으로 쓴다 */
const chartId = z.string().regex(/^[a-z0-9-]+$/)

export const ChartSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('bar'),
    id: chartId,
    section: ChartSection,
    title: z.string(),
    caption: z.string().optional(),
    unit: ChartUnit,
    highlight: z.array(z.string()).optional(),
    /** true면 큰 순서로 정렬하지 않고 입력 순서(예: 연도순)를 지킨다 */
    ordered: z.boolean().optional(),
    data: z.array(ChartRow).min(2),
    cite,
  }),
  z.object({
    type: z.literal('diverging'),
    id: chartId,
    section: ChartSection,
    title: z.string(),
    caption: z.string().optional(),
    unit: ChartUnit,
    data: z.array(ChartRow).min(2),
    cite,
  }),
  z.object({
    type: z.literal('grouped'),
    id: chartId,
    section: ChartSection,
    title: z.string(),
    caption: z.string().optional(),
    unit: ChartUnit,
    series: z
      .array(z.object({ key: z.string(), label: z.string() }))
      .min(2)
      .max(3),
    data: z
      .array(
        z.object({
          label: z.string().min(1),
          values: z.record(z.string(), z.number()),
        }),
      )
      .min(1),
    cite,
  }),
  z.object({
    type: z.literal('share'),
    id: chartId,
    section: ChartSection,
    title: z.string(),
    caption: z.string().optional(),
    series: z
      .array(z.object({ key: z.string(), label: z.string() }))
      .min(2)
      .max(3),
    data: z
      .array(
        z.object({
          label: z.string().min(1),
          values: z.record(z.string(), z.number()),
        }),
      )
      .min(1),
    cite,
  }),
])

const cited = z.object({ text: z.string().min(1), cite })

/** 시민이 알아야 할 것 하나: 결론 → 근거 숫자 → 시민 말로 → 시의 해명 → 단서 */
const PointSchema = z.object({
  /** 결론 한 문장. 시민의 말로, 전문용어는 처음 나올 때 괄호로 푼다 */
  claim: z.string().min(1),
  evidence: z.array(cited).min(1).max(5),
  /** 생활 단위로 바꾼 크기 (1명당, 승용차 몇 대분 …) */
  plain: z.string().optional(),
  /** 원인: 왜 이렇게 됐나. 확인하지 못했으면 그렇다고 적는다 */
  cause: z.string().optional(),
  /** 시가 공식 석상·문서에서 한 설명 */
  said: cited.optional(),
  /** 단서: 추정 계산식, 아직 보지 못한 자료 */
  caveat: z.string().optional(),
  /** 근거로 붙일 차트 id */
  charts: z.array(chartId).default([]),
})

/** 이 사업 30초 요약: 평가보다 먼저, 무엇을 평가하는지 */
const BriefSchema = z.object({
  what: z.string().min(1),
  why: z.string().min(1),
  cost: z.string().min(1),
  who: z.string().min(1),
  now: z.string().min(1),
  next: z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
      label: z.string().min(1),
    })
    .optional(),
  cite,
})

/** 맡은 곳 한눈에: 업체·기관, 맡은 일, 받은 돈, 몇 년째, 짚을 점 */
const VendorSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  received: z.string().min(1),
  since: z.string().min(1),
  note: z.string().min(1),
  cite,
})

/** 잘 됐나: 목표 대비 실적. 아직 알 수 없으면 언제 알 수 있는지 */
const OutcomeSchema = z.object({
  summary: z.string().min(1),
  items: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
        note: z.string().optional(),
        cite,
      }),
    )
    .default([]),
  pending: z.string().optional(),
})

/**
 * 아직 모르는 것. 시민에게는 두 가지로만 말한다.
 * not-yet: 아직 보지 못함(청구·발표 전) / refused: 요청했는데 받지 못함
 */
const UnknownSchema = z.object({
  what: z.string().min(1),
  status: z.enum(['not-yet', 'refused']),
  when: z.string().optional(),
})

/** 시민이 할 수 있는 일: 청구, 민원, 방청 */
const ActionSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
  when: z.string().optional(),
  url: actionUrl.optional(),
  /** 그대로 복사해 청구서에 붙일 문장 */
  copy: z.string().optional(),
})

/** 점검 범위: 무엇을, 언제 자료로 보았고, 무엇을 보지 못했나 */
const ScopeSchema = z.object({
  covers: z.string().min(1),
  /** 점검 대상 금액(원). 지적별 비중과 경미 여부의 기준 */
  total: z.number().positive().optional(),
  totalLabel: z.string().optional(),
  asOf: z.array(z.object({ what: z.string(), date: isoDate })).min(1),
  notChecked: z.array(z.string()).default([]),
})

/** 피감기관(시)의 해명: 우리가 물었는지, 답이 왔는지, 회의록 등에서 시가 이미 한 설명 */
const ResponseSchema = z.object({
  status: z.enum(['not-asked', 'asked', 'answered', 'no-answer']),
  asked: isoDate.optional(),
  note: z.string().min(1),
  items: z
    .array(
      z.object({
        topic: z.string().min(1),
        said: z.string().min(1),
        cite,
      }),
    )
    .default([]),
})

export const BudgetBasisSchema = z.object({
  intro: z.string(),
  steps: z
    .array(z.object({ label: z.string(), detail: z.string(), cite }))
    .min(1),
})

export const TimelineItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
  label: z.string(),
  cite,
})

export const ReportSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    summary: z.string().min(1),
    verdict: z.string().min(1),
    entity: z.enum(['city', 'council', 'both']),
    category: z.string().min(1),
    departments: z.array(z.string()).min(1),
    status: z.enum(['예정', '진행 중', '완료', '심의 완료']),
    publishedAt: isoDate,
    updatedAt: isoDate,
    brief: BriefSchema,
    moneyFlow: MoneyFlowSchema.optional(),
    moneyPath: MoneyPathSchema.optional(),
    budgetBasis: BudgetBasisSchema.optional(),
    charts: z.array(ChartSchema).default([]),
    contracts: z
      .object({ intro: z.string(), items: z.array(ContractSchema).min(1) })
      .optional(),
    timeline: z.array(TimelineItemSchema).min(1),
    /** 판정 바로 밑에 붙는 시민이 알아야 할 것 (중요한 순) */
    points: z.array(PointSchema).min(2).max(5),
    vendors: z.array(VendorSchema).default([]),
    outcome: OutcomeSchema,
    unknowns: z.array(UnknownSchema).min(1),
    actions: z.array(ActionSchema).min(1),
    scope: ScopeSchema,
    checks: z.array(CheckSchema).min(3),
    /** 점검하지 않은 영역과 그 사유 (해당 없음 / 자료 없음 등) */
    skippedAreas: z
      .array(z.object({ area: z.enum(AREAS), reason: z.string().min(1) }))
      .default([]),
    response: ResponseSchema,
    recommendations: z
      .array(z.object({ to: z.string().min(1), what: z.string().min(1) }))
      .min(1),
    nextReview: z.object({
      date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
      items: z.array(z.string().min(1)).min(1),
    }),
    riskSignals: z.array(RiskSignalSchema).default([]),
    disclosure: z.array(DisclosureItemSchema).default([]),
    oversight: z.array(OversightSchema).default([]),
    glossary: z.array(z.string()).default([]),
    openQuestions: z.array(z.string()),
    sources: z.array(SourceSchema).min(1),
    authorship: z.object({
      method: z.string(),
      rubricVersion: z.string(),
    }),
  })
  .superRefine((r, ctx) => {
    const ids = new Set(r.sources.map((s) => s.id))
    if (ids.size !== r.sources.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'source id 중복',
        path: ['sources'],
      })
    }
    const used = new Set<string>()
    const check = (list: Array<string>, path: Array<string | number>) => {
      list.forEach((id) => {
        used.add(id)
        if (!ids.has(id)) {
          ctx.addIssue({ code: 'custom', message: `없는 출처 ${id}`, path })
        }
      })
    }
    check(r.brief.cite, ['brief'])
    r.timeline.forEach((t, i) => check(t.cite, ['timeline', i]))
    r.points.forEach((p, i) => {
      p.evidence.forEach((e, j) => check(e.cite, ['points', i, 'evidence', j]))
      if (p.said) check(p.said.cite, ['points', i, 'said'])
    })
    r.vendors.forEach((v, i) => check(v.cite, ['vendors', i]))
    r.outcome.items.forEach((o, i) => check(o.cite, ['outcome', 'items', i]))
    r.checks.forEach((c, i) => check(c.cite, ['checks', i]))
    r.riskSignals.forEach((c, i) => check(c.cite, ['riskSignals', i]))
    r.disclosure.forEach((c, i) => check(c.cite, ['disclosure', i]))
    r.oversight.forEach((c, i) => check(c.cite, ['oversight', i]))
    r.response.items.forEach((c, i) => check(c.cite, ['response', 'items', i]))
    r.charts.forEach((c, i) => check(c.cite, ['charts', i]))
    r.moneyPath?.nodes.forEach((n, i) =>
      check(n.cite, ['moneyPath', 'nodes', i]),
    )
    r.budgetBasis?.steps.forEach((s, i) =>
      check(s.cite, ['budgetBasis', 'steps', i]),
    )
    r.contracts?.items.forEach((c, i) =>
      check(c.cite, ['contracts', 'items', i]),
    )
    if (r.moneyFlow) {
      const f = r.moneyFlow
      check(f.start.cite, ['moneyFlow', 'start'])
      f.steps.forEach((s, i) => check(s.cite, ['moneyFlow', 'steps', i]))
      check(f.end.cite, ['moneyFlow', 'end'])
    }
    r.sources.forEach((s, i) => {
      if (!used.has(s.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `인용되지 않은 출처 ${s.id}`,
          path: ['sources', i],
        })
      }
    })
    r.charts.forEach((c, i) => {
      if (c.type !== 'grouped' && c.type !== 'share') return
      const keys = c.series.map((s) => s.key)
      c.data.forEach((row, j) => {
        if (keys.some((k) => typeof row.values[k] !== 'number')) {
          ctx.addIssue({
            code: 'custom',
            message: '차트 행에 계열 값이 빠짐',
            path: ['charts', i, 'data', j],
          })
        }
      })
    })
    const chartIds = new Set(r.charts.map((c) => c.id))
    if (chartIds.size !== r.charts.length) {
      ctx.addIssue({
        code: 'custom',
        message: '차트 id 중복',
        path: ['charts'],
      })
    }
    const attached = new Set<string>()
    r.points.forEach((p, i) =>
      p.charts.forEach((id) => {
        if (!chartIds.has(id)) {
          ctx.addIssue({
            code: 'custom',
            message: `없는 차트 ${id}`,
            path: ['points', i, 'charts'],
          })
        }
        if (attached.has(id)) {
          ctx.addIssue({
            code: 'custom',
            message: `차트 ${id}를 두 번 붙임`,
            path: ['points', i, 'charts'],
          })
        }
        attached.add(id)
      }),
    )
    r.checks.forEach((c, i) => {
      if (c.amount === undefined) return
      if (r.scope.total === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: '금액을 적으려면 scope.total이 필요',
          path: ['checks', i, 'amount'],
        })
      } else if (c.amount > r.scope.total) {
        ctx.addIssue({
          code: 'custom',
          message: '지적 금액이 점검 대상 금액보다 큼',
          path: ['checks', i, 'amount'],
        })
      }
    })
    const groups = new Map<string, number>()
    r.checks.forEach((c) => {
      if (c.group) groups.set(c.group, (groups.get(c.group) ?? 0) + 1)
    })
    groups.forEach((n, g) => {
      if (n < 2) {
        ctx.addIssue({
          code: 'custom',
          message: `묶음 ${g}에 점검이 하나뿐`,
          path: ['checks'],
        })
      }
    })
    const checked = new Set(r.checks.map((c) => c.area))
    const skipped = new Set(r.skippedAreas.map((s) => s.area))
    AREAS.forEach((a) => {
      if (!checked.has(a) && !skipped.has(a)) {
        ctx.addIssue({
          code: 'custom',
          message: `점검하지 않은 영역은 사유가 필요: ${a}`,
          path: ['skippedAreas'],
        })
      }
      if (checked.has(a) && skipped.has(a)) {
        ctx.addIssue({
          code: 'custom',
          message: `점검한 영역을 빠진 영역으로 적음: ${a}`,
          path: ['skippedAreas'],
        })
      }
    })
    const dates = r.timeline.map((t) => t.date)
    if (dates.some((d, i) => i > 0 && d < dates[i - 1])) {
      ctx.addIssue({
        code: 'custom',
        message: 'timeline은 날짜 오름차순',
        path: ['timeline'],
      })
    }
  })

export type Report = z.infer<typeof ReportSchema>
export type ReportInput = z.input<typeof ReportSchema>
export type Source = z.infer<typeof SourceSchema>
export type MoneyFlow = z.infer<typeof MoneyFlowSchema>
export type MoneyPath = z.infer<typeof MoneyPathSchema>
export type Check = z.infer<typeof CheckSchema>
export type Contract = z.infer<typeof ContractSchema>
export type BudgetBasis = z.infer<typeof BudgetBasisSchema>
export type TimelineItem = z.infer<typeof TimelineItemSchema>
export type Chart = z.infer<typeof ChartSchema>
export type RiskSignal = z.infer<typeof RiskSignalSchema>
export type DisclosureItem = z.infer<typeof DisclosureItemSchema>
export type Oversight = z.infer<typeof OversightSchema>
export type Point = z.infer<typeof PointSchema>
export type Brief = z.infer<typeof BriefSchema>
export type Vendor = z.infer<typeof VendorSchema>
export type Outcome = z.infer<typeof OutcomeSchema>
export type Unknown = z.infer<typeof UnknownSchema>
export type Action = z.infer<typeof ActionSchema>
export type Scope = z.infer<typeof ScopeSchema>
export type CityResponse = z.infer<typeof ResponseSchema>
export type Grade = (typeof GRADES)[number]
export type CheckResult = (typeof CHECK_RESULTS)[number]
export type Area = (typeof AREAS)[number]
