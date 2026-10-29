# 데이터 읽기: 로더 `queryClient.query` + 화면 `useSuspenseQuery`

라우트는 서버 함수를 직접 부르지 않고 TanStack Query를 거친다. SSR에서 로더가 채운 쿼리 캐시는
`setupRouterSsrQueryIntegration`(`src/router.tsx`)이 HTML에 실어 보내고 브라우저에서 그대로 이어 쓴다.

```
서버 함수 (features/*/server/*.functions.ts)       ← 그대로. 검증 · Firestore 읽기 · null 반환
   ↑ queryFn
쿼리 옵션 (features/*/queries.ts)                   ← 키 + queryFn. null이면 notFound()
   ↑ 같은 옵션
로더: queryClient.query(옵션)                   ← SSR에서 미리 채우고 404 · redirect를 정한다
화면: useSuspenseQuery(옵션).data                   ← 늘 값이 있다 (undefined · null 없음)
```

## 규칙

1. **쿼리 옵션은 기능 폴더의 `queries.ts`에 둔다.** 서버 함수를 가진 기능이 옵션도 가진다.
   `queryOptions`를 돌려주는 함수로 만들고 인자는 키에 그대로 넣는다.
2. **없는 대상은 queryFn에서 `throw notFound()`로 바꾼다.** 서버 함수는 `null`을 그대로 둔다.
   그래서 `data` 타입에 `null`이 없고, 로더에서 던지면 라우터가 `notFoundComponent`를 그린다.
3. **로더는 `queryClient.query(옵션)`으로 채운다.** 60초 안에 읽은 것이 캐시에 있으면 그대로
   쓰고, 아니면 서버에서 읽을 때까지 기다린다. `ensureQueryData`는 5.105에서 deprecated이고,
   대체인 `staleTime: 'static'`은 쓰지 않는다. 쓰면 5분(gcTime) 동안 옛 캐시로 `head`를 만들고,
   그 사이 내려간 리포트도 404가 되지 않는다.
4. **로더는 쿼리 데이터를 반환하지 않는다.** 반환값은 `loaderData`로 직렬화되므로 쿼리 캐시와
   같은 데이터가 HTML에 두 번 실린다(리포트 원문이면 수백 KB). 목록은 `await`만 하고, 상세는
   `head`에 쓸 제목 · 숫자만 작은 객체로 돌려준다(리포트는 `headFields(doc)`).
5. **주소 형식 검사는 로더에서 쿼리보다 먼저 한다.** 형식이 틀린 주소로 서버 함수를 부르지
   않는다(서버 함수의 zod 검증은 그대로 둔다).
6. **화면은 `useSuspenseQuery(같은 옵션)`으로 읽는다.** 인자는 `Route.useParams()`나
   `Route.useLoaderDeps()`에서 다시 꺼낸다. `useLoaderData`로 쿼리 데이터를 받지 않는다.
7. **가져오지 않는 값은 `loaderData`에 둬도 된다.** 예: `today`(서버와 브라우저가 같은 날짜를
   쓰게 로더에서 한 번 정한다).
8. **서버가 검색 파라미터로 거르면 `loaderDeps`와 키에 넣는다**(홈의 `sido`·`ministry`,
   지역 탭의 `sido`). 화면에서만 거르는 파라미터(용역 탭 필터, 작업 현황 정렬)는 넣지 않는다.
   필터를 바꿔도 다시 읽지 않는다.
9. **`staleTime`은 60초**(`root-provider.tsx`). 서버 읽기 캐시 TTL과 같다. 0이면 하이드레이션
   직후 브라우저가 같은 것을 다시 읽는다. 라우터의 `defaultPreloadStaleTime: 0`은 그대로 둔다.
   로더는 매번 돌고, 다시 읽을지는 쿼리 캐시가 정한다. 재시도는 브라우저에서만 3번까지 하고,
   notFound는 재시도하지 않는다.

## 예시

목록 (`routes/vendors/index.tsx`):

```tsx
loader: async ({ context }) => {
  await context.queryClient.query(vendorListQuery())
},
component: () => {
  const { items } = useSuspenseQuery(vendorListQuery()).data
  …
}
```

상세 (`routes/programs/$programId.tsx`):

```tsx
loader: async ({ context, params }) => {
  const subject = `programs/${params.programId}`
  if (!SUBJECT_PATH.test(subject)) throw notFound()
  const doc = await context.queryClient.query(reportBySubjectQuery(subject))
  return headFields(doc)
},
head: ({ loaderData }) => reportHead(loaderData),
component: () => {
  const { programId } = Route.useParams()
  const { data } = useSuspenseQuery(reportBySubjectQuery(`programs/${programId}`))
  …
}
```

## 쿼리 키

| 키                                | 옵션                   | 서버 함수              | 라우트                                                   |
| --------------------------------- | ---------------------- | ---------------------- | -------------------------------------------------------- |
| `['home', { sido, ministry }]`    | `homeQuery`            | `fetchHome`            | `/`                                                      |
| `['regions', { sido }]`           | `regionQuery`          | `fetchRegion`          | `/orgs?view=regions`                                     |
| `['ministries']`                  | `ministriesQuery`      | `fetchMinistries`      | `/orgs?view=ministries`                                  |
| `['orgs', org, 'page']`           | `orgPageQuery`         | `fetchOrgPage`         | `/orgs/$orgId`                                           |
| `['orgs', org, 'worklist']`       | `orgWorklistQuery`     | `fetchOrgWorklist`     | `/orgs/$orgId/programs`                                  |
| `['reports', 'subject', subject]` | `reportBySubjectQuery` | `fetchReportBySubject` | `/programs/$programId`, `/orgs/$orgId/budgets/$budgetId` |
| `['reports', 'slug', slug]`       | `reportBySlugQuery`    | `fetchReportDoc`       | `/reports/$slug` (subject가 있으면 로더에서 301)         |
| `['vendors', 'list']`             | `vendorListQuery`      | `fetchVendorList`      | `/vendors`                                               |
| `['vendors', 'page', bizno]`      | `vendorPageQuery`      | `fetchVendorPage`      | `/vendors/$bizno`                                        |
| `['vendor-reports', subject]`     | `vendorReportQuery`    | `fetchVendorReport`    | `/programs/$programId_/vendors/$bizno`                   |

데이터를 읽지 않는 라우트: `/method`, `/programs`(홈으로 301).
