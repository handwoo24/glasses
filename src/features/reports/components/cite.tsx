import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Source } from '../schema'

type CiteSource = Pick<Source, 'id' | 'kind' | 'org' | 'title'>

interface CiteEntry {
  n: number
  label: string
  title: string
}

const CiteContext = createContext<ReadonlyMap<string, CiteEntry>>(new Map())

/** ‘기타’ 출처는 발행처로 짧은 이름을 붙인다. 양식에 짧은 종류명이 생기면 그것을 쓴다 */
const OTHER_KINDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/지방재정365/, '재정365'],
  [/법제처|법령/, '법령'],
  [/감사/, '감사'],
]

/** 출처 칩에 쓰는 종류 이름: 회의록 · 공고 · 재정365 … */
export function citeKind({ kind, org }: Pick<Source, 'kind' | 'org'>): string {
  if (kind !== '기타') return kind
  return OTHER_KINDS.find(([re]) => re.test(org))?.[1] ?? '자료'
}

interface CiteProviderProps {
  sources: ReadonlyArray<CiteSource>
  children: ReactNode
}

/** source id(s1…)를 화면 번호(1…)와 칩 이름으로 바꿔 준다 */
export function CiteProvider({ sources, children }: CiteProviderProps) {
  const map = useMemo(
    () =>
      new Map(
        sources.map((s, i) => [
          s.id,
          { n: i + 1, label: citeKind(s), title: s.title },
        ]),
      ),
    [sources],
  )
  return <CiteContext.Provider value={map}>{children}</CiteContext.Provider>
}

/** 출처 칩의 이름과 번호 (출처 목록에서도 쓴다) */
export function useCiteEntry(id: string): CiteEntry {
  const entry = useContext(CiteContext).get(id)
  if (!entry)
    throw new Error(`없는 출처: ${id} (CiteProvider의 출처 목록에 없음)`)
  return entry
}

interface CiteProps {
  ids?: ReadonlyArray<string>
}

/** 문장 끝 출처 칩(‘회의록 6’). 출처 목록의 #src-<번호>로 간다 */
export function Cite({ ids = [] }: CiteProps) {
  const map = useContext(CiteContext)
  if (ids.length === 0) return null
  return (
    <span className="cites">
      {/* 앞 글자와 첫 칩 사이에서 줄이 바뀌지 않게 */}
      {'⁠'}
      {ids.map((id, i) => {
        const e = map.get(id)
        if (!e)
          throw new Error(`없는 출처: ${id} (CiteProvider의 출처 목록에 없음)`)
        return (
          <a
            key={`${i}-${id}`}
            className="cite"
            href={`#src-${e.n}`}
            title={e.title}
            aria-label={`출처 ${e.n}: ${e.title}`}
          >
            {e.label} {e.n}
          </a>
        )
      })}
    </span>
  )
}
