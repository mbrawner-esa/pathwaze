const COLORS: Record<string, string> = {
  'Morgan Brawner': '#2F3E50',
  'Sarah Chen': '#6E879E',
  'James Wright': '#E6C87A',
}

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const bg = COLORS[name] ?? '#6E879E'
  const textColor = bg === '#E6C87A' ? '#2F3E50' : '#fff'
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 ${sizeClass} ${className}`}
      style={{ backgroundColor: bg, color: textColor }}
      title={name}
    >
      {initials}
    </div>
  )
}
