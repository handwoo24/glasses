import { useState } from 'react'
import type { ReactNode } from 'react'
import { formatDate } from '../format'
import type { Action, Brief, Outcome, Report, Unknown, Vendor } from '../schema'
import { Cite } from './cite'

const BRIEF_ROWS = [
  ['what', '무엇을 하나'],
  ['why', '왜, 누구를 위해'],
  ['cost', '얼마'],
  ['who', '누가 맡았나'],
  ['now', '지금 어디까지'],
] as const

/** 이 사업 30초 요약: 평가보다 먼저 무엇을 평가하는지 보여 준다 */
export function BriefCard({ brief }: { brief: Brief }) {
  return (
    <section
      aria-labelledby="brief-heading"
      className="border-t-[3px] border-accent bg-sheet px-5 py-5 sm:px-7"
    >
      <h2
        id="brief-heading"
        className="m-0 text-[13px] font-semibold tracking-[0.12em] text-accent"
      >
        이 사업 30초 요약
        <Cite ids={brief.cite} />
      </h2>
      <dl className="m-0 mt-4 grid gap-x-6 gap-y-3 text-[15px] leading-[1.75] sm:grid-cols-[8.5rem_1fr]">
        {BRIEF_ROWS.map(([key, label]) => (
          <div key={key} className="contents">
            <dt className="font-semibold text-muted">{label}</dt>
            <dd className="m-0">{brief[key]}</dd>
          </div>
        ))}
        {brief.next && (
          <div className="contents">
            <dt className="font-semibold text-muted">다음 날짜</dt>
            <dd className="m-0">
              <span className="font-semibold">
                {formatDate(brief.next.date)}
              </span>{' '}
              {brief.next.label}
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}

/** 맡은 곳 한눈에: 상세 계약 카드는 접어 두고 이 표를 먼저 본다 */
export function VendorTable({ vendors }: { vendors: ReadonlyArray<Vendor> }) {
  return (
    <div className="overflow-x-auto border-t border-ink">
      <table className="w-full min-w-[640px] border-collapse text-[14px]">
        <caption className="sr-only">맡은 곳과 받은 돈</caption>
        <thead>
          <tr className="text-left text-[12px] text-muted">
            <th scope="col" className="py-2 pr-3 font-medium">
              맡은 곳
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              맡은 일
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              받은 돈
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              언제부터
            </th>
            <th scope="col" className="py-2 font-medium">
              짚을 점
            </th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v, i) => (
            <tr
              key={`${i}-${v.name}`}
              className="border-t border-rule align-top"
            >
              <th scope="row" className="py-3 pr-3 text-left font-semibold">
                {v.name}
                <Cite ids={v.cite} />
              </th>
              <td className="py-3 pr-3 text-ink-soft">{v.role}</td>
              <td className="py-3 pr-3 tabular-nums">{v.received}</td>
              <td className="py-3 pr-3 text-ink-soft">{v.since}</td>
              <td className="py-3 text-ink-soft">{v.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 잘 됐나: 목표 대비 실적, 아직 모르면 언제 알 수 있는지 */
export function OutcomeBlock({ outcome }: { outcome: Outcome }) {
  return (
    <div>
      <p className="m-0 text-[15.5px] leading-[1.85]">{outcome.summary}</p>
      {outcome.items.length > 0 && (
        <dl className="m-0 mt-5 grid gap-px border-y border-ink bg-rule sm:grid-cols-2">
          {outcome.items.map((o, i) => (
            <div
              key={`${i}-${o.label}`}
              className="bg-paper px-1 py-4 sm:px-4 sm:last:odd:col-span-2"
            >
              <dt className="text-[13px] text-muted">
                {o.label}
                <Cite ids={o.cite} />
              </dt>
              <dd className="m-0 mt-1 font-serif text-[1.25rem] font-bold leading-snug">
                {o.value}
              </dd>
              {o.note && (
                <dd className="m-0 mt-1 text-[13.5px] leading-relaxed text-ink-soft">
                  {o.note}
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}
      {outcome.pending && (
        <p className="m-0 mt-4 text-[14.5px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">언제 알 수 있나 · </span>
          {outcome.pending}
        </p>
      )}
    </div>
  )
}

const UNKNOWN_LABEL: Record<Unknown['status'], string> = {
  'not-yet': '아직 보지 못함',
  refused: '요청했는데 받지 못함',
}

interface NextStepsProps {
  unknowns: ReadonlyArray<Unknown>
  questions: ReadonlyArray<string>
  recommendations: Report['recommendations']
  actions: ReadonlyArray<Action>
  nextReview: Report['nextReview']
}

/** 다음에 무엇을: 아직 모르는 것, 시·의회에 할 일, 시민이 할 수 있는 일 */
export function NextSteps({
  unknowns,
  questions,
  recommendations,
  actions,
  nextReview,
}: NextStepsProps) {
  return (
    <div className="space-y-10">
      <Block title="아직 모르는 것">
        <ul className="m-0 list-none space-y-2 p-0">
          {unknowns.map((u, i) => (
            <li
              key={`${i}-${u.what}`}
              className="grid gap-x-3 text-[15px] leading-relaxed sm:grid-cols-[9.5rem_1fr]"
            >
              <span
                className={`self-start text-[13px] font-semibold ${u.status === 'refused' ? 'text-grade-poor' : 'text-muted'}`}
              >
                {UNKNOWN_LABEL[u.status]}
              </span>
              <span>
                {u.what}
                {u.when && <span className="text-ink-soft"> · {u.when}</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-3 text-[13px] text-muted">
          ‘아직 보지 못함’은 공개 자료에 없고 아직 정보공개청구를 하지 않았거나
          발표 전이라는 뜻입니다. 시가 숨겼다는 뜻은 아닙니다. 다음 갱신 예정:{' '}
          {formatDate(nextReview.date)}
        </p>
      </Block>

      <Block title="시와 의회가 할 일">
        <ul className="m-0 list-none space-y-2 p-0">
          {recommendations.map((r, i) => (
            <li
              key={`${i}-${r.what}`}
              className="grid gap-x-3 text-[15px] leading-relaxed sm:grid-cols-[9.5rem_1fr]"
            >
              <span className="text-[13px] font-semibold text-muted">
                {r.to}
              </span>
              <span>{r.what}</span>
            </li>
          ))}
        </ul>
        {questions.length > 0 && (
          <details className="mt-4 text-[14.5px]">
            <summary className="cursor-pointer text-accent">
              시와 의회에 물어야 할 것 {questions.length}가지
            </summary>
            <ol className="m-0 mt-2 list-decimal space-y-1.5 pl-5 leading-relaxed text-ink-soft">
              {questions.map((q, i) => (
                <li key={`${i}-${q}`}>{q}</li>
              ))}
            </ol>
          </details>
        )}
      </Block>

      <Block title="시민이 할 수 있는 일">
        <ol className="m-0 list-none space-y-5 p-0">
          {actions.map((a, i) => (
            <ActionItem key={`${i}-${a.title}`} action={a} />
          ))}
        </ol>
      </Block>
    </div>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="m-0 border-b border-ink pb-2 font-serif text-[1.1rem] font-bold">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function ActionItem({ action: a }: { action: Action }) {
  return (
    <li className="text-[15px] leading-relaxed">
      <p className="m-0 font-semibold">
        {a.url ? (
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2"
          >
            {a.title}
            <span className="sr-only"> (새 창)</span>
          </a>
        ) : (
          a.title
        )}
        {a.when && (
          <span className="ml-2 text-[13px] font-normal text-muted">
            {a.when}
          </span>
        )}
      </p>
      <p className="m-0 mt-1 text-ink-soft">{a.detail}</p>
      {a.copy && <CopyBox text={a.copy} />}
    </li>
  )
}

/** 청구서에 그대로 붙일 문장. 복사 버튼은 클라이언트에서만 동작하고, 글은 언제나 선택해 복사할 수 있다 */
function CopyBox({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')
  const copy = async () => {
    // 같은 결과를 두 번 내도 화면낭독기가 다시 읽도록 먼저 비운다
    setState('idle')
    try {
      await navigator.clipboard.writeText(text)
      setState('done')
    } catch {
      setState('failed')
    }
  }
  return (
    <div className="mt-2 border border-rule bg-sheet">
      <p className="m-0 whitespace-pre-line px-3 py-2 text-[14px] leading-relaxed">
        {text}
      </p>
      <div className="flex items-center justify-end gap-3 border-t border-rule px-3 py-1.5">
        <span role="status" className="text-[12.5px] text-muted">
          {state === 'done' && '복사했습니다'}
          {state === 'failed' && '복사하지 못했습니다. 글을 직접 선택해 주세요'}
        </span>
        <button
          type="button"
          onClick={copy}
          className="cursor-pointer rounded-[3px] border border-ink bg-transparent px-2.5 py-0.5 text-[13px] font-medium text-ink hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-accent"
        >
          청구 문구 복사
        </button>
      </div>
    </div>
  )
}
