// Project stage: the coarse pipeline state.
//
// Workstreams carries where a project actually is, so stage answers only the
// blunt question: is this deal alive, paused or dead, and which phase of the
// lifecycle is it in? Workstreams answers everything finer-grained.
//
// Archiving still rides on stage === 'Archived'. Every "hide archived" query in
// the app filters on it, so that value is load-bearing, not decorative.

/** The lifecycle phases, in pipeline order. */
export const PIPELINE_STAGES = [
  'Pre-Planning',
  'Design Development',
  'Pre-NTP',
  'Closing',
  'NTP',
  'Pre-Construction',
  'Construction',
  'Post Construction',
  'Operation',
] as const

/**
 * States that sit outside the pipeline. A held project keeps whatever progress
 * Workstreams shows; an archived one is a lost opportunity. Neither is a phase
 * of development, so neither belongs in a pipeline ordering.
 */
export const OFF_PIPELINE_STAGES = ['On Hold', 'Archived'] as const

/** Everything a project's stage may be, in the order shown to users. */
export const ALL_STAGES = [...PIPELINE_STAGES, ...OFF_PIPELINE_STAGES] as const

export type ProjectStage = (typeof ALL_STAGES)[number]

export const ARCHIVED_STAGE = 'Archived'
export const DEFAULT_STAGE = 'Pre-Planning'

/** Selectable in the UI: an archived project is unarchived, never re-staged. */
export const SELECTABLE_STAGES = ALL_STAGES.filter(s => s !== ARCHIVED_STAGE)

export function isArchived(stage: string | null | undefined): boolean {
  return stage === ARCHIVED_STAGE
}
