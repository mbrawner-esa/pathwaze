'use client'
import { useState } from 'react'
import { SiteTab } from './SiteTab'
import { UtilityTab } from './UtilityTab'
import { StakeholdersTab } from './StakeholdersTab'
import { PermittingTab } from './PermittingTab'
import { TechnicalTab } from './TechnicalTab'
import { FinancialTab } from './FinancialTab'
import { ScheduleTab } from './ScheduleTab'
import { DataRoomTab } from './DataRoomTab'

const TABS = [
  { id: 'site', label: 'Site' },
  { id: 'utility', label: 'Utility' },
  { id: 'stakeholders', label: 'Stakeholders' },
  { id: 'permitting', label: 'Permitting' },
  { id: 'technical', label: 'Technical' },
  { id: 'financial', label: 'Financial' },
  // Schedule + Data Room hidden until each is fully defined
  // { id: 'schedule', label: 'Schedule' },
  // { id: 'dataroom', label: 'Data Room' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ProjectDetailClient({ project, financials, milestones, stakeholders, permits, docs, buildings, meters, systems }: any) {
  const [activeTab, setActiveTab] = useState('site')

  return (
    <div>
      {/* Tab Bar */}
      <div className="px-8 mt-6 bg-white border-b border-[#e2e8f0] flex overflow-x-auto">
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-5 py-3 text-[13px] font-medium whitespace-nowrap transition-colors -mb-px border-b-2"
              style={{
                color: active ? '#181818' : '#706E6B',
                borderBottomColor: active ? '#E6C87A' : 'transparent',
                fontWeight: active ? 600 : 500,
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="px-8 py-7">
        {activeTab === 'site' && <SiteTab project={project} buildings={buildings} meters={meters} systems={systems} />}
        {activeTab === 'utility' && <UtilityTab project={project} buildings={buildings} meters={meters} />}
        {activeTab === 'stakeholders' && <StakeholdersTab stakeholders={stakeholders} projectId={project.id} />}
        {activeTab === 'permitting' && <PermittingTab project={project} permits={permits} />}
        {activeTab === 'technical' && <TechnicalTab project={{ ...project, _financials: financials }} buildings={buildings} meters={meters} systems={systems} />}
        {activeTab === 'financial' && <FinancialTab financials={financials} projectId={project.id} systemKwdc={project.system_kwdc} />}
        {activeTab === 'schedule' && <ScheduleTab milestones={milestones} />}
        {activeTab === 'dataroom' && <DataRoomTab docs={docs} projectId={project.id} />}
      </div>
    </div>
  )
}
