// 판정 방법(평가 체계 v0.1)을 보여 주는 부품. 리포트의 ‘판정 방법’ 상자와 평가 기준 페이지가 함께 쓴다.
import {
  AXIS_IDS,
  AXIS_INFO,
  AXIS_STATUSES,
  EVIDENCE_INFO,
  EVIDENCE_LEVELS,
  OVERALL_RULES,
} from '../axes'
import type { AxisId, AxisStatus } from '../axes'
import { Evidence, StatusBadge } from './parts'

const STATUS_MEANING: Record<AxisStatus, string> = {
  'on-track': '약속한 대로 가고 있다',
  watch: '설명이 필요한 부분이 있다',
  fix: '약속에 못 미치거나 규칙과 어긋난 점이 확인됐다',
  unknown: '판단할 자료를 아직 보지 못했다',
}

interface AxisDefinitionsProps {
  /** 이 사업에서 축마다 보는 지표 */
  indicators?: Partial<Record<AxisId, string>>
}

export function AxisDefinitions({ indicators = {} }: AxisDefinitionsProps) {
  return (
    <ul className="rows">
      {AXIS_IDS.map((a) => {
        const info = AXIS_INFO[a]
        return (
          <li key={a}>
            <p className="q">
              {info.no} {info.label}
              {info.core && ' (핵심 축)'}
            </p>
            <p>
              {info.question}
              {indicators[a] && (
                <span className="crit">
                  {' '}
                  이 사업에서 보는 것: {indicators[a]}
                </span>
              )}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

export function StatusLegend() {
  return (
    <ul className="rows">
      {AXIS_STATUSES.map((s) => (
        <li key={s}>
          <p>
            <StatusBadge status={s} /> {STATUS_MEANING[s]}
          </p>
        </li>
      ))}
    </ul>
  )
}

export function EvidenceLegend() {
  return (
    <ul className="rows">
      {EVIDENCE_LEVELS.map((e) => (
        <li key={e}>
          <p>
            <Evidence level={e} /> {EVIDENCE_INFO[e].meaning}
          </p>
        </li>
      ))}
    </ul>
  )
}

export function OverallRules() {
  return (
    <ol className="rules">
      {OVERALL_RULES.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ol>
  )
}

export const EVIDENCE_RULE_NOTE =
  '종합 근거 수준: ‘충분’이 과반이면 높음, ‘부족’이 과반이면 낮음, 그 밖에는 중간.'

export const THRESHOLD_NOTE =
  '축별 기준값(90%·70%·50% 등)은 glasses가 정한 초안이며 법령이나 공식 평가 기준이 아닙니다. 참고한 틀: OECD 개발원조위원회 평가 기준, 감사원 성과감사, 기획재정부 재정사업 자율평가.'
