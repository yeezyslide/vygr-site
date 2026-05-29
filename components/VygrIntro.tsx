"use client"

import { useEffect, useRef } from "react"

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const smoothstep = (t: number) => t * t * (3 - 2 * t)

const SCRAMBLE_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?<>=+-/:*."

// ── stages ─────────────────────────────────────────────────────────────
//   0 — TYPEWRITER: first phrase types in word-by-word at center
//   1 — EXPANSION: cells emerge at center, migrate into skinny formation
//   2 — WILD: cells live, click cycles formations

const TYPEWRITER_END = 2.8
const EXPANSION_END = 4.6
const TYPEWRITER_PHRASE =
  "FOR MILLENNIA THE HUMAN MIND HAS BEEN CONSTRAINED BY THE FRAGILE GEOMETRY OF THE SKULL"

// ── formations ─────────────────────────────────────────────────────────
// Each formation is N cells of [cx, cy, radius, weight].
// First entry (skinny tall column) is the post-typewriter target.

const NUM_CELLS = 6

const FORMATIONS: number[][][] = [
  // 0 — skinny tall column (entrance target)
  [
    [0.50, 0.18, 0.10, 1.0],
    [0.50, 0.34, 0.11, 1.0],
    [0.50, 0.50, 0.12, 1.0],
    [0.50, 0.66, 0.11, 1.0],
    [0.50, 0.82, 0.10, 0.9],
    [0.50, 0.50, 0.05, 0.4],
  ],
  // 1 — wide horizontal bloom
  [
    [0.30, 0.50, 0.18, 1.0],
    [0.50, 0.42, 0.22, 1.0],
    [0.70, 0.50, 0.18, 1.0],
    [0.50, 0.62, 0.14, 0.85],
    [0.22, 0.42, 0.08, 0.45],
    [0.78, 0.58, 0.08, 0.45],
  ],
  // 2 — mitosis (two cells dividing)
  [
    [0.32, 0.44, 0.20, 1.0],
    [0.68, 0.52, 0.20, 1.0],
    [0.32, 0.58, 0.10, 0.6],
    [0.68, 0.40, 0.10, 0.6],
    [0.50, 0.48, 0.05, 0.3],
    [0.50, 0.52, 0.05, 0.3],
  ],
  // 3 — diagonal sprawl
  [
    [0.30, 0.30, 0.18, 1.0],
    [0.50, 0.50, 0.20, 1.0],
    [0.70, 0.70, 0.18, 1.0],
    [0.40, 0.40, 0.08, 0.45],
    [0.60, 0.60, 0.08, 0.45],
    [0.50, 0.20, 0.06, 0.35],
  ],
  // 4 — elongated band
  [
    [0.20, 0.50, 0.14, 1.0],
    [0.40, 0.48, 0.16, 1.0],
    [0.60, 0.52, 0.16, 1.0],
    [0.80, 0.50, 0.14, 1.0],
    [0.50, 0.50, 0.10, 0.6],
    [0.30, 0.55, 0.06, 0.3],
  ],
  // 5 — amorphous bird
  [
    [0.50, 0.40, 0.22, 1.0],
    [0.36, 0.52, 0.14, 0.8],
    [0.64, 0.52, 0.14, 0.8],
    [0.28, 0.32, 0.08, 0.45],
    [0.72, 0.30, 0.08, 0.45],
    [0.50, 0.62, 0.10, 0.55],
  ],
  // 6 — readable block (settled state target)
  [
    [0.50, 0.40, 0.28, 1.0],
    [0.50, 0.50, 0.30, 1.0],
    [0.50, 0.60, 0.28, 1.0],
    [0.35, 0.50, 0.18, 0.9],
    [0.65, 0.50, 0.18, 0.9],
    [0.50, 0.50, 0.10, 0.7],
  ],
]

// ── cell motion ────────────────────────────────────────────────────────
// Each cell has a home (target) + an animated pos. Independent oscillation
// gives the cell-like elastic feel; smooth pursuit toward the home gives
// the migration on formation change.

type Cell = {
  // animated state
  x: number
  y: number
  r: number
  w: number
  // home (target) — set by current formation
  hx: number
  hy: number
  hr: number
  hw: number
  // per-cell drift
  ax: number
  ay: number
  ar: number
  fx: number
  fy: number
  fr: number
  phx: number
  phy: number
  phr: number
}

