// 일꾼이 끝낼 때 돌려주는 JSON. `claude -p --json-schema`로 강제하고, 러너는 이것만 보고 다음 칸을 정한다.
// 필드는 에이전트 파일의 "끝낼 때" 항목과 같다.
import { z } from 'zod'
import type { Step } from './plan'

const common = {
  summary: z.string().describe('log.md에 남길 한 줄 결과'),
  stumbles: z
    .array(z.string())
    .describe('걸려 넘어진 것: 다음에 시간을 아낄 요령. 없으면 빈 배열'),
}

export const CollectHandback = z.object({
  ...common,
  materials: z
    .array(
      z.object({
        id: z.string().describe('m-…'),
        kind: z.string().describe('자료 종류'),
        text: z
          .string()
          .nullable()
          .describe(
            '발췌 칸이 읽을 글자 파일 경로(text.txt 또는 글자인 원본). 글자로 못 뽑았으면 null',
          ),
      }),
    )
    .describe('이번에 새로 받은 것과 이 평가 대상에 쓸 기존 자료 모두'),
  blocked: z.array(z.string()).describe('막힌 출처'),
  notFound: z.array(z.string()).describe('찾아봤는데 없던 것과 검색어'),
  wrongUploads: z.array(z.string()).describe('잘못 올린 자료'),
  g2bCalls: z.number().int().describe('나라장터 호출 수. 안 썼으면 0'),
})

export const ExtractHandback = z.object({
  summary: z.string().describe('m-… 후보 N개 (축별 개수), 버린 후보 M개'),
  output: z.string().describe('출력 파일 경로'),
  candidates: z.number().int(),
  unrelated: z.boolean().describe('자료가 이 평가 대상과 무관하면 true'),
})

export const LedgerHandback = z.object({
  ...common,
  facts: z.string().describe('f1~fN (원문 n, 계산 m)'),
  absences: z.string().describe('a1~aK'),
  gaps: z.array(z.string()).describe('축별로 빈 곳'),
  checkFacts: z.boolean().describe('check-facts 통과 여부'),
})

export const WriteHandback = z.object({
  ...common,
  report: z.string().describe('리포트 경로 (in-review로 올린 판)'),
  axes: z.array(z.string()).describe('축마다 상태 한 줄'),
  fixes: z
    .array(z.string())
    .describe(
      '고침이면 지적별 처리(고침 / 고치지 않음과 근거). 초안이면 빈 배열',
    ),
  unverified: z.array(z.string()).describe('확인 못 한 것'),
})

export const VerifyHandback = z.object({
  ...common,
  verdict: z.enum(['pass', 'fail']),
  review: z.string().describe('검증 기록 경로'),
  counts: z.object({
    high: z.number().int(),
    medium: z.number().int(),
    low: z.number().int(),
  }),
  top: z.array(z.string()).describe('가장 중요한 지적 한두 개'),
})

export const ListHandback = z.object({
  ...common,
  cards: z
    .array(z.string())
    .describe('올린 업체 카드 경로 (업체, 금액, 우선순위)'),
  excluded: z.array(z.string()).describe('뺀 업체 — 이유'),
})

type WorkerStep = Exclude<Step, 'publish'> | 'list'

export const HANDBACKS = {
  collect: CollectHandback,
  extract: ExtractHandback,
  ledger: LedgerHandback,
  draft: WriteHandback,
  fix: WriteHandback,
  verify: VerifyHandback,
  list: ListHandback,
} as const satisfies Record<WorkerStep, z.ZodType>

export type HandbackOf<TStep extends WorkerStep> = z.infer<
  (typeof HANDBACKS)[TStep]
>

/** `claude -p --json-schema`에 넘길 JSON Schema 문자열 */
export function jsonSchemaOf(step: WorkerStep): string {
  return JSON.stringify(z.toJSONSchema(HANDBACKS[step], { target: 'draft-7' }))
}

export type { WorkerStep }
