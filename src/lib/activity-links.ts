// Map an activity_log entry (entity_type + entity_id + its project_id) to the
// URL that opens that object. Sub-entities (meter/building/system/permit/…)
// live inside a project, so they deep-link to the project's relevant tab.
// Returns null when we can't build a link (e.g. a sub-entity with no project_id).

const ENTITY_TAB: Record<string, string> = {
  meter: 'utility',
  building: 'site',
  system: 'technical',
  permit: 'permitting',
  offtaker_pricing: 'financial',
  drawing: 'drawings',
}

export function entityHref(
  entityType?: string | null,
  entityId?: string | null,
  projectId?: string | null,
): string | null {
  if (!entityType || !entityId) return null
  switch (entityType) {
    case 'project':     return `/projects/${entityId}`
    case 'task':        return `/tasks?id=${entityId}`
    case 'rfi':         return `/rfis/${entityId}`
    case 'stakeholder': return `/stakeholders?id=${entityId}`
    default: {
      const tab = ENTITY_TAB[entityType]
      return tab && projectId ? `/projects/${projectId}?tab=${tab}` : null
    }
  }
}
