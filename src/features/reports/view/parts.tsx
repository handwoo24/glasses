// 보고서 부품. 클래스 이름과 쓰임은 glasses 디자인 시스템(src/styles/report.css)을 따른다.
import type { ReactNode } from 'react'
import { EVIDENCE_INFO, OVERALL_EVIDENCE_INFO, STATUS_INFO } from '../axes'
import type { AxisStatus, EvidenceLevel, OverallEvidence } from '../axes'
import { ANSWER_INFO, STATUS_TONE } from '../assessment'
import type { Answer, Cited } from '../assessment'
import { Cite } from '../components/cite'

interface StatusBadgeProps {
  status: AxisStatus
  /** 종합 판정 문구(‘지켜볼 점 있음’)로 */
  overall?: boolean
  size?: 'lg' | 'xl'
}

/** 판정 배지: 판정색은 이 부품에서만 쓴다 */
export function StatusBadge({ status, overall, size }: StatusBadgeProps) {
  const info = STATUS_INFO[status]
  return (
    <span
      className={['st', STATUS_TONE[status], size].filter(Boolean).join(' ')}
    >
      {overall ? info.overall : info.label}
    </span>
  )
}

export function AnswerBadge({ answer }: { answer: Answer }) {
  const { label, tone } = ANSWER_INFO[answer]
  return <span className={`st ${tone}`}>{label}</span>
}

export function Evidence({ level }: { level: EvidenceLevel }) {
  const info = EVIDENCE_INFO[level]
  return (
    <span className="ev">
      <i aria-hidden="true">{info.dots}</i> 근거 {info.label}
    </span>
  )
}

const OVERALL_DOTS: Record<OverallEvidence, string> = {
  high: '●●●',
  medium: '●●○',
  low: '●○○',
}

export function OverallEvidenceMark({ level }: { level: OverallEvidence }) {
  return (
    <span className="ev">
      <i aria-hidden="true">{OVERALL_DOTS[level]}</i> 근거 수준{' '}
      {OVERALL_EVIDENCE_INFO[level]}
    </span>
  )
}

/** [문장, ...출처]를 문장 끝 출처 번호와 함께 */
export function CitedText({ value: [text, ...ids] }: { value: Cited }) {
  return (
    <>
      {text}
      <Cite ids={ids} />
    </>
  )
}

export function FactList({ facts }: { facts: ReadonlyArray<Cited> }) {
  return (
    <ul className="f">
      {facts.map((f, i) => (
        <li key={`${i}-${f[0]}`}>
          <CitedText value={f} />
        </li>
      ))}
    </ul>
  )
}

export interface BarRow {
  name: string
  value: number
  text: string
  hot?: boolean
}

interface HBarsProps {
  rows: ReadonlyArray<BarRow>
  /** 화면 낭독용 요약. 없으면 행을 모두 읽는다 */
  label?: string
  /** 막대 100%에 해당하는 값. 비율은 100 */
  max?: number
  caption?: ReactNode
}

/** 가로 막대: 강조할 막대 하나만 파랑 */
export function HBars({ rows, label, max, caption }: HBarsProps) {
  // 값이 모두 0이거나 행이 없어도 폭이 NaN이 되지 않게 1로 둔다
  const top = max ?? (Math.max(0, ...rows.map((r) => r.value)) || 1)
  return (
    <div>
      <ul
        className="hbars"
        role="img"
        aria-label={label ?? rows.map((r) => `${r.name} ${r.text}`).join(', ')}
      >
        {rows.map((r, i) => (
          <li key={`${i}-${r.name}`} className={r.hot ? 'hot' : undefined}>
            <span className="hb-name">{r.name}</span>
            <span className="hb-track">
              <i
                style={{
                  width: `${Math.max(0, (r.value / top) * 100).toFixed(1)}%`,
                }}
              />
            </span>
            <span className="hb-val">{r.text}</span>
          </li>
        ))}
      </ul>
      {caption && <p className="cap">{caption}</p>}
    </div>
  )
}

export function DownArrow() {
  return (
    <div className="down">
      <svg viewBox="0 0 14 22" aria-hidden="true">
        <path
          d="M7 1v16M2 12l5 7 5-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </div>
  )
}

interface PanelProps {
  id: string
  title: string
  children: ReactNode
  className?: string
}

/** 섹션: 휴대폰에서는 남색 띠가 달린 카드, 넓은 화면에서는 한 장의 칸 */
export function Panel({ id, title, children, className }: PanelProps) {
  return (
    <section
      className={['panel', className].filter(Boolean).join(' ')}
      id={id}
      aria-labelledby={`t-${id}`}
    >
      <div className="band">
        <span id={`t-${id}`}>{title}</span>
      </div>
      <div className="inner">{children}</div>
    </section>
  )
}

interface FoldProps {
  id?: string
  title: string
  summary?: string
  children: ReactNode
}

/** 접는 상자 */
export function Fold({ id, title, summary, children }: FoldProps) {
  return (
    <details className="more" id={id}>
      <summary>
        <span>
          {title} {summary && <small>{summary}</small>}
        </span>
      </summary>
      <div className="more-body">{children}</div>
    </details>
  )
}
