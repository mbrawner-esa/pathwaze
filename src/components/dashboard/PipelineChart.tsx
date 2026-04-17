'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const STAGE_COLORS: Record<string, string> = {
  'Prospecting': '#3b82f6',
  'Proposal': '#f97316',
  'Contracting': '#a855f7',
  'Permitting': '#f59e0b',
  'Construction': '#ef4444',
  'Operations': '#22c55e',
}

export function PipelineChart({ data }: { data: { stage: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} />
        <YAxis type="category" dataKey="stage" tick={{ fontSize: 12, fill: '#6E879E' }} width={80} />
        <Tooltip
          formatter={(value) => [`${value} projects`, '']}
          contentStyle={{ fontSize: 12, border: '1px solid #f1f5f9', borderRadius: 8 }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map(entry => (
            <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? '#6E879E'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
