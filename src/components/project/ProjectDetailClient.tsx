'use client'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { SiteTab } from './SiteTab'
import { UtilityTab } from './UtilityTab'
import { StakeholdersTab } from './StakeholdersTab'
import { PermittingTab } from './PermittingTab'
import { TechnicalTab } from './TechnicalTab'
import { FinancialTab } from './FinancialTab'
import { ScheduleTab } from './ScheduleTab'
import { DataRoomTab } from './DataRoomTab'
import { DrawingsTab } from './DrawingsTab'
import { ThreadsTab } from './ThreadsTab'
import { ProjectActivityFeed, type ActivityEntry } from './ProjectActivityFeed'
import { ProjectActivityActions } from './ProjectActivityActions'

const TABS = [
  { id: 'threads', label: 'Threads' },
  { id: 'site', label: 'Site' },
  { id: 'utility', label: 'Utility' },
  { id: 'stakeholders', label: 'Stakeholders' },
  { id: 'permitting', label: 'Permitting' },
  { id: 'technical', label: 'Technical' },
  { id: 'financial', label: 'Financial' },
  { id: 'drawings', label: 'Drawings' },
  // Schedule + Data Room hidden until each is fully defined
  // { id: 'schedule', label: 'Schedule' },
  // { id: 'dataroom', label: 'Data Room' },
]

const VALID_TAB_IDS = new Set(TABS.map(t => t.id))

// Which activity_log entity types belong to each tab's feed. The per-tab
// Activity feed shows only edits to the entities that live on that tab
// (e.g. Utility → meters), instead of the whole project's activity.
const TAB_ACTIVITY_ENTITIES: Record<string, string[]> = {
  site: ['building'],            // Buildings / Parcels / Site Information
  utility: ['meter'],           // Meters / Accounts / Utility
  stakeholders: ['stakeholder'],
  permitting: ['permit'],
  technical: ['system'],        // Systems & Specs
  financial: ['offtaker_pricing'],
  drawings: ['drawing'],        // As-builts + review status changes
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ProjectDetailClient({ project, financials, milestones, stakeholders, permits, docs, buildings, meters, systems, threads = [], notes = [], activity = [], users = [], pricingRows = [], drawings = [], collections = [], reviewTypes = [] }: any) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Initial tab honors ?tab=<id> on the URL so deep links from tasks land
  // on the right tab. Falls back to "threads" (default landing tab).
  const tabFromUrl = searchParams.get('tab')
  const initialTab = tabFromUrl && VALID_TAB_IDS.has(tabFromUrl) ? tabFromUrl : 'threads'
  const [activeTab, setActiveTab] = useState(initialTab)

  // Keep the URL in sync when the user clicks a tab — so refreshing or
  // sharing the link goes back to the same tab.
  useEffect(() => {
    if (activeTab === (tabFromUrl || 'threads')) return
    const params = new URLSearchParams(searchParams.toString())
    if (activeTab === 'threads') params.delete('tab')
    else params.set('tab', activeTab)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Reverse sync: when the ?tab= param changes (e.g. an in-page link like the
  // Project Contact → Stakeholders link updates the URL), switch tabs to match.
  // Both effects guard on equality, so they settle without ping-ponging.
  useEffect(() => {
    const next = tabFromUrl && VALID_TAB_IDS.has(tabFromUrl) ? tabFromUrl : 'threads'
    if (next !== activeTab) setActiveTab(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl])

  return (
    <div>
      {/* Tab Bar + Content in a single bordered card so they read as one surface */}
      <div className="px-8 mt-6 mx-auto w-full" style={{ maxWidth: 1760 }}>
        <div className="rounded-xl shadow-sm overflow-hidden" style={{ background: '#F8FAFC' }}>
          <div className="flex overflow-x-auto border-b border-[#e2e8f0] px-2 bg-white">
            {TABS.map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-4 py-3 text-[14px] whitespace-nowrap transition-colors -mb-px border-b-2"
                  style={{
                    color: active ? '#181818' : '#706E6B',
                    borderBottomColor: active ? '#70A0D0' : 'transparent',
                    fontWeight: active ? 700 : 600,
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
          <div className="p-6">
        {activeTab === 'site' && <SiteTab project={project} buildings={buildings} meters={meters} systems={systems} />}
        {activeTab === 'utility' && <UtilityTab project={project} buildings={buildings} meters={meters} />}
        {activeTab === 'stakeholders' && <StakeholdersTab stakeholders={stakeholders} projectId={project.id} />}
        {activeTab === 'permitting' && <PermittingTab project={project} permits={permits} />}
        {activeTab === 'technical' && <TechnicalTab project={{ ...project, _financials: financials }} buildings={buildings} meters={meters} systems={systems} />}
        {activeTab === 'financial' && <FinancialTab financials={financials} projectId={project.id} systemKwdc={project.system_kwdc} pricingRows={pricingRows} systems={systems} meters={meters} users={users} />}
        {activeTab === 'schedule' && <ScheduleTab milestones={milestones} />}
        {activeTab === 'dataroom' && <DataRoomTab docs={docs} projectId={project.id} />}
        {activeTab === 'drawings' && <DrawingsTab projectId={project.id} drawings={drawings} areas={buildings} collections={collections} users={users} reviewTypes={reviewTypes} stakeholders={stakeholders} />}
        {activeTab === 'threads' && (
          <>
            <ProjectActivityActions projectId={project.id} projectName={project.name} users={users} />
            <ThreadsTab threads={threads} notes={notes} channelLinked={!!project.slack_channel_id} users={users} />
          </>
        )}
          </div>
        </div>
      </div>

      {/* Activity feed — bottom of every project page, except when Threads tab is active.
          Scoped to the entities that live on the active tab. */}
      {activeTab !== 'threads' && (
        <div className="px-8 pt-6 pb-10 mx-auto w-full" style={{ maxWidth: 1760 }}>
          <ProjectActivityActions projectId={project.id} projectName={project.name} users={users} />
          <ProjectActivityFeed
            entries={(activity as ActivityEntry[]).filter(e => {
              if (e.kind !== 'system') return false
              // Entity edits (building/meter/system/permit/…) mapped to this tab.
              if (e.entity_type && (TAB_ACTIVITY_ENTITIES[activeTab] ?? []).includes(e.entity_type)) return true
              // Project field edits routed to their tab via metadata.category.
              if (e.entity_type === 'project' && e.action === 'field_changed' && e.metadata?.category === activeTab) return true
              return false
            })}
            users={users}
          />
        </div>
      )}
    </div>
  )
}
