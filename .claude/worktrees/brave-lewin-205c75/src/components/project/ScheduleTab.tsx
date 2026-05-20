'use client'
import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import { CheckCircle, Circle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Milestone {
  id: string
  label: string
  target_date: string | null
  completed: boolean
  sort_order: number
}

export function ScheduleTab({ milestones }: { milestones: Milestone[] }) {
  const router = useRouter()
  const [toggling, setToggling] = useState<string | null>(null)
  const sorted = [...milestones].sort((a, b) => a.sort_order - b.sort_order)
  const completedCount = sorted.filter(m => m.completed).length

  async function toggleMilestone(milestone: Milestone) {
    setToggling(milestone.id)
    try {
      await fetch(`/api/milestones/${milestone.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !milestone.completed }),
      })
      router.refresh()
    } catch { /* ignore */ }
    setToggling(null)
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-[#2F3E50] uppercase tracking-wider">Project Schedule</h3>
        <span className="text-xs text-[#6E879E]">{completedCount} / {sorted.length} complete</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-[#f1f5f9] rounded-full h-2 mb-6">
        <div className="bg-[#22c55e] h-2 rounded-full transition-all" style={{ width: `${sorted.length > 0 ? (completedCount / sorted.length) * 100 : 0}%` }} />
      </div>

      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-[#e2e8f0]" />
        <div className="space-y-1">
          {sorted.map((m, i) => (
            <div key={m.id} className="flex items-start gap-4 pl-8 py-2 relative group">
              <button
                className="absolute left-0 top-3 cursor-pointer disabled:opacity-50"
                onClick={() => toggleMilestone(m)}
                disabled={toggling === m.id}
                title={m.completed ? 'Mark incomplete' : 'Mark complete'}
              >
                {m.completed ? (
                  <CheckCircle size={18} className="text-[#22c55e] hover:text-[#16a34a]" fill="#22c55e" />
                ) : (
                  <Circle size={18} className="text-[#d1d5db] hover:text-[#22c55e] transition-colors" />
                )}
              </button>
              <div className="flex-1">
                <p className={`text-sm ${m.completed ? 'text-[#94a3b8] line-through' : 'text-[#334155] font-medium'}`}>
                  {m.label}
                </p>
                <p className="text-xs text-[#94a3b8]">{formatDate(m.target_date)}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${i === completedCount && !m.completed ? 'bg-[#E6C87A] text-[#2F3E50] font-semibold' : ''}`}>
                {i === completedCount && !m.completed ? 'Next' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
