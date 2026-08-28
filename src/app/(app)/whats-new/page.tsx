import Link from 'next/link'
import { RELEASE, type ReleaseBlock, type ReleaseFeature, type ReleaseSection } from '@/lib/whats-new'
import { Md } from '@/components/whats-new/Md'
import { Shot } from '@/components/whats-new/Shot'

export const metadata = { title: "What's new | Pathwaze" }

/**
 * One teaching block: a rule, a heading, the intro prose, the block's own
 * content, then its screens. Shared so the three blocks in a tutorial section
 * read as siblings rather than three slightly different treatments.
 */
function BlockShell<T>({
  block,
  children,
}: {
  block: ReleaseBlock<T>
  children: React.ReactNode
}) {
  return (
    <div className="mt-8 border-t border-[#ECEBEA] pt-6">
      <h3 className="text-[15px] font-bold text-[#2F3E50]">{block.heading}</h3>
      <div className="mt-2 max-w-[72ch] space-y-3">
        {block.intro.map((p, i) => (
          <p key={i} className="text-[13px] leading-relaxed text-[#3E3E3C]">
            {p}
          </p>
        ))}
      </div>

      <div className="mt-5">{children}</div>

      {block.note && (
        <p className="mt-4 max-w-[72ch] rounded-lg border border-[#E6C87A] bg-[#FEFCF6] px-4 py-3 text-[12.5px] leading-relaxed text-[#3E3E3C]">
          {block.note}
        </p>
      )}

      {block.media && (
        <div className="mt-5 space-y-5">
          {block.media.map(m => (
            <Shot key={m.src} media={m} />
          ))}
        </div>
      )}
    </div>
  )
}

/** True if a section shows any product screen, wherever it is attached. */
function hasShots(s: ReleaseSection): boolean {
  return Boolean(
    s.media?.length ||
      s.workstreams?.media?.length ||
      s.milestones?.media?.length ||
      s.featureList?.media?.length,
  )
}

