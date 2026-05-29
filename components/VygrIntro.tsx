"use client"

import { useEffect, useRef } from "react"

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const smoothstep = (t: number) => t * t * (3 - 2 * t)

const SCRAMBLE_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?<>=+-/:*."

// ── stage timing ───────────────────────────────────────────────────────
const TYPEWRITER_END = 3.6   // first phrase types in
const HOLD_DUR = 0.35        // held after type before expansion
const EXPANSION_END = 6.2    // cells fully formed
const CYCLE_INTERVAL = 4.0   // shape auto-cycle (s)

const TYPEWRITER_PHRASE =
  "FOR MILLENNIA, THE HUMAN MIND HAS BEEN CONSTRAINED BY THE FRAGILE GEOMETRY OF THE SKULL."

// ── formations ─────────────────────────────────────────────────────────

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
  // 2 — mitosis
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
  // 6 — readable block
  [
    [0.50, 0.40, 0.28, 1.0],
    [0.50, 0.50, 0.30, 1.0],
    [0.50, 0.60, 0.28, 1.0],
    [0.35, 0.50, 0.18, 0.9],
    [0.65, 0.50, 0.18, 0.9],
    [0.50, 0.50, 0.10, 0.7],
  ],
]

// ── cells ──────────────────────────────────────────────────────────────

