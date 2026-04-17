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
  { id: 'schedule', label: 'Schedule' },
  { id: 'dataroom', label: 'Data Room' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ProjectDetailClient({ project, financials, milestones, stakeholders, permits, docs }: any) {
  const [activeTab, setActiveTab] = useState('site')

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex border-b border-[#e2e8f0] mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2"
            style={{
              color: activeTab === tab.id ? '#2F3E50' : '#94a3b8',
              borderBottomColor: activeTab === tab.id ? '#E6C87A' : 'transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'site' && <SiteTab project={project} />}
      {activeTab === 'utility' && <UtilityTab project={project} />}
      {activeTab === 'stakeholders' && <StakeholdersTab stakeholders={stakeholders} />}
      {activeTab === 'permitting' && <PermittingTab project={project} permits={permits} />}
      {activeTab === 'technical' && <TechnicalTab project={{ ...project, _financials: financials }} />}
      {activeTab === 'financial' && <FinancialTab financials={financials} projectId={project.id} />}
      {activeTab === 'schedule' && <ScheduleTab milestones={milestones} />}
      {activeTab === 'dataroom' && <DataRoomTab docs={docs} projectId={project.id} />}
    </div>
  )
}
