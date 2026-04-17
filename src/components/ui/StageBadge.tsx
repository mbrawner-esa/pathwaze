const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Prospecting': { bg: '#EFF6FF', text: '#1d4ed8', dot: '#3b82f6' },
  'Proposal': { bg: '#FFF7ED', text: '#c2410c', dot: '#f97316' },
  'Contracting': { bg: '#FDF4FF', text: '#7e22ce', dot: '#a855f7' },
  'Permitting': { bg: '#FFFBEB', text: '#92400e', dot: '#f59e0b' },
  'Construction': { bg: '#FEF2F2', text: '#991b1b', dot: '#ef4444' },
  'Operations': { bg: '#F0FDF4', text: '#166534', dot: '#22c55e' },
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
