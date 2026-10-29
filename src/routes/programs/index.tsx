import { createFileRoute, redirect } from '@tanstack/react-router'

/** 사업 목록은 홈 지도와 지역·부처 탭으로 옮겼다. 옛 주소는 홈으로 */
export const Route = createFileRoute('/programs/')({
  beforeLoad: () => {
    throw redirect({ to: '/', statusCode: 301 })
  },
})
