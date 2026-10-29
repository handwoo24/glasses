import { QueryClient, isServer } from '@tanstack/react-query'
import { isNotFound } from '@tanstack/react-router'

/** 서버 읽기 캐시(report-docs.server.ts의 TTL)와 맞춘다. 하이드레이션 직후 다시 읽지 않게 */
const STALE_MS = 60_000
/** 브라우저에서 다시 읽다 실패했을 때 재시도 횟수 (React Query 기본값) */
const CLIENT_RETRIES = 3

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_MS,
        // 없는 대상(notFound)은 다시 읽어도 없다. 서버에서는 재시도하지 않는다(기본 동작)
        retry: (failures, error) =>
          !isServer && !isNotFound(error) && failures < CLIENT_RETRIES,
      },
    },
  })

  return {
    queryClient,
  }
}
export default function TanstackQueryProvider() {}
