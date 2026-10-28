// 작업 큐: 예약 실행 한 번이 작업 하나를 가져가(claim) 처리하고 끝낸다(done/fail).
// 가져간 작업은 lease 동안 다른 실행이 가져가지 못한다. lease가 지나면 다시 가져갈 수 있다.
import { TaskSchema } from './schemas'
import type { Stage, Task } from './schemas'
import { db, put } from './store'

const MAX_ATTEMPTS = 3

function nowIso(now: Date): string {
  return now.toISOString()
}

/** 새 작업을 큐에 넣는다. id는 단계-사업-시각 */
export async function enqueue(
  stage: Stage,
  program: string | undefined,
  inputs: ReadonlyArray<string>,
  now = new Date(),
): Promise<string> {
  const stamp = now.toISOString().replace(/\D/g, '').slice(0, 14)
  const id = [stage, program?.replace('.', '-'), stamp]
    .filter(Boolean)
    .join('-')
  const task: Task = {
    stage,
    program,
    status: 'queued',
    attempt: 0,
    inputs: [...inputs],
    outputs: [],
    createdAt: nowIso(now),
    updatedAt: nowIso(now),
  }
  await put(`tasks/${id}`, task)
  return id
}

function claimable(t: Task, now: Date): boolean {
  if (t.attempt >= MAX_ATTEMPTS) return false
  if (t.status === 'queued') return true
  return (
    t.status === 'running' && !!t.leaseUntil && new Date(t.leaseUntil) < now
  )
}

/** 단계의 가장 오래된 작업을 가져간다(사업을 주면 그 사업만). 없으면 undefined */
export async function claim(
  stage: Stage,
  leaseMinutes = 30,
  now = new Date(),
  program?: string,
): Promise<{ id: string; task: Task } | undefined> {
  const store = db()
  return store.runTransaction(async (tx) => {
    const snap = await tx.get(
      store
        .collection('tasks')
        .where('stage', '==', stage)
        .where('status', 'in', ['queued', 'running']),
    )
    const next = snap.docs
      .map((d) => ({ id: d.id, task: TaskSchema.parse(d.data()) }))
      .filter(({ task }) => !program || task.program === program)
      .filter(({ task }) => claimable(task, now))
      .sort((a, b) => a.task.createdAt.localeCompare(b.task.createdAt))
      .at(0)
    if (!next) return undefined
    const task: Task = {
      ...next.task,
      status: 'running',
      attempt: next.task.attempt + 1,
      leaseUntil: nowIso(new Date(now.getTime() + leaseMinutes * 60_000)),
      updatedAt: nowIso(now),
    }
    tx.set(store.doc(`tasks/${next.id}`), TaskSchema.parse(task))
    return { id: next.id, task }
  })
}

async function finish(id: string, change: (t: Task) => Task): Promise<Task> {
  const store = db()
  const ref = store.doc(`tasks/${id}`)
  return store.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new Error(`작업 없음: ${id}`)
    const current = TaskSchema.parse(snap.data())
    if (current.status !== 'running')
      throw new Error(`실행 중이 아닌 작업: ${id} (${current.status})`)
    const next = TaskSchema.parse(change(current))
    tx.set(ref, next)
    return next
  })
}

/** 끝낸 작업에 남긴 산출물 경로를 적는다 */
export function done(
  id: string,
  outputs: ReadonlyArray<string>,
  now = new Date(),
): Promise<Task> {
  return finish(id, (t) => ({
    ...t,
    status: 'done',
    outputs: [...t.outputs, ...outputs],
    leaseUntil: undefined,
    error: undefined,
    updatedAt: nowIso(now),
  }))
}

/** 실패를 기록한다. 시도 횟수가 남았으면 다시 큐로 돌린다 */
export function fail(
  id: string,
  error: string,
  now = new Date(),
): Promise<Task> {
  return finish(id, (t) => ({
    ...t,
    status: t.attempt >= MAX_ATTEMPTS ? 'failed' : 'queued',
    leaseUntil: undefined,
    error,
    updatedAt: nowIso(now),
  }))
}
