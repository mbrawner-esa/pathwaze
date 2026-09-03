'use client'

// Portfolio momentum, as one picture.
//
// The board's Momentum column answers "is THIS project moving". This answers
// the question a column cannot: what does the portfolio look like — is the
// whole book coasting, or is it two stalled sites and everything else fine.
//
// FORM. Ranked magnitude with identity, ~13 named items: horizontal bars,
// sorted by score. Not a histogram — a distribution would drop the project
// names, and "which ones" is the actual question. Not vertical bars — project
// names are long and would need rotating.
//
// COLOUR. Two colours, not four. Bar LENGTH already carries the score
// precisely, so colour only has to answer one question — is this one in
// trouble — and every extra hue past that is decoration competing with the
// data. See BAR_FILL for what was tried and rejected.

import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import {
  BAND_LABEL, momentumSummary, WINDOW_DAYS, STALE_DAYS,
  type MomentumBand, type Momentum,
} from '@/lib/momentum'
import type { PriorityRow } from '@/lib/portfolio-priority'

/**
 * One neutral, one alarm. Everything that is not stalled is the same calm
 * slate; a stalled project is red.
 *
 * Three things were tried and rejected, all with the validator rather than by
 * eye (`node scripts/validate_palette.js`, dataviz skill):
 *
 *   · the four band colours from momentum.ts — FAILED. Stalled (#991B1B) and
 *     slow (#92400E) sit at ΔE 6.7 in normal vision, under the floor of 15.
 *   · a three-step red / gold / green scale — passed, but the gold sat at
 *     2.6:1 contrast and three hues made a 13-row chart busier than the data
 *     it carried.
 *   · pastel versions of either — FAILED on both the lightness band and the
 *     chroma floor. Lightening a chart by washing out its MARKS is the wrong
 *     move; the weight to remove is the chrome around them.
 *
 * The pair here passes separation (ΔE 27 normal, 19.3 deutan) and contrast.
 * It fails the chroma floor on the slate, knowingly: that check exists to keep
 * categorical hues from reading gray and colliding with each other, and this
 * slate is *meant* to read neutral — it carries no identity, only "not the
 * alarm". Band is still named in the row's tooltip and in the table view.
 */
const BAR_FILL: Record<MomentumBand, string> = {
  stalled: '#B91C1C',
  slow:    '#8095A8',
  steady:  '#8095A8',
  strong:  '#8095A8',
}

const LABEL_PX = 176
const SCORE_PX = 30

