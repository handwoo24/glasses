// 리포트 한 건의 쿼리. 로더는 ensureQueryData, 화면은 useSuspenseQuery로 같은 옵션을 쓴다.
// 서버 함수가 null을 주면(게시하지 않은 리포트) notFound로 바꾼다. 그래서 data는 늘 값이 있다.
import { queryOptions } from '@tanstack/react-query'
import { notFound } from '@tanstack/react-router'
import {
  fetchReportBySubject,
  fetchReportDoc,
} from './server/report-docs.functions'

export const reportBySubjectQuery = (subject: string) =>
  queryOptions({
    queryKey: ['reports', 'subject', subject],
    queryFn: async () => {
      const doc = await fetchReportBySubject({ data: { subject } })
      if (!doc) throw notFound()
      return doc
    },
  })

export const reportBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ['reports', 'slug', slug],
    queryFn: async () => {
      const doc = await fetchReportDoc({ data: { slug } })
      if (!doc) throw notFound()
      return doc
    },
  })
