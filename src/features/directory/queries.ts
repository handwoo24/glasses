// 홈 · 지역/부처 탭 · 기관 페이지의 쿼리. 로더는 ensureQueryData, 화면은 useSuspenseQuery로 같은 옵션을 쓴다.
// 서버 함수가 null을 주면(레지스트리에 없는 기관) notFound로 바꾼다. 그래서 data는 늘 값이 있다.
import { queryOptions } from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import {
  fetchHome,
  fetchMinistries,
  fetchOrgPage,
  fetchRegion,
} from './server/directory.functions'

export const homeQuery = (sido?: string, ministry?: string) =>
  queryOptions({
    queryKey: ['home', { sido, ministry }],
    queryFn: () => fetchHome({ data: { sido, ministry } }),
  })

export const regionQuery = (sido?: string) =>
  queryOptions({
    queryKey: ['regions', { sido }],
    queryFn: () => fetchRegion({ data: { sido } }),
  })

export const ministriesQuery = () =>
  queryOptions({
    queryKey: ['ministries'],
    queryFn: () => fetchMinistries(),
  })

export const orgPageQuery = (org: string) =>
  queryOptions({
    queryKey: ['orgs', org, 'page'],
    queryFn: async () => {
      const data = await fetchOrgPage({ data: { org } })
      if (!data) throw notFound()
      return data
    },
  })
