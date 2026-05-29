"use client"

import { useEffect, useRef } from "react"

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// ── formations ─────────────────────────────────────────────────────────
// Each formation is a list of [cx, cy, radius, weight] metaball sources.
// Cycling through these (with eased blends) gives the elastic morph.

const FORMATIONS: number[][][] = [
  // wide horizontal cluster (current)
  [
    [0.50, 0.30, 0.28, 1.0],
    [0.50, 0.50, 0.26, 0.95],
    [0.50, 0.40, 0.18, 0.85],
    [0.50, 0.22, 0.08, 0.5],
    [0.50, 0.62, 0.06, 0.35],
  ],
  // skinny vertical column
  [
    [0.50, 0.30, 0.12, 1.0],
    [0.50, 0.50, 0.10, 0.95],
    [0.50, 0.70, 0.12, 1.0],
    [0.50, 0.40, 0.06, 0.5],
    [0.50, 0.60, 0.06, 0.5],
  ],
  // diagonal cell-split
  [
    [0.62, 0.30, 0.22, 1.0],
    [0.55, 0.48, 0.18, 0.9],
    [0.42, 0.66, 0.18, 0.85],
    [0.70, 0.20, 0.06, 0.4],
    [0.34, 0.78, 0.06, 0.35],
  ],
  // dual blob (mitosis)
  [
    [0.32, 0.40, 0.22, 1.0],
    [0.68, 0.50, 0.22, 1.0],
    [0.50, 0.45, 0.06, 0.3],
    [0.30, 0.60, 0.06, 0.4],
    [0.70, 0.30, 0.06, 0.4],
  ],
  // tall stack
  [
    [0.50, 0.22, 0.16, 0.9],
    [0.50, 0.42, 0.20, 1.0],
    [0.50, 0.62, 0.18, 0.95],
    [0.50, 0.80, 0.10, 0.55],
    [0.50, 0.10, 0.06, 0.4],
  ],
  // wide elongated band
  [
    [0.30, 0.50, 0.18, 1.0],
    [0.50, 0.50, 0.20, 1.0],
    [0.70, 0.50, 0.18, 1.0],
    [0.20, 0.45, 0.06, 0.4],
    [0.80, 0.55, 0.06, 0.4],
  ],
  // amorphous bird
  [
    [0.50, 0.38, 0.24, 1.0],
    [0.40, 0.52, 0.14, 0.7],
    [0.60, 0.52, 0.14, 0.7],
    [0.28, 0.32, 0.08, 0.45],
    [0.72, 0.30, 0.08, 0.45],
  ],
]

const murmurationField = (
  c: number,
  r: number,
  cols: number,
  rows: number,
  t: number,
  mx: number,
  my: number,
  formationOffset: number
): number => {
  const nx = c / cols
  const ny = r / rows
  const aspect = 1.8

  const cycle = (((t + formationOffset) * 0.025) % 1 + 1) % 1
  const numF = FORMATIONS.length
  const rawIdx = cycle * numF
  const fromIdx = Math.floor(rawIdx) % numF
  const toIdx = (fromIdx + 1) % numF
  const blend = rawIdx - Math.floor(rawIdx)
  const eased = blend * blend * (3 - 2 * blend)

  const from = FORMATIONS[fromIdx]
  const to = FORMATIONS[toIdx]

  let b = 0
  for (let i = 0; i < from.length; i++) {
    const cx = lerp(from[i][0], to[i][0], eased) +
      0.025 * Math.sin(t * 0.06 + i * 1.7) +
      0.03 * (mx - 0.5)
    const cy = lerp(from[i][1], to[i][1], eased) +
      0.02 * Math.cos(t * 0.05 + i * 2.3) +
      0.025 * (my - 0.5)
    const br = lerp(from[i][2], to[i][2], eased) +
      0.008 * Math.sin(t * 0.2 + i * 3.1)
    const bw = lerp(from[i][3], to[i][3], eased)

    const dx = nx - cx
    const dy = (ny - cy) * aspect
    const wobble =
      0.10 * Math.sin(dx * 10 + dy * 7 + t * 0.3 + i * 2.1) +
      0.05 * Math.cos(dx * 6 - dy * 12 + t * 0.2 + i * 3.3)
    const sig = br * (1 + wobble) * 0.58
    const sig2 = sig * sig
    if (sig2 > 0.0001) {
      b += bw * Math.exp(-(dx * dx + dy * dy) / (2 * sig2))
    }
  }

  b += 0.02 * Math.sin(nx * 12 + t * 0.3 + Math.sin(ny * 8 + t * 0.15) * 2)
  b *= 0.92 + 0.08 * Math.sin(t * 0.25)
  return b
}

