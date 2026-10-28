import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Chart } from '../schema'
import { ChartFrame, Legend, TooltipBox } from './chart-frame'
import {
  AXIS_TEXT,
  DOWN,
  GRID,
  HIGHLIGHT,
  NEUTRAL,
  SERIES,
  UP,
} from './palette'
import { formatFull, formatShort } from './units'
import type { ChartUnit } from './units'

const ROW = 34
const LABEL_W = 128
const TICK = { fill: AXIS_TEXT, fontSize: 12 }
// SSR에서도 크기를 갖고 그려지도록 초기 크기를 준다 (클라이언트에서 실제 폭으로 다시 잰다)
const INITIAL = { width: 640, height: 200 }

function heightFor(rows: number, groups = 1): number {
  return Math.max(rows * ROW * Math.max(1, groups * 0.7), 120) + 36
}

interface Payload {
  payload?: Record<string, unknown>
}

export function ReportChart({ chart }: { chart: Chart }) {
  switch (chart.type) {
    case 'bar':
      return <RankedBar chart={chart} />
    case 'diverging':
      return <DivergingBar chart={chart} />
    case 'grouped':
      return <GroupedBar chart={chart} />
    case 'share':
      return <ShareBar chart={chart} />
  }
}

const VALUE_LABEL = {
  'krw-thousand': '금액',
  krw: '금액',
  count: '수',
  percent: '비율',
} as const

function RankedBar({ chart }: { chart: Extract<Chart, { type: 'bar' }> }) {
  const data = chart.ordered
    ? chart.data
    : [...chart.data].sort((a, b) => b.value - a.value)
  const hi = new Set(chart.highlight ?? [])
  const domain = paddedDomain(data.map((d) => d.value))
  return (
    <ChartFrame
      title={chart.title}
      caption={chart.caption}
      cite={chart.cite}
      columns={[
        { label: '항목' },
        { label: VALUE_LABEL[chart.unit], align: 'right' },
      ]}
      rows={data.map((d) => [d.label, formatFull(d.value, chart.unit)])}
    >
      <ResponsiveContainer
        width="100%"
        height={heightFor(data.length)}
        initialDimension={INITIAL}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 0, right: 72, top: 4, bottom: 4 }}
          barCategoryGap={6}
        >
          <CartesianGrid
            horizontal={false}
            stroke={GRID}
            strokeDasharray="2 4"
          />
          <XAxis
            type="number"
            domain={domain}
            ticks={niceTicks(domain)}
            tick={TICK}
            tickFormatter={(v: number) => formatShort(v, chart.unit)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={LABEL_W}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-rule)', fillOpacity: 0.35 }}
            content={({ active, payload }) => {
              const p = (payload[0] as Payload | undefined)?.payload
              if (!active || !p) return null
              return (
                <TooltipBox
                  title={String(p.label)}
                  lines={[
                    {
                      label: VALUE_LABEL[chart.unit],
                      value: formatFull(Number(p.value), chart.unit),
                    },
                  ]}
                />
              )
            }}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            minPointSize={2}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell
                key={d.label}
                fill={hi.has(d.label) ? HIGHLIGHT : NEUTRAL}
              />
            ))}
            <LabelList
              dataKey="value"
              content={(props) => (
                <SignedLabel
                  {...(props as LabelProps)}
                  text={formatShort(Number(props.value), chart.unit)}
                />
              )}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

function DivergingBar({
  chart,
}: {
  chart: Extract<Chart, { type: 'diverging' }>
}) {
  const data = chart.data
  const domain = paddedDomain(data.map((d) => d.value))
  return (
    <ChartFrame
      title={chart.title}
      caption={chart.caption}
      cite={chart.cite}
      legend={
        <Legend
          items={[
            { label: '증가', color: UP },
            { label: '감소', color: DOWN },
          ]}
        />
      }
      columns={[{ label: '항목' }, { label: '증감', align: 'right' }]}
      rows={data.map((d) => [d.label, formatFull(d.value, chart.unit, true)])}
    >
      <ResponsiveContainer
        width="100%"
        height={heightFor(data.length)}
        initialDimension={INITIAL}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 0, right: 72, top: 4, bottom: 4 }}
          barCategoryGap={6}
        >
          <CartesianGrid
            horizontal={false}
            stroke={GRID}
            strokeDasharray="2 4"
          />
          <XAxis
            type="number"
            domain={domain}
            ticks={niceTicks(domain)}
            tick={TICK}
            tickFormatter={(v: number) => formatShort(v, chart.unit)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={LABEL_W}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <ReferenceLine x={0} stroke="var(--color-ink-soft)" />
          <Tooltip
            cursor={{ fill: 'var(--color-rule)', fillOpacity: 0.35 }}
            content={({ active, payload }) => {
              const p = (payload[0] as Payload | undefined)?.payload
              if (!active || !p) return null
              return (
                <TooltipBox
                  title={String(p.label)}
                  lines={[
                    {
                      label: '증감',
                      value: formatFull(Number(p.value), chart.unit, true),
                    },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="value" isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.value >= 0 ? UP : DOWN} />
            ))}
            <LabelList
              dataKey="value"
              content={(props) => (
                <SignedLabel
                  {...(props as LabelProps)}
                  text={formatFull(Number(props.value), chart.unit, true)}
                />
              )}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

interface LabelProps {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  value?: unknown
}

/** 감소는 막대 왼쪽 끝 바깥에, 증가는 오른쪽 끝 바깥에 값을 붙인다 */
function SignedLabel({
  x,
  y,
  width,
  height,
  value,
  text,
}: LabelProps & { text: string }) {
  const nx = Number(x)
  const nw = Number(width)
  const left = Math.min(nx, nx + nw)
  const right = Math.max(nx, nx + nw)
  const negative = Number(value) < 0
  return (
    <text
      x={negative ? left - 6 : right + 6}
      y={Number(y) + Number(height) / 2}
      dy="0.35em"
      textAnchor={negative ? 'end' : 'start'}
      fill="var(--color-ink-soft)"
      fontSize={12}
    >
      {text}
    </text>
  )
}

/** 0을 포함하는 1·2·5 단위의 반듯한 눈금 */
function niceTicks([lo, hi]: [number, number]): Array<number> {
  const raw = (hi - lo) / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag
  const ticks: Array<number> = []
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t)
  return ticks
}

/** 막대 끝 바깥에 붙는 값 글자가 들어갈 자리를 축 양쪽에 남긴다 */
function paddedDomain(values: ReadonlyArray<number>): [number, number] {
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const span = max - min
  return [min < 0 ? min - span * 0.45 : 0, max > 0 ? max + span * 0.3 : 0]
}

type Grouped = Extract<Chart, { type: 'grouped' | 'share' }>

function flatten(chart: Grouped) {
  return chart.data.map((d) => ({ label: d.label, ...d.values }))
}

function seriesTooltip(chart: Grouped, unit: ChartUnit, share: boolean) {
  return ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: ReadonlyArray<Payload>
  }) => {
    const p = payload?.[0]?.payload
    if (!active || !p) return null
    const total = chart.series.reduce((s, x) => s + Number(p[x.key] ?? 0), 0)
    return (
      <TooltipBox
        title={String(p.label)}
        lines={chart.series.map((s, i) => {
          const v = Number(p[s.key] ?? 0)
          const pct = total ? ` (${Math.round((v / total) * 1000) / 10}%)` : ''
          return {
            label: s.label,
            value: `${formatFull(v, unit)}${share ? pct : ''}`,
            color: SERIES[i],
          }
        })}
      />
    )
  }
}

