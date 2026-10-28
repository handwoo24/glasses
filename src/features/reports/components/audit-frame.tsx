import { formatDate, formatKrwThousand } from '../format'
import type { CityResponse, Report, Scope } from '../schema'
import { Cite } from './cite'

/** 점검 범위: 무엇을, 언제 기준 자료로 보았고, 무엇을 보지 못했나 */
export function ScopeBox({ scope }: { scope: Scope }) {
  return (
    <dl className="m-0 grid gap-x-6 gap-y-4 border border-rule bg-sheet px-5 py-4 text-[14px] leading-relaxed sm:grid-cols-[7rem_1fr]">
      <dt className="text-muted">점검 범위</dt>
      <dd className="m-0">{scope.covers}</dd>
      {scope.total !== undefined && (
        <>
          <dt className="text-muted">대상 금액</dt>
          <dd className="m-0">
            {formatKrwThousand(scope.total / 1000)}
            {scope.totalLabel && (
              <span className="text-ink-soft"> · {scope.totalLabel}</span>
            )}
          </dd>
        </>
      )}
      <dt className="text-muted">자료 기준일</dt>
      <dd className="m-0">
        <ul className="m-0 list-none space-y-0.5 p-0">
          {scope.asOf.map((a, i) => (
            <li key={`${i}-${a.what}`}>
              {a.what}{' '}
              <span className="text-ink-soft">{formatDate(a.date)}</span>
            </li>
          ))}
        </ul>
      </dd>
      {scope.notChecked.length > 0 && (
        <>
          <dt className="text-muted">확인하지 못한 것</dt>
          <dd className="m-0">
            <ul className="m-0 list-disc space-y-0.5 pl-4 text-ink-soft">
              {scope.notChecked.map((n, i) => (
                <li key={`${i}-${n}`}>{n}</li>
              ))}
            </ul>
          </dd>
        </>
      )}
    </dl>
  )
}

const RESPONSE_LABEL: Record<CityResponse['status'], string> = {
  'not-asked': '시에 아직 묻지 않았습니다',
  asked: '시에 질의했고 답을 기다립니다',
  answered: '시의 답변을 받았습니다',
  'no-answer': '시에 질의했지만 답이 없었습니다',
}

/** 피감기관(시)의 해명: 우리가 물었는지, 그리고 시가 공식 석상에서 이미 한 설명 */
export function CityResponsePanel({ response }: { response: CityResponse }) {
  return (
    <div>
      <p className="m-0 text-[15px] font-semibold">
        {RESPONSE_LABEL[response.status]}
        {response.asked && (
          <span className="ml-2 text-[13px] font-normal text-muted">
            질의일 {formatDate(response.asked)}
          </span>
        )}
      </p>
      <p className="m-0 mt-1 text-[14.5px] leading-relaxed text-ink-soft">
        {response.note}
      </p>
      {response.items.length > 0 && (
        <dl className="m-0 mt-5 divide-y divide-rule border-y border-ink">
          {response.items.map((it, i) => (
            <div
              key={`${i}-${it.topic}`}
              className="grid gap-x-4 gap-y-1 py-3.5 sm:grid-cols-[11rem_1fr]"
            >
              <dt className="text-[14px] font-semibold">{it.topic}</dt>
              <dd className="m-0 text-[14.5px] leading-[1.75] text-ink-soft">
                {it.said}
                <Cite ids={it.cite} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

interface NextReviewProps {
  nextReview: Report['nextReview']
}

/** 다음 갱신 때 다시 볼 것 */
export function NextReview({ nextReview }: NextReviewProps) {
  return (
    <div className="mt-4 border border-rule px-4 py-3">
      <p className="m-0 text-[13px] text-muted">
        다음 갱신 예정{' '}
        <span className="font-semibold text-ink">
          {formatDate(nextReview.date)}
        </span>
        에 다시 볼 것
      </p>
      <ul className="m-0 mt-2 list-disc space-y-1 pl-4 text-[14.5px] leading-relaxed text-ink-soft">
        {nextReview.items.map((item, i) => (
          <li key={`${i}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