// ── text grid ──────────────────────────────────────────────────────────
// Lays out the manifesto across the visible grid, word-wrapping and
// repeating to fill. Each cell holds a single character; shapes reveal
// portions of the underlying text.

const buildTextGrid = (
  cols: number,
  rows: number,
  text: string
): string[] => {
  const grid = new Array<string>(cols * rows).fill(" ")
  const upper = (text || "").toUpperCase().replace(/\s+/g, " ").trim()
  if (!upper) return grid

  // Tokenize to words (no spaces)
  const words = upper.split(" ").filter(Boolean)
  if (!words.length) return grid

  let wi = 0
  for (let r = 0; r < rows; r++) {
    let col = 0
    while (col < cols) {
      const w = words[wi % words.length]
      // very long word: hard break
      if (w.length > cols) {
        const fit = w.slice(0, cols - col)
        for (let i = 0; i < fit.length; i++) {
          grid[r * cols + col] = fit[i]
          col++
        }
        wi++
        break
      }
      if (col > 0 && col + w.length + 1 > cols) break
      // optional leading space between words on same line
      if (col > 0) {
        grid[r * cols + col] = " "
        col++
        if (col + w.length > cols) break
      }
      for (let i = 0; i < w.length && col < cols; i++) {
        grid[r * cols + col] = w[i]
        col++
      }
      wi++
    }
    // pad row
    while (col < cols) {
      grid[r * cols + col] = " "
      col++
    }
  }
  return grid
}

// ── shape sampler ──────────────────────────────────────────────────────

type Cell = { x: number; y: number; value: string }

const buildShapeCells = (
  cols: number,
  rows: number,
  t: number,
  mx: number,
  my: number,
  threshold: number,
  fill: number,
  cursorX: number,
  cursorY: number,
  cursorRepel: number,
  textGrid: string[],
  formationOffset: number
): Cell[] => {
  const out: Cell[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const b = murmurationField(c, r, cols, rows, t, mx, my, formationOffset)
      const cellShimmer = Math.sin(c * 13.7 + r * 7.3 + t * 3) * 0.06
      let beff = b * fill + cellShimmer * fill
      if (cursorRepel > 0) {
        const ndx = c / cols - cursorX
        const ndy = r / rows - cursorY
        const d = Math.sqrt(ndx * ndx + ndy * ndy)
        if (d < cursorRepel) {
          const t2 = d / cursorRepel
          const falloff = t2 * t2 * (3 - 2 * t2)
          beff *= Math.max(0, falloff)
        }
      }
      if (beff < threshold) continue
      const ch = textGrid[r * cols + c]
      if (!ch || !ch.trim()) continue
      out.push({ x: c, y: r, value: ch })
    }
  }
  return out
}

const renderToBuffer = (
  cols: number,
  rows: number,
  cells: Cell[],
  container: HTMLDivElement
) => {
  const total = cols * rows
  const buf: string[] = new Array(total)
  for (let i = 0; i < total; i++) buf[i] = " "
  for (let i = 0, n = cells.length; i < n; i++) {
    const p = cells[i]
    if (p.x < 0 || p.x >= cols || p.y < 0 || p.y >= rows) continue
    buf[p.y * cols + p.x] = p.value
  }
  let s = ""
  for (let r = 0; r < rows; r++) {
    s += buf.slice(r * cols, (r + 1) * cols).join("")
    if (r < rows - 1) s += "\n"
  }
  container.textContent = s
}

// ── component ──────────────────────────────────────────────────────────

interface VygrIntroProps {
  text?: string
  color?: string
  backgroundColor?: string
  fontFamily?: string
  fontWeight?: number
  fontSize?: number
  lineHeight?: number
  threshold?: number
  pointerInfluence?: number
  cursorRepel?: number
}

