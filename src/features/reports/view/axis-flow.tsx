// 7개 축 흐름도: 축을 사업(또는 예산)이 흘러가는 순서에 놓는다.
// 윗줄은 흐름(①→②→③→⑥), 아랫줄은 돈(④ ⑤), ⑦ 투명성·책임은 전체를 감싸는 테두리.
import { AXIS_INFO, EVIDENCE_INFO } from '../axes'
import type { AxisId } from '../axes'
import { STATUS_TONE } from '../assessment'
import type { AxisDoc } from '../report-doc'
import { StatusBadge } from './parts'

export type FlowKind = 'program' | 'budget'

const STAGES: Record<FlowKind, ReadonlyArray<string>> = {
  program: ['계획', '만들기', '쓰임', '끝난 뒤'],
  budget: ['편성', '집행', '결과', '다음 해'],
}

/** 돈 갈래(④ ⑤)를 윗줄의 몇 번째 칸 아래에 놓나 */
const MONEY_UNDER: Record<FlowKind, readonly [number, number]> = {
  program: [1, 2],
  budget: [0, 1],
}

const FRAME_QUESTION: Record<FlowKind, string> = {
  program: '이 과정 전체를 시민이 확인할 수 있나',
  budget: '예산서와 결정 이유를 시민이 확인할 수 있나',
}

const FLOW: ReadonlyArray<AxisId> = [
  'goal',
  'progress',
  'outcome',
  'sustainability',
]

interface AxisFlowProps {
  axes: Record<AxisId, AxisDoc>
  kind: FlowKind
}

interface NodeProps {
  id: AxisId
  axis: AxisDoc
  /** 휴대폰에서 칸 위에 붙는 단계 이름 */
  stage: string
  /** 오른쪽 칸으로 이어지는 화살표 */
  next?: boolean
}

function Node({ id, axis, stage, next }: NodeProps) {
  const info = AXIS_INFO[id]
  return (
    <a
      className={`flow-node ${STATUS_TONE[axis.status]}${next ? ' next' : ''}`}
      href={`#axis-${id}`}
      data-stage={stage}
    >
      <b>
        {info.no} {info.label}
      </b>
      <StatusBadge status={axis.status} />
      <span className="q">{axis.line}</span>
      <span className="d">
        근거 <i aria-hidden="true">{EVIDENCE_INFO[axis.evidence].dots}</i>{' '}
        {EVIDENCE_INFO[axis.evidence].label}
      </span>
    </a>
  )
}

export function AxisFlow({ axes, kind }: AxisFlowProps) {
  const frame = axes.accountability
  const [costAt, execAt] = MONEY_UNDER[kind]
  const money: Array<AxisId | undefined> = [
    undefined,
    undefined,
    undefined,
    undefined,
  ]
  money[costAt] = 'cost'
  money[execAt] = 'execution'
  return (
    <div className={`axis-flow ${STATUS_TONE[frame.status]}`}>
      <a className="frame-label" href="#axis-accountability">
        {AXIS_INFO.accountability.no} {AXIS_INFO.accountability.label}{' '}
        <StatusBadge status={frame.status} />{' '}
        <span className="q">— {FRAME_QUESTION[kind]}</span>
      </a>
      <div className="flow-grid">
        <span className="lane" aria-hidden="true" />
        {STAGES[kind].map((s) => (
          <span key={s} className="stage">
            {s}
          </span>
        ))}
        <span className="lane">{kind === 'budget' ? '예산' : '사업'}</span>
        {FLOW.map((id, i) => (
          <Node
            key={id}
            id={id}
            axis={axes[id]}
            stage={STAGES[kind][i]}
            next={i < FLOW.length - 1}
          />
        ))}
        <span className="lane money">돈</span>
        {money.map((id, i) =>
          id ? (
            <Node
              key={id}
              id={id}
              axis={axes[id]}
              stage={`${STAGES[kind][i]} · 돈`}
            />
          ) : (
            <span key={`empty-${i}`} className="flow-empty" />
          ),
        )}
      </div>
    </div>
  )
}
