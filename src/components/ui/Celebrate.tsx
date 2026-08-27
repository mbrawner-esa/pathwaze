'use client'
import { useEffect, useRef, useState } from 'react'

// A short confetti burst for a genuinely rare event — completing a major
// milestone. Hand-rolled on a canvas rather than pulling in a dependency: it is
// ~60 lines and avoids shipping an animation library for one moment.
//
// Deliberately restrained: one burst, ~1.8s, then it removes itself. If it
// fired often it would be irritating rather than rewarding.

const COLORS = ['#E6C87A', '#C8963A', '#2F3E50', '#6E879E', '#22A45D']
const PIECES = 90
const DURATION_MS = 1800

interface Piece {
  x: number; y: number
  vx: number; vy: number
  rot: number; vr: number
  w: number; h: number
  color: string
}

export function Celebrate({ label, onDone }: { label?: string; onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  }, [])

  useEffect(() => {
    // Respect reduced-motion: show the banner, skip the animation entirely.
    if (reduced) {
      const t = setTimeout(() => onDone?.(), 2200)
      return () => clearTimeout(t)
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    // Two side bursts angled inward — reads better over a wide panel than a
    // single centre spray, which mostly falls straight down.
    const pieces: Piece[] = Array.from({ length: PIECES }, (_, i) => {
      const fromLeft = i % 2 === 0
      const speed = 5 + Math.random() * 7
      const angle = (fromLeft ? -60 : -120) + (Math.random() - 0.5) * 46
      const rad = (angle * Math.PI) / 180
      return {
        x: fromLeft ? w * 0.08 : w * 0.92,
        y: h * 0.62,
        vx: Math.cos(rad) * speed * (fromLeft ? 1 : -1) * -1,
        vy: Math.sin(rad) * speed,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        w: 5 + Math.random() * 5,
        h: 8 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
      }
    })

    let raf = 0
    const start = performance.now()

    const frame = (now: number) => {
      const elapsed = now - start
      const life = elapsed / DURATION_MS
      ctx.clearRect(0, 0, w, h)

      for (const p of pieces) {
        p.vy += 0.22            // gravity
        p.vx *= 0.995           // drag
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = Math.max(0, 1 - life)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      if (elapsed < DURATION_MS) raf = requestAnimationFrame(frame)
      else onDone?.()
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [reduced, onDone])

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-live="polite">
      {!reduced && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />}
      <div className="absolute inset-x-0 top-3 flex justify-center">
        <span
          className="text-[13px] font-bold px-3.5 py-1.5 rounded-full shadow-sm"
          style={{ background: '#2F3E50', color: '#E6C87A' }}
        >
          🎉 {label ?? 'Milestone complete'}
        </span>
      </div>
    </div>
  )
}