export default function VygrIntro({
  text = "",
  color = "#FFFFFF",
  backgroundColor = "transparent",
  fontFamily = "Akkurat Mono, monospace",
  fontWeight = 400,
  fontSize = 14,
  lineHeight = 1.0,
  threshold = 0.42,
  pointerInfluence = 0.6,
  cursorRepel = 0.14,
}: VygrIntroProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const dimsRef = useRef({ cols: 0, rows: 0 })
  const pointerRef = useRef({ x: 0.5, y: 0.5, active: false })
  const easedCursorRef = useRef({ x: 0.5, y: 0.5 })
  const fillRef = useRef(0)
  const startTimeRef = useRef(0)
  const textGridRef = useRef<string[]>([])
  const formationOffsetRef = useRef({ current: 0, target: 0 })

  useEffect(() => {
    const cont = containerRef.current
    const grid = gridRef.current
    if (!cont || !grid) return

    const measure = () => {
      const probe = document.createElement("span")
      probe.style.cssText = `
        position:absolute;visibility:hidden;white-space:pre;
        font-family:${fontFamily};font-weight:${fontWeight};
        font-size:${fontSize}px;line-height:${lineHeight};letter-spacing:0;
      `
      probe.textContent = "M".repeat(40) + "\n" + "M"
      cont.appendChild(probe)
      const probeRect = probe.getBoundingClientRect()
      const charW = probeRect.width / 40
      const lineH = probeRect.height / 2
      cont.removeChild(probe)
      const rect = cont.getBoundingClientRect()
      const cols = Math.max(8, Math.floor(rect.width / charW))
      const rows = Math.max(4, Math.floor(rect.height / lineH))
      dimsRef.current = { cols, rows }
      textGridRef.current = buildTextGrid(cols, rows, text)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(cont)

    startTimeRef.current = performance.now()
    let raf = 0
    let lastT = startTimeRef.current

    const onPointerMove = (clientX: number, clientY: number) => {
      const r = cont.getBoundingClientRect()
      pointerRef.current.x = clamp((clientX - r.left) / r.width, 0, 1)
      pointerRef.current.y = clamp((clientY - r.top) / r.height, 0, 1)
      pointerRef.current.active = true
    }
    const handleMouseMove = (e: MouseEvent) =>
      onPointerMove(e.clientX, e.clientY)
    const handleMouseLeave = () => {
      pointerRef.current.active = false
    }
    const handleClick = () => {
      // jump forward by one formation slot
      formationOffsetRef.current.target += 1 / 0.025 / FORMATIONS.length
    }
    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) onPointerMove(t.clientX, t.clientY)
    }
    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) onPointerMove(t.clientX, t.clientY)
    }
    const handleTouchEnd = () => {
      pointerRef.current.active = false
      handleClick()
    }

    cont.addEventListener("mousemove", handleMouseMove)
    cont.addEventListener("mouseleave", handleMouseLeave)
    cont.addEventListener("click", handleClick)
    cont.addEventListener("touchstart", handleTouchStart)
    cont.addEventListener("touchmove", handleTouchMove)
    cont.addEventListener("touchend", handleTouchEnd)

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      lastT = now
      const { cols, rows } = dimsRef.current
      if (!cols || !rows) return

      const tNow = (now - startTimeRef.current) / 1000

      // fill entrance ramp
      const rampE = Math.min(1, tNow / 3.5)
      fillRef.current = easeInOutCubic(rampE)

      // smooth formation offset
      const fo = formationOffsetRef.current
      fo.current += (fo.target - fo.current) * 0.04

      // eased pointer
      const ec = easedCursorRef.current
      if (pointerRef.current.active) {
        ec.x += (pointerRef.current.x - ec.x) * 0.05
        ec.y += (pointerRef.current.y - ec.y) * 0.05
      } else {
        ec.x += (0.5 - ec.x) * 0.02
        ec.y += (0.5 - ec.y) * 0.02
      }

      const px =
        pointerRef.current.x * pointerInfluence +
        0.5 * (1 - pointerInfluence)
      const py =
        pointerRef.current.y * pointerInfluence +
        0.5 * (1 - pointerInfluence)

      const cells = buildShapeCells(
        cols,
        rows,
        tNow,
        px,
        py,
        threshold,
        fillRef.current,
        ec.x,
        ec.y,
        pointerRef.current.active ? cursorRepel : 0,
        textGridRef.current,
        fo.current
      )

      renderToBuffer(cols, rows, cells, grid)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      cont.removeEventListener("mousemove", handleMouseMove)
      cont.removeEventListener("mouseleave", handleMouseLeave)
      cont.removeEventListener("click", handleClick)
      cont.removeEventListener("touchstart", handleTouchStart)
      cont.removeEventListener("touchmove", handleTouchMove)
      cont.removeEventListener("touchend", handleTouchEnd)
    }
  }, [
    text,
    fontFamily,
    fontWeight,
    fontSize,
    lineHeight,
    threshold,
    pointerInfluence,
    cursorRepel,
  ])

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor,
        color,
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
      }}
    >
      <div
        ref={gridRef}
        style={{
          fontFamily,
          fontWeight,
          fontSize: `${fontSize}px`,
          lineHeight,
          letterSpacing: 0,
          whiteSpace: "pre",
          margin: 0,
          padding: 0,
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  )
}
