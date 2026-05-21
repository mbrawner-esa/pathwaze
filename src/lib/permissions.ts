/**
 * Role-based permission helpers.
 *
 * Pathwaze has four roles:
 *   admin   — full access to everything
 *   manager — sees all projects + tasks, can edit, but CANNOT delete or
 *             archive projects (those are admin-only destructive actions)
 *   team    — sees all projects, sees own + subscribed-tag tasks
 *   investor— investor portal only (separate sign-in flow)
 *
 * Use these helpers in UI components AND server routes — defense in depth.
 */

export type Role = 'admin' | 'manager' | 'team' | 'investor' | string

export function isAdmin(role: Role | null | undefined): boolean {
  return role === 'admin'
}

export function isManagerOrAbove(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'manager'
}

/** Only admin can permanently delete a project. */
export function canDeleteProject(role: Role | null | undefined): boolean {
  return isAdmin(role)
}

/** Only admin can archive or unarchive a project. */
export function canArchiveProject(role: Role | null | undefined): boolean {
  return isAdmin(role)
}

/** Both admin and manager can edit project metadata (rename, change stage to non-archived, etc). */
export function canEditProject(role: Role | null | undefined): boolean {
  return isManagerOrAbove(role)
}

/** Admin + manager can invite teammates. */
export function canInviteUsers(role: Role | null | undefined): boolean {
  return isAdmin(role)
}
