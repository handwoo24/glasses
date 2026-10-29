// 판정 띠와 다음 판단 시간선 (시안 ‘판정·다음 판단 배치’ B안). 사업·재정 문서·업체 리포트가 같이 쓴다.
// 판정 띠에는 판정과 근거 수준만 둔다. 판정의 이유와 내용은 바로 아래 축 요약이 맡는다.
import { STATUS_INFO } from '../axes'
import type { AxisStatus, OverallEvidence } from '../axes'
import { STATUS_TONE } from '../assessment'
import type { NextDate } from '../report-doc'
import { DDay, OverallEvidenceMark } from './parts'

const METER: ReadonlyArray<AxisStatus> = ['on-track', 'watch', 'fix']

export function VerdictStrip({
  overall,
  evidence,
}: {
  overall: AxisStatus
  evidence: OverallEvidence
}) {
  const label = STATUS_INFO[overall].overall
  return (
    <section
      className={`vb-strip ${STATUS_TONE[overall]}`}
      id="verdict"
      aria-labelledby="t-verdict"
    >
      <h2 id="t-verdict" className="label">
        종합 판정
      </h2>
      <p className="big">{label}</p>
      <div
        className="meter"
        role="img"
        aria-label={`판정 미터: 순항, 지켜볼 점 있음, 개선 필요 가운데 ${label}`}
      >
        {METER.map((s) => (
          <span key={s} className={s === overall ? 'on' : undefined}>
            <i />
            {STATUS_INFO[s].overall}
          </span>
        ))}
      </div>
      <OverallEvidenceMark level={evidence} />
    </section>
  )
}

/** 다음 판단 시점을 앞으로 올 순서대로 시간선에 놓는다. 첫 날짜에 D-day */
export function NextTimeline({
  dates,
  nextReview,
}: {
  dates: ReadonlyArray<NextDate>
  nextReview: string
}) {
  return (
    <section className="vb-next" aria-labelledby="t-next">
      <div className="vb-next-h">
        <h2 id="t-next" className="label">
          다음 판단 시점
        </h2>
        <span className="foot">다음 갱신 예정 {nextReview}</span>
      </div>
      {dates.length > 0 && (
        <ol className="vb-tl">
          {dates.map((d, i) => (
            <li key={`${i}-${d.when}`}>
              <span className="when">
                {d.when} {i === 0 && <DDay date={d.date} />}
              </span>
              <span className="what">{d.what}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
