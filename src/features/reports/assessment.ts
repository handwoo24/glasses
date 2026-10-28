/**
 * 7개 축 평가(평가 체계 v0.1)의 판정 도구와 리포트 문서가 같이 쓰는 타입.
 * 문장 규칙은 glasses 문서 작성 체계를 따른다.
 */
import { AXIS_IDS, overallEvidence, overallStatus } from './axes'
import type {
  AxisId,
  AxisStatus,
  AxisStatuses,
  EvidenceLevel,
  OverallEvidence,
} from './axes'

export type Tone = 'ok' | 'warn' | 'bad' | 'none'

export const STATUS_TONE: Record<AxisStatus, Tone> = {
  'on-track': 'ok',
  watch: 'warn',
  fix: 'bad',
  unknown: 'none',
}

/** 점검 질문의 답 */
export const ANSWERS = ['yes', 'no', 'open', 'none'] as const
export type Answer = (typeof ANSWERS)[number]

export const ANSWER_INFO: Record<Answer, { label: string; tone: Tone }> = {
  yes: { label: '충족', tone: 'ok' },
  no: { label: '미충족', tone: 'bad' },
  open: { label: '확인 필요', tone: 'warn' },
  none: { label: '자료 없음', tone: 'none' },
}

/** [문장, ...출처 id] */
export type Cited = readonly [text: string, ...cite: Array<string>]

export interface OverviewCell {
  label: '무엇' | '얼마' | '누가' | '언제'
  value: string
  text: string
  cite?: ReadonlyArray<string>
}

export interface UnknownItem {
  label: string
  text: string
  /** 의회나 우리가 요청했는데 받지 못한 것 */
  requested?: boolean
  cite?: ReadonlyArray<string>
}

type Judged = {
  axes: Record<AxisId, { status: AxisStatus; evidence: EvidenceLevel }>
}

export interface Summary {
  statuses: AxisStatuses
  overall: AxisStatus
  evidence: OverallEvidence
  fixCount: number
}

export function summarize({ axes }: Judged): Summary {
  const statuses = Object.fromEntries(
    AXIS_IDS.map((a) => [a, axes[a].status]),
  ) as AxisStatuses
  return {
    statuses,
    overall: overallStatus(statuses),
    evidence: overallEvidence(AXIS_IDS.map((a) => axes[a].evidence)),
    fixCount: AXIS_IDS.filter((a) => statuses[a] === 'fix').length,
  }
}

/** 종합 판정 규칙의 어느 줄에 걸렸는지 한 구절로 */
export function overallReason(overall: AxisStatus, fixCount: number): string {
  switch (overall) {
    case 'fix':
      return `‘개선 필요’인 축이 ${fixCount}개여서`
    case 'watch':
      return fixCount
        ? `‘개선 필요’인 축이 ${fixCount}개이고 핵심 축이 모두 ‘순항’은 아니어서`
        : '‘개선 필요’인 축은 없지만 핵심 축(②·③)이 모두 ‘순항’은 아니어서'
    case 'unknown':
      return '핵심 축(②·③)을 아직 판단할 수 없어'
    case 'on-track':
      return '핵심 축이 순항이고 ‘개선 필요’인 축이 없어'
  }
}

/** 축과 답이 정해진 점검 질문 */
export interface ClassifiedCheck {
  axis: AxisId
  answer: Answer
  question: string
  finding: string
  criterion: string
  cite: ReadonlyArray<string>
}

export function answerCounts(
  checks: ReadonlyArray<Pick<ClassifiedCheck, 'answer'>>,
): Record<Answer, number> {
  return Object.fromEntries(
    ANSWERS.map((a) => [a, checks.filter((k) => k.answer === a).length]),
  ) as Record<Answer, number>
}