type Cell = {
  x: number
  y: number
  r: number
  w: number
  hx: number
  hy: number
  hr: number
  hw: number
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
    // spread along the typewriter row for a smooth emergence from the text
    const x = n > 1 ? 0.32 + (i / (n - 1)) * 0.36 : 0.5
    out.push({
      x,
      y: 0.5,
      r: 0,
      w: 1.0,
      hx: 0.5,
      hy: 0.5,
      hr: 0.001,
      hw: 1.0,
      ax: 0.02 + Math.random() * 0.025,
      ay: 0.02 + Math.random() * 0.025,
      ar: 0.10 + Math.random() * 0.12,
      fx: 0.32 + Math.random() * 0.35,
      fy: 0.28 + Math.random() * 0.32,
      fr: 0.45 + Math.random() * 0.55,
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

// ── hover ──────────────────────────────────────────────────────────────

const HOVER_RADIUS = 0.16   // normalized (of width)
const HOVER_STAGGER = 0.32  // s — outer chars trigger this much later
const HOVER_SCRAMBLE = 0.28 // s — scramble duration before lock

const applyHoverPass = (
  buf: string[],
  cols: number,
  rows: number,
  cursorX: number,
  cursorY: number,
  moveTime: number,
  tNow: number
) => {
  if (cursorX < 0) return
  const cursorCol = cursorX * cols
  const cursorRow = cursorY * rows
  const radius = HOVER_RADIUS * cols
  const radiusSq = radius * radius
  const colMin = Math.max(0, Math.floor(cursorCol - radius))
  const colMax = Math.min(cols - 1, Math.ceil(cursorCol + radius))
  const rowMin = Math.max(0, Math.floor(cursorRow - radius / ASPECT))
  const rowMax = Math.min(rows - 1, Math.ceil(cursorRow + radius / ASPECT))
  for (let r = rowMin; r <= rowMax; r++) {
    for (let c = colMin; c <= colMax; c++) {
      const ch = buf[r * cols + c]
      if (!ch || ch === " ") continue
      const dx = c - cursorCol
      const dy = (r - cursorRow) * ASPECT
      const distSq = dx * dx + dy * dy
      if (distSq > radiusSq) continue
      const norm = Math.sqrt(distSq) / radius
      const triggerAt = moveTime + norm * HOVER_STAGGER
      const elapsed = tNow - triggerAt
      if (elapsed > 0 && elapsed < HOVER_SCRAMBLE) {
        buf[r * cols + c] =
          SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)]
      }
    }
  }
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
  const lastSlotRef = useRef(-1)
  const clickBoostsRef = useRef(0)
  // cursor (normalized)
  const cursorRef = useRef({ x: -1, y: -1, moveTime: 0 })

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

    assignHomes(cellsRef.current, FORMATIONS[0])
    startTimeRef.current = performance.now()
    let raf = 0

    const onPointerMove = (clientX: number, clientY: number) => {
      const r = cont.getBoundingClientRect()
      const nx = clamp((clientX - r.left) / r.width, 0, 1)
      const ny = clamp((clientY - r.top) / r.height, 0, 1)
      cursorRef.current.x = nx
      cursorRef.current.y = ny
      cursorRef.current.moveTime = (performance.now() - startTimeRef.current) / 1000
    }
    const handleMouseMove = (e: MouseEvent) =>
      onPointerMove(e.clientX, e.clientY)
    const handleMouseLeave = () => {
      cursorRef.current.x = -1
      cursorRef.current.y = -1
    }
    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) onPointerMove(t.clientX, t.clientY)
    }
    const handleTouchEnd = () => {
      cursorRef.current.x = -1
      cursorRef.current.y = -1
    }
    const handleClick = () => {
      const now = (performance.now() - startTimeRef.current) / 1000
      if (now < EXPANSION_END) return
      // skip to next shape; auto-cycle continues thereafter
      clickBoostsRef.current += 1
      lastSlotRef.current = -2
    }

    cont.addEventListener("mousemove", handleMouseMove)
    cont.addEventListener("mouseleave", handleMouseLeave)
    cont.addEventListener("touchmove", handleTouchMove)
    cont.addEventListener("touchend", handleTouchEnd)
    cont.addEventListener("click", handleClick)

    // typewriter chars: returns visible chars + per-char fade (during expansion)
    const buildTypewriterFrame = (
      tNow: number,
      cols: number
    ): { col: number; ch: string }[] => {
      const phrase = TYPEWRITER_PHRASE
      const totalChars = phrase.length
      const charDur = TYPEWRITER_END / (totalChars + 4)
      const scrambleDur = charDur * 2.2
      const startCol = Math.max(0, Math.floor((cols - phrase.length) / 2))
      const out: { col: number; ch: string }[] = []

      // typing phase
      const typingT = Math.min(tNow, TYPEWRITER_END)
      let absIdx = 0
      let col = startCol
      const lockedChars: { col: number; ch: string; centerDist: number }[] = []
      const phraseHalf = phrase.length / 2
      for (let i = 0; i < phrase.length; i++) {
        const ch = phrase[i]
        if (ch === " ") {
          // spaces don't render but advance position
          col++
          absIdx++
          continue
        }
        const charStart = absIdx * charDur
        const charLock = charStart + scrambleDur
        if (typingT >= charStart) {
          const centerDist = Math.abs(i - phraseHalf) / phraseHalf
          if (typingT < charLock) {
            out.push({
              col,
              ch: SCRAMBLE_POOL[
                Math.floor(Math.random() * SCRAMBLE_POOL.length)
              ],
            })
          } else {
            // locked char — may fade during expansion
            if (tNow <= TYPEWRITER_END + HOLD_DUR) {
              out.push({ col, ch })
            } else {
              lockedChars.push({ col, ch, centerDist })
            }
          }
        }
        col++
        absIdx++
      }

      // fade-out pass for locked chars during expansion (outer first, center last)
      if (lockedChars.length > 0) {
        const fadeStart = TYPEWRITER_END + HOLD_DUR
        const fadeWindow = EXPANSION_END - fadeStart
        const fadeProgress = clamp((tNow - fadeStart) / fadeWindow, 0, 1)
        for (const { col, ch, centerDist } of lockedChars) {
          // outer chars (centerDist≈1) start fading earlier
          const charFadeStart = (1 - centerDist) * 0.6
          const charFadeEnd = charFadeStart + 0.35
          if (fadeProgress < charFadeStart) {
            out.push({ col, ch })
          } else if (fadeProgress < charFadeEnd) {
            // scramble + dropout during fade
            const localT =
              (fadeProgress - charFadeStart) / (charFadeEnd - charFadeStart)
            if (Math.random() > localT) {
              out.push({
                col,
                ch:
                  Math.random() < 0.4
                    ? SCRAMBLE_POOL[
                        Math.floor(Math.random() * SCRAMBLE_POOL.length)
                      ]
                    : ch,
              })
            }
          }
          // else: char fully faded — field shows through
        }
      }

      return out
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const { cols, rows } = dimsRef.current
      if (!cols || !rows) return
      const tNow = (now - startTimeRef.current) / 1000

      const buf: string[] = new Array(cols * rows).fill(" ")

      // ── auto-cycle homes ──
      if (tNow > EXPANSION_END) {
        const slot = Math.floor((tNow - EXPANSION_END) / CYCLE_INTERVAL)
        const desiredIdx =
          ((slot + clickBoostsRef.current) % (FORMATIONS.length - 1)) + 1
        if (slot !== lastSlotRef.current || formationIdxRef.current !== desiredIdx) {
          lastSlotRef.current = slot
          formationIdxRef.current = desiredIdx
          assignHomes(cellsRef.current, FORMATIONS[desiredIdx])
        }
      }

      // ── radii multiplier (entrance ramp) ──
      let entranceR = 0
      if (tNow < TYPEWRITER_END + HOLD_DUR) {
        entranceR = 0
      } else if (tNow < EXPANSION_END) {
        const t01 =
          (tNow - TYPEWRITER_END - HOLD_DUR) /
          (EXPANSION_END - TYPEWRITER_END - HOLD_DUR)
        entranceR = easeInOutCubic(t01)
      } else {
        entranceR = 1
      }

      // ── update cells ──
      const cells = cellsRef.current
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
        c.x += (desX - c.x) * 0.07
        c.y += (desY - c.y) * 0.07
        c.r += (desR - c.r) * 0.06
        c.w += (desW - c.w) * 0.05
      }

      // ── render field ──
      if (entranceR > 0.01) {
        const textGrid = textGridRef.current
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const nx = c / cols
            const ny = r / rows
            const b = fieldAt(nx, ny, cells, tNow)
            const shimmer = Math.sin(c * 13.7 + r * 7.3 + tNow * 3) * 0.04
            const beff = b + shimmer
            if (beff < threshold) continue
            const ch = textGrid[r * cols + c]
            if (!ch || !ch.trim()) continue
            buf[r * cols + c] = ch
          }
        }
      }

      // ── overlay typewriter (locked + fading) ──
      if (tNow < EXPANSION_END) {
        const row = Math.floor(rows / 2)
        const chars = buildTypewriterFrame(tNow, cols)
        for (let i = 0; i < chars.length; i++) {
          const { col, ch } = chars[i]
          if (col < 0 || col >= cols) continue
          buf[row * cols + col] = ch
        }
      }

      // ── hover stagger pass ──
      const cur = cursorRef.current
      applyHoverPass(buf, cols, rows, cur.x, cur.y, cur.moveTime, tNow)

      renderGrid(cols, rows, buf, grid)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      cont.removeEventListener("mousemove", handleMouseMove)
      cont.removeEventListener("mouseleave", handleMouseLeave)
      cont.removeEventListener("touchmove", handleTouchMove)
      cont.removeEventListener("touchend", handleTouchEnd)
      cont.removeEventListener("click", handleClick)
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
        cursor: "default",
        userSelect: "none",
        WebkitUserSelect: "none",
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
