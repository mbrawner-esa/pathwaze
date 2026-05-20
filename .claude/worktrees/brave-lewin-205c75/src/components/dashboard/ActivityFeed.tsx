import { formatDate } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ActivityFeed({ items }: { items: any[] }) {
  if (!items.length) return <p className="text-sm text-[#94a3b8]">No recent activity</p>
  return (
    <div className="space-y-3 max-h-48 overflow-y-auto">
      {items.map(item => (
        <div key={item.id} className="flex gap-2 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-[#E6C87A] mt-1.5 flex-shrink-0" />
          <div>
            <p className="text-[#334155]">{item.action}</p>
            <p className="text-[#94a3b8]">{formatDate(item.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
