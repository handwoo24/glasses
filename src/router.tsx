import {
  createRouter as createTanStackRouter,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { getContext } from './integrations/tanstack-query/root-provider'

/**
 * 시도·기관 코드처럼 숫자로만 된(15자리까지) 문자열은 따옴표 없이 쓴다(?sido=41, 기본 동작은 ?sido=%2241%22).
 * 읽을 때는 숫자가 되지만 각 주소의 검색 조건 양식이 z.coerce.string()으로 다시 문자열로 바꾼다
 */
function digitsStayRaw(value: string): unknown {
  // 15자리를 넘는 숫자는 숫자로 읽으면 정밀도를 잃으므로 기본 동작(따옴표)대로 둔다
  if (/^\d{1,15}$/.test(value)) throw new Error('숫자 문자열은 그대로 쓴다')
  return JSON.parse(value)
}

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    parseSearch: parseSearchWith(JSON.parse),
    stringifySearch: stringifySearchWith(JSON.stringify, digitsStayRaw),
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
