// Eleven stages. The nine pipeline phases run as a deliberate ramp — blues
// through development, ambers and oranges through construction, green once the
// system is operating — so a badge reads as a position in the lifecycle, not
// just a label. The two off-pipeline states sit outside that ramp: indigo for
// paused, grey for closed out.
const STAGE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Pre-Planning':       { bg: '#EFF6FF', text: '#1d4ed8', dot: '#3b82f6' },
  'Design Development': { bg: '#E0F2FE', text: '#0369a1', dot: '#0ea5e9' },
  'Pre-NTP':            { bg: '#ECFEFF', text: '#155e75', dot: '#06b6d4' },
  'Closing':            { bg: '#FDF4FF', text: '#7e22ce', dot: '#a855f7' },
  'NTP':                { bg: '#FCE7F3', text: '#9d174d', dot: '#ec4899' },
  'Pre-Construction':   { bg: '#FFFBEB', text: '#92400e', dot: '#f59e0b' },
  'Construction':       { bg: '#FFEDD5', text: '#9a3412', dot: '#f97316' },
  'Post Construction':  { bg: '#FEFCE8', text: '#854d0e', dot: '#eab308' },
  'Operation':          { bg: '#F0FDF4', text: '#166534', dot: '#22c55e' },

  'On Hold':            { bg: '#EEF2FF', text: '#3730a3', dot: '#6366f1' },
  'Archived':           { bg: '#F1F5F9', text: '#475569', dot: '#94a3b8' },
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
