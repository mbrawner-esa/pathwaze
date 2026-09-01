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
// COLOUR. Momentum band is a STATUS, not a series identity, so it uses a
// reserved three-step scale and always ships with a text label beside it, never
// colour alone. The palette was validated rather than eyeballed — see the note
// on BAR_FILL. Bar LENGTH carries the precise score; colour carries only the
// coarse bad / middle / good read, which is why three steps serve four bands.

import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import {
  BAND_LABEL, momentumSummary, WINDOW_DAYS, STALE_DAYS,
  type MomentumBand, type Momentum,
} from '@/lib/momentum'
import type { PriorityRow } from '@/lib/portfolio-priority'

/**
 * Validated status fills. `node scripts/validate_palette.js` (dataviz skill) on
 * "#B91C1C,#C8963A,#166534" passes lightness, chroma, CVD separation and the
 * normal-vision floor against a light surface.
 *
 * The obvious choice — reusing the four band colours from momentum.ts — FAILS:
 * stalled (#991B1B) and slow (#92400E) sit at ΔE 6.7 in normal vision, well
 * under the floor of 15, so full-colour readers cannot reliably tell them
 * apart, before considering colour blindness. Slow and Steady therefore share
 * the gold step, and their bar lengths separate them.
 *
 * The gold carries a contrast WARN at 2.6:1, which the skill permits only with
 * relief: every bar here is directly labelled with its name, score and band.
 */
const BAR_FILL: Record<MomentumBand, string> = {
  stalled: '#B91C1C',
  slow:    '#C8963A',
  steady:  '#C8963A',
  strong:  '#166534',
}

/** Band thresholds from momentum.ts, drawn as recessive ticks. */
const THRESHOLDS = [16, 40, 70]

const LABEL_PX = 168
const SCORE_PX = 34

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

  const scored = rows.filter((r): r is PriorityRow & { momentum: Momentum } => !!r.momentum)

  const sorted = [...scored].sort((a, b) => b.momentum.score - a.momentum.score)

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
      (expandable ? 'px-5 pt-4 pb-4' : 'px-4 pt-3.5 pb-3 mb-4')}>
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="m-0 text-[13px] font-bold text-[#181818]">Portfolio momentum</h2>
          <span className="text-[11px] text-[#94a3b8]">
            last 30 days · median <span className="tabular-nums font-semibold text-[#55677A]">{median}</span>
          </span>
        </div>
        {/* Legend: status colour never travels without its label. */}
        <div className="flex items-center gap-3.5 flex-wrap">
          {([['stalled', 'Stalled'], ['slow', 'Slow / Steady'], ['strong', 'Strong']] as const).map(([b, label]) => (
            <span key={b} className="inline-flex items-center gap-1.5 text-[11px] text-[#55677A]">
              <i className="block w-[9px] h-[9px] rounded-sm" style={{ background: BAR_FILL[b] }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* Recessive band thresholds, so a bar's colour has a visible reason. */}
        <div className="absolute inset-y-0 pointer-events-none"
             style={{ left: LABEL_PX, right: SCORE_PX }} aria-hidden>
          {THRESHOLDS.map(t => (
            <span key={t} className="absolute top-0 bottom-0 w-px bg-[#F1F5F9]" style={{ left: `${t}%` }} />
          ))}
        </div>

        <ul className="list-none m-0 p-0 relative">
          {sorted.map(r => {
            const m = r.momentum
            const open = openId === r.projectId
            return (
              <li key={r.projectId}>
                <div
                  className={'flex items-center gap-2 rounded hover:bg-[#FAFBFC] ' +
                    (expandable ? 'py-[5px] cursor-pointer' : 'py-[3px]')}
                  onClick={expandable ? () => setOpenId(open ? null : r.projectId) : undefined}
                  title={expandable ? undefined : `${r.name} — ${BAND_LABEL[m.band]} ${m.score}/100\n${momentumSummary(m)}`}
                >
                  <span className="flex items-center gap-1 shrink-0" style={{ width: LABEL_PX }}>
                    {expandable && (open
                      ? <ChevronDown size={12} className="text-[#8A6519] shrink-0" />
                      : <ChevronRight size={12} className="text-[#C6D0DA] shrink-0" />)}
                    <span className="text-[11.5px] text-[#3E3E3C] truncate">{r.name}</span>
                  </span>
                  <span className={'flex-1 rounded-sm bg-[#F4F6F8] relative overflow-hidden ' +
                    (expandable ? 'h-[14px]' : 'h-[12px]')}>
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
                  <span className="text-[11.5px] font-semibold tabular-nums text-[#3E3E3C] text-right shrink-0"
                        style={{ width: SCORE_PX }}>
                    {m.score}
                  </span>
                </div>
                {expandable && open && <MomentumDetail momentum={m} />}
              </li>
            )
          })}
        </ul>
      </div>

      <p className="m-0 mt-2.5 pt-2 border-t border-[#F1F5F9] text-[11px] text-[#94a3b8]">
        <span className="tabular-nums font-semibold text-[#b91c1c]">{counts.stalled}</span> stalled ·{' '}
        <span className="tabular-nums font-semibold text-[#8A6519]">{counts.slow + counts.steady}</span> slow or steady ·{' '}
        <span className="tabular-nums font-semibold text-[#166534]">{counts.strong}</span> strong.
        {' '}{expandable ? 'Click a row for what drove its score.' : 'Hover a bar for what drove its score.'}
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
    <div className="ml-[184px] mr-[34px] mb-2 mt-1 rounded-lg bg-[#FAFBFC] border border-[#EDF1F5] px-3.5 py-2.5">
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
