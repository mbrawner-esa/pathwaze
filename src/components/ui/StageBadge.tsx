const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Archived':              { bg: '#F1F5F9', text: '#475569', dot: '#94a3b8' },
  'Pre-Planning':          { bg: '#EFF6FF', text: '#1d4ed8', dot: '#3b82f6' },
  'Design Development':    { bg: '#E0F2FE', text: '#0369a1', dot: '#0ea5e9' },
  'Bidding':               { bg: '#EEF2FF', text: '#3730a3', dot: '#6366f1' },
  'Late Stage Development':{ bg: '#FDF4FF', text: '#7e22ce', dot: '#a855f7' },
  'Pre-Closing':           { bg: '#FCE7F3', text: '#9d174d', dot: '#ec4899' },
  'NTP':                   { bg: '#FFEDD5', text: '#9a3412', dot: '#f97316' },
  'Pre-Construction':      { bg: '#FFFBEB', text: '#92400e', dot: '#f59e0b' },
  'Active Construction':   { bg: '#FEF2F2', text: '#991b1b', dot: '#ef4444' },
  'Post Construction':     { bg: '#FFF7ED', text: '#c2410c', dot: '#fb923c' },
  'Closeout':              { bg: '#FEFCE8', text: '#854d0e', dot: '#eab308' },
  'Operating':             { bg: '#F0FDF4', text: '#166534', dot: '#22c55e' },
}

export function StageBadge({ stage }: { stage: string }) {
  const colors = STAGE_COLORS[stage] ?? { bg: '#F1F5F9', text: '#475569', dot: '#94a3b8' }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.dot }} />
      {stage}
    </span>
  )
}
