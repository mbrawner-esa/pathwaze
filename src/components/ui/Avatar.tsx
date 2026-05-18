const COLORS: Record<string, string> = {
  'Morgan Brawner': '#1C303C',
  'Sarah Chen': '#70A0D0',
  'James Wright': '#E6C87A',
}

interface AvatarProps {
  name: string
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Avatar({ name, imageUrl, size = 'md', className = '' }: AvatarProps) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const bg = COLORS[name] ?? '#70A0D0'
  const textColor = bg === '#E6C87A' ? '#1C303C' : '#fff'
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        title={name}
        className={`rounded-full object-cover flex-shrink-0 ${sizeClass} ${className}`}
      />
    )
  }

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
