// 작업 현황 · 용역 탭 · 업체 페이지의 쿼리. 로더는 ensureQueryData, 화면은 useSuspenseQuery로 같은 옵션을 쓴다.
// 서버 함수가 null을 주면(레지스트리·카드에 없음) notFound로 바꾼다. 그래서 data는 늘 값이 있다.
import { queryOptions } from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import {
  fetchOrgWorklist,
  fetchVendorList,
  fetchVendorPage,
} from './server/worklist.functions'

export const orgWorklistQuery = (org: string) =>
  queryOptions({
    queryKey: ['orgs', org, 'worklist'],
    queryFn: async () => {
      const data = await fetchOrgWorklist({ data: { org } })
      if (!data) throw notFound()
      return data
    },
  })

export const vendorListQuery = () =>
  queryOptions({
    queryKey: ['vendors', 'list'],
    queryFn: () => fetchVendorList(),
  })

export const vendorPageQuery = (bizno: string) =>
  queryOptions({
    queryKey: ['vendors', 'page', bizno],
    queryFn: async () => {
      const data = await fetchVendorPage({ data: { bizno } })
      if (!data) throw notFound()
      return data
    },
  })
