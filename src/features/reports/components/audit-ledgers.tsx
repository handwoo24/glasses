import type { DisclosureItem, Oversight, RiskSignal } from '../schema'
import { Cite } from './cite'

type Tone = 'bad' | 'warn' | 'good' | 'none'

const TONE: Record<Tone, string> = {
  bad: 'border-grade-poor text-grade-poor',
  warn: 'border-grade-caution text-grade-caution',
  good: 'border-grade-good text-grade-good',
  none: 'border-dashed border-grade-insufficient text-grade-insufficient',
}

function Chip({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[3px] border-[1.5px] px-1.5 py-px text-[12px] font-semibold ${TONE[tone]}`}
    >
      {children}
    </span>
  )
}

const SIGNAL_LABEL: Record<RiskSignal['status'], string> = {
  detected: '감지',
  clear: '해당 없음',
  unknown: '확인 불가',
}

function signalTone(s: RiskSignal): Tone {
  if (s.status === 'clear') return 'good'
  if (s.status === 'unknown') return 'none'
  return s.severity === 'low' ? 'warn' : 'bad'
}

const SEVERITY_LABEL = { high: '높음', medium: '중간', low: '낮음' } as const

/** 예산 누수 위험 신호판 */
export function RiskSignalBoard({
  items,
}: {
  items: ReadonlyArray<RiskSignal>
}) {
  return (
    <ul className="m-0 list-none divide-y divide-rule border-y border-ink p-0">
      {items.map((s, i) => (
        <li
          key={`${i}-${s.signal}`}
          className="grid gap-x-4 gap-y-1.5 py-3.5 sm:grid-cols-[6rem_1fr]"
        >
          <span className="flex items-center gap-2 sm:flex-col sm:items-start">
            <Chip tone={signalTone(s)}>{SIGNAL_LABEL[s.status]}</Chip>
            {s.status === 'detected' && (
              <span className="text-[12px] text-muted">
                심각도 {SEVERITY_LABEL[s.severity]}
              </span>
            )}
          </span>
          <div>
            <p className="m-0 text-[15px] font-semibold">{s.signal}</p>
            <p className="m-0 mt-1 text-[14.5px] leading-[1.75] text-ink-soft">
              {s.detail}
              <Cite ids={s.cite} />
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** 공개되지 않은 문서는 게시 의무와 청구 결과에 따라 무게를 나눈다 */
function docLabel(d: DisclosureItem): [string, Tone] {
  if (d.status === 'public') return ['공개', 'good']
  if (d.status === 'partial') return ['일부 공개', 'warn']
  if (d.status === 'unknown') return ['확인 불가', 'none']
  if (d.request === 'denied') return ['청구 거부', 'bad']
  if (d.request === 'no-answer') return ['청구 무응답', 'bad']
  if (d.request === 'pending') return ['청구 중', 'warn']
  if (d.duty === 'mandatory') return ['게시 의무 미이행', 'bad']
  return ['미공개 · 청구 전', 'warn']
}

const DUTY_LABEL: Record<DisclosureItem['duty'], string> = {
  mandatory: '법령상 게시 의무 있음',
  request: '청구하면 공개 대상',
  unknown: '공개 의무 확인 못 함',
}

/** 있어야 할 문서가 시민에게 공개됐는지 */
export function DisclosureLedger({
  items,
}: {
  items: ReadonlyArray<DisclosureItem>
}) {
  return (
    <ul className="m-0 grid list-none gap-px border-y border-ink bg-rule p-0 sm:grid-cols-2">
      {items.map((d, i) => {
        const [label, tone] = docLabel(d)
        return (
          <li
            key={`${i}-${d.doc}`}
            className="bg-paper py-3.5 sm:px-4 sm:last:odd:col-span-2"
          >
            <p className="m-0 flex items-start justify-between gap-3">
              <span className="text-[15px] font-semibold">{d.doc}</span>
              <Chip tone={tone}>{label}</Chip>
            </p>
            <p className="m-0 mt-1 text-[14px] leading-relaxed text-ink-soft">
              {d.note}
              <Cite ids={d.cite} />
            </p>
            {d.status !== 'public' && (
              <p className="m-0 mt-1 text-[12px] text-muted">
                {DUTY_LABEL[d.duty]}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

const OVERSIGHT_LABEL: Record<Oversight['status'], [string, Tone]> = {
  done: ['감사함', 'good'],
  partial: ['일부만', 'warn'],
  none: ['기록 없음', 'bad'],
  unknown: ['확인 불가', 'none'],
}

/** 누가 감시·감사했고, 그 뒤 무엇이 바뀌었나 */
export function OversightTable({ items }: { items: ReadonlyArray<Oversight> }) {
  return (
    <ol className="m-0 list-none space-y-4 p-0">
      {items.map((o, i) => {
        const [label, tone] = OVERSIGHT_LABEL[o.status]
        return (
          <li
            key={`${i}-${o.body}-${o.when}`}
            className="border border-rule bg-sheet"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
              <p className="m-0 text-[15px] font-semibold">
                {o.body}
                <span className="ml-2 text-[13px] font-normal text-muted">
                  {o.when}
                </span>
              </p>
              <Chip tone={tone}>{label}</Chip>
            </div>
            <dl className="m-0 grid gap-3 px-4 py-3 text-[14px] leading-relaxed sm:grid-cols-2">
              <div>
                <dt className="text-[12px] text-muted">지적한 것</dt>
                <dd className="m-0 mt-0.5 text-ink-soft">
                  {o.finding}
                  <Cite ids={o.cite} />
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">그 뒤 바뀐 것</dt>
                <dd className="m-0 mt-0.5 text-ink-soft">{o.followUp}</dd>
              </div>
            </dl>
          </li>
        )
      })}
    </ol>
  )
}
