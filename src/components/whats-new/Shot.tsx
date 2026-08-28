import type { ReleaseMedia } from '@/lib/whats-new'

/**
 * Shot: one captured product screen on /whats-new.
 *
 * The app's own chrome is light, so the image sits on a neutral mat rather than
 * bleeding into the card; without it a white screenshot on a white card loses
 * its edges. Wide captures scroll inside the figure so the page itself never
 * scrolls sideways on a laptop.
 *
 * Images are lazy, because this page carries several megabytes of GIF and none of it
 * should hold up first paint.
 */
export function Shot({ media }: { media: ReleaseMedia }) {
  const recorded = media.kind === 'recorded'

  return (
    <figure className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#FBFCFE]">
      <div className="overflow-x-auto bg-[#F1F5F9] p-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF; next/image would strip the animation */}
        <img
          src={media.src}
          alt={media.alt}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full min-w-[620px] rounded border border-[#DCE4EC]"
        />
      </div>
      <figcaption className="px-5 py-3.5">
        <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
          <span
            className={
              'shrink-0 rounded px-1.5 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.06em] ' +
              (recorded
                ? 'border border-[#DDD6FE] bg-[#F5F3FF] text-[#5B21B6]'
                : 'border border-[#e2e8f0] bg-white text-[#94a3b8]')
            }
          >
            {recorded ? 'Plays on loop' : 'Still'}
          </span>
          <span className="text-[12.5px] leading-relaxed text-[#706E6B]">{media.caption}</span>
        </span>

        {/* Numbered so a reader can match a point to the thing they are hunting for */}
        {media.callouts && (
          <ol className="mt-3 space-y-1.5 border-t border-[#ECEBEA] pt-3">
            {media.callouts.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-[2px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#E2E8F0] text-[9.5px] font-bold text-[#5C6E80]">
                  {i + 1}
                </span>
                <span className="text-[12px] leading-relaxed text-[#5C6E80]">{c}</span>
              </li>
            ))}
          </ol>
        )}
      </figcaption>
    </figure>
  )
}
