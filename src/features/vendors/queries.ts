// 업체 리포트 한 건의 쿼리. 로더는 ensureQueryData, 화면은 useSuspenseQuery로 같은 옵션을 쓴다.
// 서버 함수가 null을 주면(게시하지 않은 업체 리포트) notFound로 바꾼다. 그래서 data는 늘 값이 있다.
import { queryOptions } from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import { fetchVendorReport } from './server/vendor-docs.functions'

export const vendorReportQuery = (subject: string) =>
  queryOptions({
    queryKey: ['vendor-reports', subject],
    queryFn: async () => {
      const doc = await fetchVendorReport({ data: { subject } })
      if (!doc) throw notFound()
      return doc
    },
  })