export function MomentumChart({
  rows, expandable = false,
}: {
  rows: PriorityRow[]
  /**
   * Full-view mode: rows open to show the components behind the score. Off in
   * the compact case, where the chart is a glance rather than a workspace.
   */
  expandable?: boolean
}) {
  // Before any early return: hooks must not be conditional.
  const [openId, setOpenId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score')

  const scored = rows.filter((r): r is PriorityRow & { momentum: Momentum } => !!r.momentum)

  // Score order answers "who is stuck"; name order answers "how is X doing"
  // without hunting a moving row. Both are one click, neither is a default
  // anyone has to undo.
  const sorted = [...scored].sort((a, b) => sortBy === 'name'
    ? a.name.localeCompare(b.name)
    : b.momentum.score - a.momentum.score)

  const counts = sorted.reduce<Record<MomentumBand, number>>((acc, r) => {
    acc[r.momentum.band]++
    return acc
  }, { stalled: 0, slow: 0, steady: 0, strong: 0 })

  if (scored.length === 0) return null

  const median = sorted.length
    ? sorted[Math.floor((sorted.length - 1) / 2)].momentum.score
    : 0

  return (
    <section className={'bg-white rounded-xl border border-[#e2e8f0] ' +
      (expandable ? 'px-7 pt-6 pb-6' : 'px-4 pt-3.5 pb-3 mb-4')}>
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className={'m-0 font-semibold text-[#3E3E3C] ' + (expandable ? 'text-[15px]' : 'text-[12.5px]')}>
            Portfolio momentum
          </h2>
          <span className="text-[11px] text-[#94a3b8]">
            last {WINDOW_DAYS} days · median <span className="tabular-nums font-semibold text-[#55677A]">{median}</span>
          </span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {expandable && (
            <span className="flex items-center gap-1 bg-[#F7F9FA] border border-[#E4EAF0] rounded-md p-[2px]">
              {(['score', 'name'] as const).map(k => (
                <button key={k} type="button" onClick={() => setSortBy(k)} aria-pressed={sortBy === k}
                        className={'px-2 py-[3px] rounded text-[10.5px] font-semibold transition-colors ' +
                          (sortBy === k ? 'bg-white text-[#3E3E3C] shadow-sm' : 'text-[#94a3b8] hover:text-[#55677A]')}>
                  {k === 'score' ? 'By score' : 'A–Z'}
                </button>
              ))}
            </span>
          )}
          {/* Legend: colour never travels without its label. */}
          {([['stalled', 'Stalled'], ['steady', 'Moving']] as const).map(([b, label]) => (
            <span key={b} className="inline-flex items-center gap-1.5 text-[10.5px] text-[#94a3b8]">
              <i className="block w-[8px] h-[8px] rounded-full" style={{ background: BAR_FILL[b] }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        <ul className="list-none m-0 p-0 relative">
          {sorted.map(r => {
            const m = r.momentum
            const open = openId === r.projectId
            return (
              <li key={r.projectId}>
                <div
                  className={'flex items-center rounded hover:bg-[#F7F9FA] transition-colors ' +
                    (expandable ? 'gap-4 ' : 'gap-2 ') +
                    (expandable ? 'py-[9px] px-2 -mx-2 cursor-pointer' : 'py-[3px]')}
                  onClick={expandable ? () => setOpenId(open ? null : r.projectId) : undefined}
                  title={expandable ? undefined : `${r.name} — ${BAND_LABEL[m.band]} ${m.score}/100\n${momentumSummary(m)}`}
                >
                  <span className="flex items-center gap-1 shrink-0" style={{ width: LABEL_PX }}>
                    {expandable && (open
                      ? <ChevronDown size={12} className="text-[#8A6519] shrink-0" />
                      : <ChevronRight size={12} className="text-[#C6D0DA] shrink-0" />)}
                    <span className={'truncate ' + (expandable ? 'text-[13px] text-[#181818]' : 'text-[11.5px] text-[#3E3E3C]')}>{r.name}</span>
                  </span>
                  <span className={'flex-1 rounded-sm bg-[#F5F7F9] relative overflow-hidden ' +
                    (expandable ? 'h-[14px]' : 'h-[9px]')}>
                    <span
                      className="absolute inset-y-0 left-0 rounded-r-[4px]"
                      style={{
                        // A zero score still shows a sliver, so a stalled project
                        // reads as "scored zero" rather than "no data".
                        width: `${Math.max(m.score, 1.5)}%`,
                        background: BAR_FILL[m.band],
                      }}
                    />
                  </span>
                  <span className={'font-semibold tabular-nums text-right shrink-0 ' +
                    (expandable ? 'text-[14px] text-[#181818]' : 'text-[11.5px] text-[#3E3E3C]')}
                        style={{ width: expandable ? 40 : SCORE_PX }}>
                    {m.score}
                  </span>
                </div>
                {expandable && open && <MomentumDetail momentum={m} />}
              </li>
            )
          })}
        </ul>
      </div>

      {expandable && (
        <div className="flex items-center gap-4 mt-1.5" aria-hidden>
          <span className="shrink-0" style={{ width: LABEL_PX }} />
          <span className="flex-1 flex justify-between text-[9.5px] tabular-nums text-[#C6D0DA]">
            {[0, 25, 50, 75, 100].map(t => <span key={t}>{t}</span>)}
          </span>
          <span className="shrink-0" style={{ width: 40 }} />
        </div>
      )}

      <p className="m-0 mt-3 pt-2.5 border-t border-[#F4F6F8] text-[10.5px] text-[#A9B5C1]">
        <span className="tabular-nums font-semibold text-[#b91c1c]">{counts.stalled}</span> stalled of{' '}
        <span className="tabular-nums">{sorted.length}</span>.
        {' '}{expandable ? 'Click a row to see what drove its score.' : 'Hover a bar for detail.'}
      </p>
    </section>
  )
}

/**
 * What actually produced a score.
 *
 * The tooltip version of this is one line; here there is room to show each
 * component with its count and the points it contributed, which is the
 * difference between a number you trust and one you argue with.
 */
function MomentumDetail({ momentum }: { momentum: Momentum }) {
  return (
    <div className="ml-[192px] mr-[40px] mb-3 mt-1 rounded-lg bg-[#FAFBFC] border border-[#EDF1F5] px-3.5 py-2.5">
      {momentum.components.length === 0 ? (
        <p className="m-0 text-[11.5px] text-[#706E6B]">
          {momentum.daysSinceActivity === null
            ? 'No recorded activity on this project at all.'
            : `Nothing in the last ${WINDOW_DAYS} days. Last activity ${momentum.daysSinceActivity} days ago.`}
        </p>
      ) : (
        <>
          <table className="w-full border-collapse">
            <tbody>
              {momentum.components.map(c => (
                <tr key={c.label}>
                  <td className="py-[2px] text-[11.5px] text-[#3E3E3C]">{c.label}</td>
                  <td className="py-[2px] text-[11.5px] tabular-nums text-[#706E6B] text-right w-[40px]">{c.count}</td>
                  <td className="py-[2px] text-[11.5px] tabular-nums text-right w-[56px] font-semibold"
                      style={{ color: c.points < 0 ? '#b91c1c' : '#55677A' }}>
                    {c.points > 0 ? `+${c.points}` : c.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {momentum.stale && (
            <p className="m-0 mt-2 pt-2 border-t border-[#EDF1F5] text-[11px] text-[#92400E]">
              Score capped: no activity for {momentum.daysSinceActivity} days, past the {STALE_DAYS}-day
              staleness limit. Points alone would have scored higher.
            </p>
          )}
        </>
      )}
    </div>
  )
}
