import Link from 'next/link'
import { RELEASE } from '@/lib/whats-new'
import { Md } from '@/components/whats-new/Md'

export const metadata = { title: "What's new — Pathwaze" }

export default function WhatsNewPage() {
  return (
    <div className="px-8 py-7 max-w-3xl">
      {/* Masthead */}
      <div className="card overflow-hidden mb-5">
        <div className="px-7 py-6 bg-[#0F1B26]">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#E6C87A]">
            What&apos;s new in Pathwaze
          </p>
          <h1 className="text-[26px] font-bold text-white mt-2 leading-tight">{RELEASE.title}</h1>
          <p className="text-[12.5px] text-slate-400 mt-1.5">{RELEASE.window}</p>
        </div>
        <div className="px-7 py-5">
          <p className="text-[13.5px] text-[#3E3E3C] leading-relaxed">{RELEASE.intro}</p>
        </div>
      </div>

      {/* Contents — a jump list, since this runs long */}
      <div className="card px-7 py-5 mb-5">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#94a3b8] mb-3">In this release</p>
        <ul className="space-y-1.5">
          {RELEASE.sections.map(s => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="flex items-start gap-2.5 group">
                <span className="text-[13px] leading-none mt-0.5 w-5 shrink-0 text-center">{s.icon}</span>
                <span className="text-[13px] font-semibold text-[#70A0D0] group-hover:underline">{s.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Sections */}
      {RELEASE.sections.map(s => (
        <section key={s.id} id={s.id} className="card overflow-hidden mb-5 scroll-mt-[68px]">
          <div className="px-7 py-4 border-b border-[#f1f5f9]">
            <h2 className="text-[15.5px] font-bold text-[#181818] flex items-center gap-2.5">
              <span className="text-[16px] leading-none">{s.icon}</span>
              {s.title}
            </h2>
            <p className="text-[12.5px] text-[#706E6B] mt-1 leading-snug">{s.summary}</p>
          </div>

          <div className="px-7 py-5">
            <div className="space-y-3.5">
              {s.body.map((para, i) => (
                <p key={i} className="text-[13.5px] text-[#3E3E3C] leading-relaxed">
                  <Md text={para} />
                </p>
              ))}
            </div>

            {s.howTo && (
              <div className="mt-5 rounded-lg border border-[#e2e8f0] bg-[#FBFCFE] px-5 py-4">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#94a3b8]">
                  How to
                </p>
                <p className="text-[13.5px] font-bold text-[#181818] mt-1 mb-3">{s.howTo.title}</p>
                <ol className="space-y-2.5">
                  {s.howTo.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 w-[20px] h-[20px] rounded-full bg-[#70A0D0] text-white text-[10.5px] font-bold flex items-center justify-center mt-[1px]">
                        {i + 1}
                      </span>
                      <span className="text-[13px] text-[#3E3E3C] leading-relaxed">
                        <Md text={step} />
                      </span>
                    </li>
                  ))}
                </ol>
                {s.howTo.note && (
                  <p className="text-[12px] text-[#706E6B] mt-3.5 pt-3 border-t border-[#ECEBEA] leading-relaxed">
                    <Md text={s.howTo.note} />
                  </p>
                )}
              </div>
            )}

            {s.link && (
              <Link
                href={s.link.href}
                className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-semibold text-[#70A0D0] hover:underline"
              >
                {s.link.label} <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        </section>
      ))}

      {/* What's next */}
      <section className="card overflow-hidden mb-5">
        <div className="px-7 py-4 border-b border-[#f1f5f9]">
          <h2 className="text-[15.5px] font-bold text-[#181818] flex items-center gap-2.5">
            <span className="text-[16px] leading-none">🔜</span>
            What&apos;s next
          </h2>
          <p className="text-[12.5px] text-[#706E6B] mt-1">On the roadmap — not shipped yet.</p>
        </div>
        <div className="px-7 py-5 space-y-3.5">
          {RELEASE.next.map(n => (
            <div key={n.title}>
              <p className="text-[13px] font-bold text-[#181818]">{n.title}</p>
              <p className="text-[13px] text-[#3E3E3C] leading-relaxed mt-0.5">{n.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[12.5px] text-[#706E6B] text-center pb-2">
        Found a bug or have a request? Drop it in <span className="font-semibold">#Pathwaze_bugs</span>.
      </p>
    </div>
  )
}
