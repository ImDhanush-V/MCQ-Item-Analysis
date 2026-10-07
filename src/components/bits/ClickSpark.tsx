// Small burst of lines where the user clicks (React Bits "ClickSpark" pattern). Decorative; off for reduced-motion users.
import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

const LIFETIME = 450

export function ClickSpark() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (reduce || !canvas || !ctx) return
    let sparks: { x: number; y: number; t: number }[] = []
    let raf = 0
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const colour = () => `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().split(/\s+/).join(', ')})`
    const draw = (now: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      sparks = sparks.filter((s) => now - s.t < LIFETIME)
      const stroke = colour()
      for (const s of sparks) {
        const p = (now - s.t) / LIFETIME
        const eased = 1 - (1 - p) * (1 - p)
        ctx.strokeStyle = stroke
        ctx.globalAlpha = 1 - p
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4
          const r0 = 6 + eased * 12
          const r1 = r0 + 9 * (1 - p)
          ctx.beginPath()
          ctx.moveTo(s.x + Math.cos(a) * r0, s.y + Math.sin(a) * r0)
          ctx.lineTo(s.x + Math.cos(a) * r1, s.y + Math.sin(a) * r1)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
      if (sparks.length) raf = requestAnimationFrame(draw)
    }
    const onClick = (e: MouseEvent) => {
      sparks.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    }
    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('click', onClick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('click', onClick)
    }
  }, [reduce])

  if (reduce) return null
  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[60] print:hidden" />
}
