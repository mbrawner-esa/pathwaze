import { ImageResponse } from 'next/og'

// Renders the full Pathwaze logo lockup (icon + wordmark) as PNG.
// Used by the invite email template. Lives at /email-logo (Content-Type: image/png).
//
// Why this route exists: the brand logo is an inline SVG React component
// (src/components/ui/PathwazeLogo.tsx) — there's no raster file in the repo,
// and no local tooling is available to convert SVG→PNG. This route uses
// next/og to rasterize on demand at the edge.

export const runtime = 'edge'

// Dark variant colors (matches navy email header).
const NAVY = '#1C303C'
const CREAM = '#F4F7FA'
const BLUE = '#70A0D0'
const LIGHT_BLUE = '#9CC0E0'
const YELLOW = '#F8D068'

// Full SVG markup of the lockup (mirrors PathwazeLogo, dark variant).
// Wordmark glyphs are Poppins Light "path" + Regular "waze" outlined paths.
const WORDMARK_GLYPHS: Array<{ x: number; d: string }> = [
  { x: 229.59, d: 'M366 554Q440 554 499.5 519.5Q559 485 592.5 421.5Q626 358 626 274Q626 190 592.5 126.0Q559 62 499.5 27.0Q440 -8 366 -8Q289 -8 232.0 28.5Q175 65 149 120V-258H80V546H149V426Q175 481 231.5 517.5Q288 554 366 554ZM352 493Q296 493 249.5 466.0Q203 439 176.0 389.0Q149 339 149 273Q149 207 176.0 157.0Q203 107 249.5 80.0Q296 53 352 53Q410 53 456.0 79.5Q502 106 528.5 156.5Q555 207 555 274Q555 342 528.5 391.5Q502 441 456.0 467.0Q410 493 352 493Z' },
  { x: 377.94, d: 'M309 554Q387 554 443.5 518.0Q500 482 525 426V546H595V0H525V121Q499 65 442.5 28.5Q386 -8 308 -8Q234 -8 174.5 27.0Q115 62 81.5 126.0Q48 190 48 274Q48 358 81.5 421.5Q115 485 174.5 519.5Q234 554 309 554ZM322 493Q264 493 218.0 467.0Q172 441 145.5 391.5Q119 342 119 274Q119 207 145.5 156.5Q172 106 218.0 79.5Q264 53 322 53Q378 53 424.5 80.0Q471 107 498.0 157.0Q525 207 525 273Q525 339 498.0 389.0Q471 439 424.5 466.0Q378 493 322 493Z' },
  { x: 526.29, d: 'M171 487V148Q171 98 190.0 79.0Q209 60 257 60H321V0H246Q172 0 136.0 34.5Q100 69 100 148V487H24V546H100V683H171V546H321V487Z' },
  { x: 604.54, d: 'M558 320V0H489V312Q489 401 444.5 448.0Q400 495 323 495Q244 495 197.0 445.0Q150 395 150 298V0H80V740H150V453Q176 502 226.5 529.0Q277 556 340 556Q402 556 451.5 530.0Q501 504 529.5 450.5Q558 397 558 320Z' },
  { x: 743.66, d: 'M807 548 636 0H542L410 435L278 0H184L12 548H105L231 88L367 548H460L593 87L717 548Z' },
  { x: 923.88, d: 'M303 557Q375 557 428.0 526.0Q481 495 507 448V548H599V0H507V102Q480 54 426.5 22.5Q373 -9 302 -9Q229 -9 170.0 27.0Q111 63 77.0 128.0Q43 193 43 276Q43 360 77.0 423.5Q111 487 170.5 522.0Q230 557 303 557ZM321 478Q270 478 228.0 454.0Q186 430 161.0 384.0Q136 338 136 276Q136 213 161.0 166.5Q186 120 228.0 95.5Q270 71 321 71Q372 71 414.5 95.5Q457 120 482.0 166.5Q507 213 507 275Q507 337 482.0 383.0Q457 429 414.5 453.5Q372 478 321 478Z' },
  { x: 1072.45, d: 'M145 75H414V0H41V75L307 474H43V548H412V474Z' },
  { x: 1172.45, d: 'M574 240H136Q141 159 191.5 113.5Q242 68 314 68Q373 68 412.5 95.5Q452 123 468 169H566Q544 90 478.0 40.5Q412 -9 314 -9Q236 -9 174.5 26.0Q113 61 78.0 125.5Q43 190 43 275Q43 360 77.0 424.0Q111 488 172.5 522.5Q234 557 314 557Q392 557 452.0 523.0Q512 489 544.5 429.5Q577 370 577 295Q577 269 574 240ZM310 480Q241 480 192.5 436.0Q144 392 137 314H483Q483 366 460.0 403.5Q437 441 397.5 460.5Q358 480 310 480Z' },
]

function buildLockupSvg(): string {
  const glyphs = WORDMARK_GLYPHS.map(
    g => `<path transform="translate(${g.x} 224) scale(0.21978 -0.21978)" d="${g.d}" fill="${CREAM}"/>`
  ).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1313 328">
    <g transform="translate(28 24) scale(0.61404) translate(-88 -28)">
      <line x1="120" y1="44" x2="120" y2="468" stroke="${CREAM}" stroke-width="32" stroke-linecap="round"/>
      <path d="M 192 64 A 192 192 0 0 1 192 448" fill="none" stroke="${BLUE}" stroke-width="38" stroke-linecap="round"/>
      <path d="M 192 136 A 120 120 0 0 1 192 376" fill="none" stroke="${LIGHT_BLUE}" stroke-width="38" stroke-linecap="round"/>
      <path d="M 192 208 A 48 48 0 0 1 192 304" fill="none" stroke="${BLUE}" stroke-width="38" stroke-linecap="round"/>
      <circle cx="120" cy="256" r="28" fill="${YELLOW}"/>
    </g>
    ${glyphs}
  </svg>`
}

export async function GET() {
  const svg = buildLockupSvg()
  // Width 600 keeps the lockup crisp at retina; email scales it down via height="40".
  // Aspect ratio of lockup is 1313:328 ≈ 4:1, so 600×150.
  const width = 600
  const height = 150
  const dataUri = `data:image/svg+xml;base64,${btoa(svg)}`

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: NAVY,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri} width={width} height={height} alt="Pathwaze" />
      </div>
    ),
    { width, height }
  )
}
