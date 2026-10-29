import { createFileRoute } from '@tanstack/react-router'
import { ProgramsSearchSchema } from '#/features/directory/list'
import { fetchDirectory } from '#/features/directory/server/directory.functions'
import { ProgramsPage } from '#/features/directory/view/programs-page'

/** 사업 목록: /programs?region=&ministry=&field=&verdict=&kind=&sort= */
export const Route = createFileRoute('/programs/')({
  validateSearch: ProgramsSearchSchema,
  loader: async () => ({
    data: await fetchDirectory(),
    today: new Date().toLocaleDateString('sv-SE'),
  }),
  head: () => ({
    meta: [
      { title: '사업 목록 · glasses' },
      {
        name: 'description',
        content: '지역·부처·분야·판정으로 고르는 glasses 평가 사업 목록',
      },
    ],
  }),
  component: Programs,
})

function Programs() {
  const { data, today } = Route.useLoaderData()
  return <ProgramsPage data={data} search={Route.useSearch()} today={today} />
}
