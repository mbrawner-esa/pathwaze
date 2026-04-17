const HEALTH_COLORS: Record<string, { bg: string; text: string }> = {
  'On Track': { bg: '#F0FDF4', text: '#166534' },
  'At Risk': { bg: '#FFFBEB', text: '#92400e' },
  'Delayed': { bg: '#FEF2F2', text: '#991b1b' },
  'TBD': { bg: '#F8FAFC', text: '#475569' },
}

export function DealHealthBadge({ health }: { health: string }) {
  const colors = HEALTH_COLORS[health] ?? { bg: '#F8FAFC', text: '#475569' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: colors.bg, color: colors.text }}>
      {health}
    </span>
  )
}
