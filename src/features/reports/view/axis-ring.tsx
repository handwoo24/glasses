// 7조각 링: 목록·카드에서 7개 축을 한눈에. 12시부터 시계 방향 ①~⑦,
// 색은 상태, 굵기는 근거 수준, 회색은 판단 불가. 점수가 아니라 상태라 조각 크기는 같다.
import { AXIS_IDS, AXIS_INFO, EVIDENCE_INFO, STATUS_INFO } from '../axes'
import type { AxisId, AxisStatus, EvidenceLevel } from '../axes'
import { STATUS_TONE } from '../assessment'

type RingAxes = Record<AxisId, { status: AxisStatus; evidence: EvidenceLevel }>

const R = 80
const C = 2 * Math.PI * R
const STEP = 360 / AXIS_IDS.length
/** 조각 사이 틈(도) */
const GAP = 3
const SEG = (C * (STEP - GAP)) / 360
const WIDTH: Record<EvidenceLevel, number> = { thin: 22, partial: 34, full: 46 }

/** ‘목표 판단 불가 근거 부족, 진척 …’ 화면 낭독용 */
export function ringLabel(axes: RingAxes): string {
  return AXIS_IDS.map(
    (a) =>
      `${AXIS_INFO[a].label} ${STATUS_INFO[axes[a].status].label} 근거 ${EVIDENCE_INFO[axes[a].evidence].label}`,
  ).join(', ')
}

interface AxisRingProps {
  axes: RingAxes
  size?: number
}

export function AxisRing({ axes, size = 56 }: AxisRingProps) {
  return (
    <svg
      className="axis-ring"
      width={size}
      height={size}
      viewBox="0 0 220 220"
      role="img"
      aria-label={`7개 축: ${ringLabel(axes)}`}
    >
      {AXIS_IDS.map((a, i) => (
        <circle
          key={a}
          cx="110"
          cy="110"
          r={R}
          fill="none"
          className={`seg ${STATUS_TONE[axes[a].status]}`}
          strokeWidth={WIDTH[axes[a].evidence]}
          strokeDasharray={`${SEG.toFixed(2)} ${(C - SEG).toFixed(2)}`}
          transform={`rotate(${(-90 + i * STEP + GAP / 2).toFixed(2)} 110 110)`}
        />
      ))}
    </svg>
  )
}