const makeCells = (n: number): Cell[] => {
  const out: Cell[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      x: 0.5,
      y: 0.5,
      r: 0.001,
      w: 1.0,
      hx: 0.5,
      hy: 0.5,
      hr: 0.001,
      hw: 1.0,
      ax: 0.02 + Math.random() * 0.03,
      ay: 0.02 + Math.random() * 0.03,
      ar: 0.12 + Math.random() * 0.12,
      fx: 0.35 + Math.random() * 0.4,
      fy: 0.3 + Math.random() * 0.4,
      fr: 0.5 + Math.random() * 0.6,
      phx: Math.random() * Math.PI * 2,
      phy: Math.random() * Math.PI * 2,
      phr: Math.random() * Math.PI * 2,
    })
  }
  return out
}

const assignHomes = (cells: Cell[], formation: number[][]) => {
  for (let i = 0; i < cells.length; i++) {
    const f = formation[i % formation.length]
    cells[i].hx = f[0]
    cells[i].hy = f[1]
    cells[i].hr = f[2]
    cells[i].hw = f[3]
  }
}

// ── text grid ──────────────────────────────────────────────────────────

const buildTextGrid = (
  cols: number,
  rows: number,
  text: string
): string[] => {
  const grid = new Array<string>(cols * rows).fill(" ")
  const upper = (text || "").toUpperCase().replace(/\s+/g, " ").trim()
  if (!upper) return grid
  const words = upper.split(" ").filter(Boolean)
  if (!words.length) return grid

  let wi = 0
  for (let r = 0; r < rows; r++) {
    let col = 0
    while (col < cols) {
      const w = words[wi % words.length]
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
    while (col < cols) {
      grid[r * cols + col] = " "
      col++
    }
  }
  return grid
}

// ── field ──────────────────────────────────────────────────────────────

const ASPECT = 1.8

const fieldAt = (
  nx: number,
  ny: number,
  cells: Cell[],
  t: number
): number => {
  let b = 0
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    const dx = nx - c.x
    const dy = (ny - c.y) * ASPECT
    // membrane wobble — gives each cell a non-circular living edge
    const wobble =
      0.10 * Math.sin(dx * 9 + dy * 7 + t * 0.6 + c.phx * 3) +
      0.06 * Math.cos(dx * 6 - dy * 11 + t * 0.4 + c.phy * 3)
    const r = c.r * (1 + wobble)
    const sig2 = r * r * 0.34
    if (sig2 > 0.0001) {
      b += c.w * Math.exp(-(dx * dx + dy * dy) / (2 * sig2))
    }
  }
  return b
}

// ── render ─────────────────────────────────────────────────────────────