function FeatureGrid({ items }: { items: ReleaseFeature[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map(f => (
        <li key={f.name} className="flex items-start gap-3">
          <span aria-hidden className="mt-[1px] w-[20px] shrink-0 text-center text-[15px] leading-[1.4]">
            {f.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-[#181818]">{f.name}</span>
            <span className="mt-0.5 block text-[12.5px] leading-relaxed text-[#3E3E3C]">
              {f.what}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function WhatsNewPage() {
  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      {/*
        Light masthead. The gold rule carries the brand accent that the navy
        block used to, without turning the top of the page into a dark slab.
      */}
      <header className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-[1400px] px-8 py-10 xl:py-12">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#C8963A]">
            What&apos;s new in Pathwaze
          </p>
          <h1 className="mt-2.5 text-[32px] font-bold leading-[1.1] text-[#2F3E50] xl:text-[38px]">
            {RELEASE.title}
          </h1>
          <div className="mt-3 h-[3px] w-[52px] rounded-full bg-[#E6C87A]" />
          <p className="mt-3 text-[12.5px] text-[#8A99A8]">{RELEASE.window}</p>
          <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-[#3E3E3C]">
            {RELEASE.intro}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-8 py-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/*
            Jump list. On wide screens it sticks alongside the content instead of
            being a card the reader scrolls past once and cannot get back to.
          */}
          <nav
            aria-label="In this release"
            className="lg:sticky lg:top-[68px] lg:w-[248px] lg:shrink-0"
          >
            <div className="card px-5 py-4">
              <p className="mb-3 text-[10.5px] font-bold uppercase tracking-wider text-[#94a3b8]">
                In this release
              </p>
              <ul className="space-y-1">
                {RELEASE.sections.map(s => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="group flex items-start gap-2.5 rounded px-2 py-1.5 -mx-2 hover:bg-[#F6F9FB]"
                    >
                      <span className="mt-[1px] w-4 shrink-0 text-center text-[12px] leading-none">
                        {s.icon}
                      </span>
                      <span className="text-[12.5px] font-semibold leading-snug text-[#70A0D0] group-hover:underline">
                        {s.title}
                      </span>
                    </a>
                  </li>
                ))}
                <li className="!mt-2 border-t border-[#ECEBEA] pt-2">
                  <a
                    href="#whats-next"
                    className="group flex items-start gap-2.5 rounded px-2 py-1.5 -mx-2 hover:bg-[#F6F9FB]"
                  >
                    <span className="mt-[1px] w-4 shrink-0 text-center text-[12px] leading-none">🔜</span>
                    <span className="text-[12.5px] font-semibold leading-snug text-[#70A0D0] group-hover:underline">
                      What&apos;s next
                    </span>
                  </a>
                </li>
              </ul>
            </div>
          </nav>

          <div className="min-w-0 flex-1 space-y-6">
            {RELEASE.sections.map(s => (
              <section key={s.id} id={s.id} className="card overflow-hidden scroll-mt-[68px]">
                <div className="border-b border-[#f1f5f9] px-7 py-5">
                  <h2 className="flex items-center gap-2.5 text-[17px] font-bold text-[#181818]">
                    <span className="text-[17px] leading-none">{s.icon}</span>
                    {s.title}
                  </h2>
                  <p className="mt-1.5 max-w-[70ch] text-[13px] leading-snug text-[#706E6B]">
                    {s.summary}
                  </p>
                </div>

                <div className="px-7 py-6">
                  {/* Prose stays near 70 characters even though the card is wide */}
                  <div className="max-w-[72ch] space-y-3.5">
                    {s.body.map((para, i) => (
                      <p key={i} className="text-[13.5px] leading-relaxed text-[#3E3E3C]">
                        <Md text={para} />
                      </p>
                    ))}
                  </div>

                  {/* Tutorial flow: the lanes, then how milestones attach, then what it does */}
                  {s.workstreams && (
                    <BlockShell block={s.workstreams}>
                      <div className="space-y-4">
                        {s.workstreams.items.map(w => (
                          <div
                            key={w.name}
                            className="rounded-lg border border-[#e2e8f0] bg-white px-5 py-4"
                          >
                            <p className="flex items-center gap-2.5 text-[14px] font-bold text-[#181818]">
                              <span aria-hidden className="text-[15px] leading-none">
                                {w.icon}
                              </span>
                              {w.name}
                            </p>
                            <p className="mt-1.5 text-[13px] font-semibold leading-snug text-[#5C6E80]">
                              {w.governs}
                            </p>
                            <p className="mt-2 max-w-[72ch] text-[12.5px] leading-relaxed text-[#3E3E3C]">
                              {w.detail}
                            </p>
                            <p className="mt-3.5 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                              Major milestones it owns
                            </p>
                            <ol className="mt-2 flex flex-wrap gap-1.5">
                              {w.majors.map((m, i) => (
                                <li
                                  key={m}
                                  className="rounded border border-[#e2e8f0] bg-[#FBFCFE] px-2 py-1 text-[11.5px] text-[#3E3E3C]"
                                >
                                  <span className="mr-1.5 font-bold text-[#94a3b8]">{i + 1}</span>
                                  {m}
                                </li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </div>
                    </BlockShell>
                  )}

                  {s.milestones && (
                    <BlockShell block={s.milestones}>
                      {/* A ladder, so the nesting is visible rather than asserted */}
                      <ol className="space-y-2">
                        {s.milestones.items.map((f, i) => (
                          <li
                            key={f.name}
                            className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-3"
                            style={{ marginLeft: `${i * 18}px` }}
                          >
                            <p className="flex items-center gap-2 text-[13px] font-bold text-[#181818]">
                              <span aria-hidden className="text-[14px] leading-none">
                                {f.icon}
                              </span>
                              {f.name}
                            </p>
                            <p className="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed text-[#3E3E3C]">
                              {f.what}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </BlockShell>
                  )}

                  {s.featureList && (
                    <BlockShell block={s.featureList}>
                      <FeatureGrid items={s.featureList.items} />
                    </BlockShell>
                  )}

                  {s.media && (
                    <div className="mt-6 space-y-5">
                      {s.media.map(m => (
                        <Shot key={m.src} media={m} />
                      ))}
                    </div>
                  )}

                  {hasShots(s) && (
                    <p className="mt-5 text-[12px] leading-relaxed text-[#94a3b8]">
                      Screens on this page are captured from the real product against a demo
                      project built to show every state at once. The site name, dates and slips in
                      them are invented.
                    </p>
                  )}

                  {s.howTo && (
                    <div className="mt-6 max-w-[80ch] rounded-lg border border-[#e2e8f0] bg-[#FBFCFE] px-6 py-5">
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#94a3b8]">
                        How to
                      </p>
                      <p className="mb-3.5 mt-1 text-[14px] font-bold text-[#181818]">
                        {s.howTo.title}
                      </p>
                      <ol className="space-y-2.5">
                        {s.howTo.steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="mt-[1px] flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-[#70A0D0] text-[10.5px] font-bold text-white">
                              {i + 1}
                            </span>
                            <span className="text-[13px] leading-relaxed text-[#3E3E3C]">
                              <Md text={step} />
                            </span>
                          </li>
                        ))}
                      </ol>
                      {s.howTo.note && (
                        <p className="mt-3.5 border-t border-[#ECEBEA] pt-3 text-[12px] leading-relaxed text-[#706E6B]">
                          <Md text={s.howTo.note} />
                        </p>
                      )}
                    </div>
                  )}

                  {s.link && (
                    <Link
                      href={s.link.href}
                      className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#70A0D0] hover:underline"
                    >
                      {s.link.label} <span aria-hidden>→</span>
                    </Link>
                  )}
                </div>
              </section>
            ))}

            <section id="whats-next" className="card overflow-hidden scroll-mt-[68px]">
              <div className="border-b border-[#f1f5f9] px-7 py-5">
                <h2 className="flex items-center gap-2.5 text-[17px] font-bold text-[#181818]">
                  <span className="text-[17px] leading-none">🔜</span>
                  What&apos;s next
                </h2>
                <p className="mt-1.5 text-[13px] text-[#706E6B]">On the roadmap, not shipped yet.</p>
              </div>
              <div className="grid gap-5 px-7 py-6 sm:grid-cols-2">
                {RELEASE.next.map(n => (
                  <div key={n.title}>
                    <p className="text-[13px] font-bold text-[#181818]">{n.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[#3E3E3C]">{n.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <p className="pb-2 text-center text-[12.5px] text-[#706E6B]">
              Found a bug or have a request? Drop it in{' '}
              <span className="font-semibold">#Pathwaze_bugs</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
