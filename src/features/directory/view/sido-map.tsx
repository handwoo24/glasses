// 17개 시도 타일 지도. 홈·지역 탭·용역 탭이 같이 쓴다. 칸 안의 링크와 글자는 부르는 쪽이 정한다.
import type { ReactNode } from 'react'
import type { Distribution } from '../list'
import { SIDO_TILES } from '../regions'
import type { Tone } from '../regions'

interface SidoMapProps {
  /** 시도 코드마다 타일 색(class). 없으면 empty */
  tones: Readonly<Record<string, Tone | 'has'>>
  selected?: string
  size?: 'lg' | 'sm'
  label: string
  /** 타일 하나: 시도 코드·짧은 이름·class를 받아 링크를 그린다 */
  tile: (args: { code: string; short: string; className: string }) => ReactNode
}

export function SidoMap({
  tones,
  selected,
  size = 'lg',
  label,
  tile,
}: SidoMapProps) {
  return (
    <ul className={`sido-map ${size}`} aria-label={label}>
      {Object.entries(SIDO_TILES).map(([code, t]) => (
        <li key={code} style={{ gridColumn: t.col, gridRow: t.row }}>
          {tile({
            code,
            short: t.short,
            className: [
              'sido-tile',
              tones[code] ?? 'empty',
              code === selected ? 'on' : '',
            ]
              .filter(Boolean)
              .join(' '),
          })}
        </li>
      ))}
    </ul>
  )
}

/** 판정 분포 막대. 평가가 없으면 빈 막대 */
export function VerdictBar({
  verdicts,
  className = '',
}: {
  verdicts: Distribution
  className?: string
}) {
  const total =
    verdicts.fix + verdicts.watch + verdicts['on-track'] + verdicts.unknown
  return (
    <span
      className={`dist ${className}`}
      role="img"
      aria-label={
        total
          ? `개선 필요 ${verdicts.fix}, 지켜볼 점 ${verdicts.watch}, 순항 ${verdicts['on-track']}, 판단 불가 ${verdicts.unknown}`
          : '평가 없음'
      }
    >
      {verdicts.fix > 0 && (
        <span className="bad" style={{ flex: verdicts.fix }} />
      )}
      {verdicts.watch > 0 && (
        <span className="warn" style={{ flex: verdicts.watch }} />
      )}
      {verdicts['on-track'] > 0 && (
        <span className="ok" style={{ flex: verdicts['on-track'] }} />
      )}
      {verdicts.unknown > 0 && (
        <span className="none" style={{ flex: verdicts.unknown }} />
      )}
    </span>
  )
}

export function MapKey() {
  return (
    <p className="map-key">
      <span>
        <i className="hot" />
        개선 필요가 절반 넘음
      </span>
      <span>
        <i className="warm" />
        평가함
      </span>
      <span>
        <i className="list" />
        목록만, 평가 전
      </span>
      <span>
        <i className="empty" />
        목록 전
      </span>
    </p>
  )
}