const renderGrid = (
  cols: number,
  rows: number,
  buf: string[],
  container: HTMLDivElement
) => {
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
}: VygrIntroProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const dimsRef = useRef({ cols: 0, rows: 0 })
  const startTimeRef = useRef(0)
  const textGridRef = useRef<string[]>([])
  const cellsRef = useRef<Cell[]>(makeCells(NUM_CELLS))
  const formationIdxRef = useRef(0)
  // entrance starts on skinny column (index 0). User clicks cycle from 1+.
  const userCyclingRef = useRef(false)

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

    // Initial homes: skinny tall column (formation 0)
    assignHomes(cellsRef.current, FORMATIONS[0])

    startTimeRef.current = performance.now()
    let raf = 0

    const handleClick = () => {
      const now = (performance.now() - startTimeRef.current) / 1000
      if (now < EXPANSION_END) return // ignore clicks during entrance
      userCyclingRef.current = true
      // cycle to next formation (skip 0 = entrance shape)
      formationIdxRef.current =
        (formationIdxRef.current % (FORMATIONS.length - 1)) + 1
      assignHomes(cellsRef.current, FORMATIONS[formationIdxRef.current])
    }
    cont.addEventListener("click", handleClick)
    cont.addEventListener("touchend", handleClick)

    // ── typewriter row layout ──
    const typewriterChars = (
      t: number,
      cols: number
    ): { col: number; ch: string }[] => {
      const out: { col: number; ch: string }[] = []
      const words = TYPEWRITER_PHRASE.split(" ")
      const totalChars = TYPEWRITER_PHRASE.length
      // pace
      const charDur = TYPEWRITER_END / (totalChars + 6) // small idle pad
      const scrambleDur = charDur * 1.8
      // center the phrase
      const startCol = Math.max(
        0,
        Math.floor((cols - TYPEWRITER_PHRASE.length) / 2)
      )
      let absIdx = 0
      let col = startCol
      for (let wi = 0; wi < words.length; wi++) {
        const word = words[wi]
        for (let ci = 0; ci < word.length; ci++) {
          const charStart = absIdx * charDur
          const charLock = charStart + scrambleDur
          if (t >= charStart) {
            if (t < charLock) {
              out.push({
                col,
                ch: SCRAMBLE_POOL[
                  Math.floor(Math.random() * SCRAMBLE_POOL.length)
                ],
              })
            } else {
              out.push({ col, ch: word[ci] })
            }
          }
          col++
          absIdx++
        }
        col++ // word gap
        absIdx++
      }
      return out
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const { cols, rows } = dimsRef.current
      if (!cols || !rows) return
      const tNow = (now - startTimeRef.current) / 1000

      const buf: string[] = new Array(cols * rows).fill(" ")

      // ── pre-cycle home update (formations auto-cycle slowly until user clicks)
      if (!userCyclingRef.current && tNow > EXPANSION_END + 6) {
        // auto-advance every 6s
        const slot = Math.floor((tNow - EXPANSION_END) / 6) % (FORMATIONS.length - 1)
        const nextIdx = slot + 1
        if (formationIdxRef.current !== nextIdx) {
          formationIdxRef.current = nextIdx
          assignHomes(cellsRef.current, FORMATIONS[nextIdx])
        }
      }

      // ── update cells ──
      const cells = cellsRef.current
      // entrance scaling: radii start at 0 and grow over expansion stage
      let entranceR = 0
      if (tNow < TYPEWRITER_END) {
        entranceR = 0
      } else if (tNow < EXPANSION_END) {
        const t01 = (tNow - TYPEWRITER_END) / (EXPANSION_END - TYPEWRITER_END)
        entranceR = easeInOutCubic(t01)
      } else {
        entranceR = 1
      }

      for (let i = 0; i < cells.length; i++) {
        const c = cells[i]
        const desX =
          c.hx + c.ax * Math.sin(tNow * c.fx * 2 * Math.PI + c.phx)
        const desY =
          c.hy + c.ay * Math.sin(tNow * c.fy * 2 * Math.PI + c.phy)
        const desR =
          c.hr *
          (1 + c.ar * Math.sin(tNow * c.fr * 2 * Math.PI + c.phr)) *
          entranceR
        const desW = c.hw
        // smooth pursuit
        c.x += (desX - c.x) * 0.08
        c.y += (desY - c.y) * 0.08
        c.r += (desR - c.r) * 0.06
        c.w += (desW - c.w) * 0.05
      }

      // ── render field cells ──
      if (tNow >= TYPEWRITER_END - 0.1) {
        const textGrid = textGridRef.current
        // overall fill ramps in during expansion
        const fill =
          tNow < TYPEWRITER_END
            ? 0
            : tNow < EXPANSION_END
              ? easeInOutCubic(
                  (tNow - TYPEWRITER_END) / (EXPANSION_END - TYPEWRITER_END)
                )
              : 1
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const nx = c / cols
            const ny = r / rows
            const b = fieldAt(nx, ny, cells, tNow)
            const shimmer = Math.sin(c * 13.7 + r * 7.3 + tNow * 3) * 0.04
            const beff = (b + shimmer) * fill
            if (beff < threshold) continue
            const ch = textGrid[r * cols + c]
            if (!ch || !ch.trim()) continue
            buf[r * cols + c] = ch
          }
        }
      }

      // ── overlay typewriter on top during stage 0 (and fading during stage 1) ──
      if (tNow < EXPANSION_END) {
        const row = Math.floor(rows / 2)
        const chars = typewriterChars(Math.min(tNow, TYPEWRITER_END), cols)
        // during expansion, fade typewriter by blanking randomly
        const fadeOut =
          tNow > TYPEWRITER_END
            ? smoothstep(
                (tNow - TYPEWRITER_END) / (EXPANSION_END - TYPEWRITER_END)
              )
            : 0
        for (let i = 0; i < chars.length; i++) {
          const { col, ch } = chars[i]
          if (col < 0 || col >= cols) continue
          if (fadeOut > 0 && Math.random() < fadeOut) continue
          buf[row * cols + col] = ch
        }
      }

      renderGrid(cols, rows, buf, grid)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      cont.removeEventListener("click", handleClick)
      cont.removeEventListener("touchend", handleClick)
    }
  }, [text, fontFamily, fontWeight, fontSize, lineHeight, threshold])

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
