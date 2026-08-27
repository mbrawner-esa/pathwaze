'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// NOTE: this component is not currently rendered anywhere. Colours kept in step
// with StageBadge so it is not a landmine if it is ever wired up; delete the
// file instead if the chart is not coming back.
const STAGE_COLORS: Record<string, string> = {
  'Pre-Planning': '#3b82f6',
  'Design Development': '#0ea5e9',
  'Pre-NTP': '#06b6d4',
  'Closing': '#a855f7',
  'NTP': '#ec4899',
  'Pre-Construction': '#f59e0b',
  'Construction': '#f97316',
  'Post Construction': '#eab308',
  'Operation': '#22c55e',
  'On Hold': '#6366f1',
}

export function PipelineChart({ data }: { data: { stage: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} />
        <YAxis type="category" dataKey="stage" tick={{ fontSize: 12, fill: '#70A0D0' }} width={80} />
        <Tooltip
          formatter={(value) => [`${value} projects`, '']}
          contentStyle={{ fontSize: 12, border: '1px solid #f1f5f9', borderRadius: 8 }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map(entry => (
            <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? '#70A0D0'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
