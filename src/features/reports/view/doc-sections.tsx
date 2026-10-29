// 리포트 종류(사업·재정 문서·업체)와 상관없이 같은 꼴인 구역: 아직 확인하지 못한 것, 더 알아보는 방법, 출처.
import type { ListItem } from 'mdast'
import type { UnknownItem } from '../assessment'
import { Cite, citeKind, useCiteEntry } from '../components/cite'
import { labelledItem } from '../doc/rich'
import { formatDate } from '../format'
import type { Source } from '../schema'
import { ExternalLink } from './report-page'
import { RequestBox } from './request-box'

export function UnknownList({
  unknowns,
}: {
  unknowns: ReadonlyArray<UnknownItem>
}) {
  return (
    <ul className="list">
      {unknowns.map((u, i) => (
        <li key={`${i}-${u.text}`}>
          <span className={u.requested ? 'k req' : 'k'}>{u.label}</span>
          <span>
            {u.text}
            <Cite ids={u.cite} />
          </span>
        </li>
      ))}
    </ul>
  )
}

export function ActionsBlock({
  request,
  moreActions,
  requestTo,
}: {
  request: string
  moreActions: ReadonlyArray<ListItem>
  /** 청구할 곳 안내 (이 사업을 맡은 기관) */
  requestTo: string
}) {
  return (
    <div className="rp-act">
      <div className="request">
        <p className="label">정보공개청구 문구</p>
        <RequestBox text={request} />
        <p className="cap">
          <ExternalLink href="https://www.open.go.kr/">
            정보공개포털
          </ExternalLink>
          에서 {requestTo}을 고르고 문구를 붙이면 됩니다.
        </p>
      </div>
      <ul className="list">
        {moreActions.map((it, i) => labelledItem(it, '그 밖의 방법', i))}
        <li>
          <span className="k">질의</span>
          <span>
            <ExternalLink href="https://www.epeople.go.kr/">
              국민신문고
            </ExternalLink>
            로 기관에 직접 물을 수 있습니다.
          </span>
        </li>
      </ul>
    </div>
  )
}

/** 출처를 인용한 곳으로 돌아가는 링크 */
export interface Backlink {
  href: string
  /** 화면에 보이는 짧은 표시 (①) */
  mark: string
  label: string
}

export function SourceList({
  sources,
  footNote,
  backlinks,
}: {
  sources: ReadonlyArray<Source>
  footNote: string
  backlinks: ReadonlyMap<string, ReadonlyArray<Backlink>>
}) {
  const kinds = new Map<string, number>()
  for (const s of sources)
    kinds.set(citeKind(s), (kinds.get(citeKind(s)) ?? 0) + 1)
  const byCount = [...kinds].sort((a, b) => b[1] - a[1])
  return (
    <>
      <div
        className="src-kinds"
        role="img"
        aria-label={`출처 종류: ${byCount.map(([k, n]) => `${k} ${n}`).join(', ')}`}
      >
        {byCount.map(([k, n], i) => (
          <span
            key={k}
            className={`k${Math.min(i, 4)}`}
            style={{ flexGrow: n }}
          >
            {k} {n}
          </span>
        ))}
      </div>
      <ol className="srcs">
        {sources.map((s) => (
          <SourceItem key={s.id} source={s} links={backlinks.get(s.id) ?? []} />
        ))}
      </ol>
      <p className="foot-note">
        {footNote} 초안은 AI(Claude)가 쓰고 숫자와 인용은 원문과 대조했습니다.
        틀린 내용은 알려 주세요.
      </p>
    </>
  )
}

function SourceItem({
  source: s,
  links,
}: {
  source: Source
  links: ReadonlyArray<Backlink>
}) {
  const { n, label } = useCiteEntry(s.id)
  return (
    <li id={`src-${n}`}>
      <span className="cite">
        {label} {n}
      </span>
      <span className="body">
        <ExternalLink href={s.url}>{s.title}</ExternalLink>
        <small>
          {s.org} · {formatDate(s.date)}
          {s.locator && ` · ${s.locator}`} · {s.license}
        </small>
      </span>
      {links.length > 0 && (
        <span className="used">
          인용{' '}
          {links.map((l) => (
            <a key={l.href} href={l.href} aria-label={l.label}>
              {l.mark}
            </a>
          ))}
        </span>
      )}
    </li>
  )
}