function GroupedBar({ chart }: { chart: Extract<Chart, { type: 'grouped' }> }) {
  const data = flatten(chart)
  const domain = paddedDomain(
    chart.data.flatMap((d) => chart.series.map((s) => d.values[s.key] ?? 0)),
  )
  return (
    <ChartFrame
      title={chart.title}
      caption={chart.caption}
      cite={chart.cite}
      legend={
        <Legend
          items={chart.series.map((s, i) => ({
            label: s.label,
            color: SERIES[i],
          }))}
        />
      }
      columns={[
        { label: '항목' },
        ...chart.series.map((s) => ({
          label: s.label,
          align: 'right' as const,
        })),
      ]}
      rows={chart.data.map((d) => [
        d.label,
        ...chart.series.map((s) =>
          formatFull(d.values[s.key] ?? 0, chart.unit),
        ),
      ])}
    >
      <ResponsiveContainer
        width="100%"
        height={heightFor(data.length, chart.series.length)}
        initialDimension={INITIAL}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 0, right: 72, top: 4, bottom: 4 }}
          barCategoryGap={10}
          barGap={2}
        >
          <CartesianGrid
            horizontal={false}
            stroke={GRID}
            strokeDasharray="2 4"
          />
          <XAxis
            type="number"
            domain={domain}
            ticks={niceTicks(domain)}
            tick={TICK}
            tickFormatter={(v: number) => formatShort(v, chart.unit)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={LABEL_W}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-rule)', fillOpacity: 0.35 }}
            content={seriesTooltip(chart, chart.unit, false)}
          />
          {chart.series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={SERIES[i]}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            >
              <LabelList
                dataKey={s.key}
                position="right"
                fill="var(--color-ink-soft)"
                fontSize={11.5}
                formatter={(v: unknown) => formatShort(Number(v), chart.unit)}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

function ShareBar({ chart }: { chart: Extract<Chart, { type: 'share' }> }) {
  // 각 행을 100%로 맞춘 비율 막대
  const data = chart.data.map((d) => {
    const total = chart.series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0)
    const pct = Object.fromEntries(
      chart.series.map((s) => [
        s.key,
        total ? ((d.values[s.key] ?? 0) / total) * 100 : 0,
      ]),
    )
    return { label: d.label, ...pct }
  })
  return (
    <ChartFrame
      title={chart.title}
      caption={chart.caption}
      cite={chart.cite}
      legend={
        <Legend
          items={chart.series.map((s, i) => ({
            label: s.label,
            color: SERIES[i],
          }))}
        />
      }
      columns={[
        { label: '항목' },
        ...chart.series.map((s) => ({
          label: s.label,
          align: 'right' as const,
        })),
      ]}
      rows={data.map((d) => [
        d.label,
        ...chart.series.map((s) =>
          formatFull(Number((d as Record<string, unknown>)[s.key]), 'percent'),
        ),
      ])}
    >
      <ResponsiveContainer
        width="100%"
        height={heightFor(data.length)}
        initialDimension={INITIAL}
      >
        <BarChart
          data={data}
          layout="vertical"
          stackOffset="expand"
          margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
          barCategoryGap={8}
        >
          <XAxis
            type="number"
            tick={TICK}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={LABEL_W}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-rule)', fillOpacity: 0.35 }}
            content={seriesTooltip(
              {
                ...chart,
                data: data.map((d) => ({
                  label: d.label,
                  values: d as unknown as Record<string, number>,
                })),
              },
              'percent',
              false,
            )}
          />
          {chart.series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="share"
              fill={SERIES[i]}
              stroke="var(--color-paper)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              <LabelList
                dataKey={s.key}
                position="center"
                fill="#fff"
                fontSize={11.5}
                fontWeight={600}
                formatter={(v: unknown) =>
                  Number(v) >= 9 ? `${Math.round(Number(v))}%` : ''
                }
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
