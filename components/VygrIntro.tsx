"use client"

import { useEffect, useRef } from "react"

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

const SCRAMBLE_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$&@"

// ── stage timing ───────────────────────────────────────────────────────
const TYPEWRITER_END = 3.6
const HOLD_DUR = 0.35
const EXPANSION_END = 6.2
const CYCLE_INTERVAL = 4.0

const TYPEWRITER_PHRASE =
  "FOR MILLENNIA, THE HUMAN MIND HAS BEEN CONSTRAINED BY THE FRAGILE GEOMETRY OF THE SKULL."

// ── hover (mirrors old VygrText behavior) ──────────────────────────────
const HOVER_SCRAMBLE_WINDOW = 0.55 // s per char
const HOVER_CHAR_STAGGER = 0.067 // s between successive chars in a word
const HOVER_SCRAMBLE_TICK = 0.08 // s between glyph re-rolls (~12.5fps)

// ── formations ─────────────────────────────────────────────────────────

const NUM_CELLS = 7

const FORMATIONS: number[][][] = [
  // 0 — skinny tall column (entrance target)
  [
    [0.50, 0.18, 0.10, 1.0],
    [0.50, 0.34, 0.11, 1.0],
    [0.50, 0.50, 0.12, 1.0],
    [0.50, 0.66, 0.11, 1.0],
    [0.50, 0.82, 0.10, 0.9],
    [0.50, 0.50, 0.05, 0.4],
    [0.48, 0.42, 0.04, 0.35],
  ],
  // 1 — wide horizontal bloom (asymmetric)
  [
    [0.28, 0.48, 0.18, 1.0],
    [0.48, 0.42, 0.22, 1.0],
    [0.68, 0.52, 0.18, 1.0],
    [0.54, 0.64, 0.12, 0.85],
    [0.22, 0.40, 0.07, 0.45],
    [0.80, 0.58, 0.08, 0.45],
    [0.38, 0.60, 0.05, 0.3],
  ],
  // 2 — mitosis
  [
    [0.32, 0.44, 0.20, 1.0],
    [0.68, 0.52, 0.20, 1.0],
    [0.30, 0.58, 0.10, 0.6],
    [0.70, 0.40, 0.10, 0.6],
    [0.50, 0.48, 0.05, 0.3],
    [0.50, 0.52, 0.05, 0.3],
    [0.45, 0.36, 0.04, 0.25],
  ],
  // 3 — diagonal sprawl
  [
    [0.26, 0.28, 0.18, 1.0],
    [0.48, 0.50, 0.22, 1.0],
    [0.72, 0.72, 0.18, 1.0],
    [0.36, 0.38, 0.08, 0.45],
    [0.62, 0.60, 0.08, 0.45],
    [0.54, 0.22, 0.06, 0.35],
    [0.44, 0.78, 0.05, 0.3],
  ],
  // 4 — elongated band
  [
    [0.18, 0.50, 0.13, 1.0],
    [0.38, 0.48, 0.16, 1.0],
    [0.58, 0.52, 0.16, 1.0],
    [0.78, 0.50, 0.13, 1.0],
    [0.50, 0.50, 0.08, 0.5],
    [0.28, 0.55, 0.05, 0.3],
    [0.70, 0.46, 0.05, 0.3],
  ],
  // 5 — amorphous bird
  [
    [0.50, 0.40, 0.22, 1.0],
    [0.34, 0.52, 0.13, 0.8],
    [0.66, 0.52, 0.13, 0.8],
    [0.26, 0.32, 0.07, 0.45],
    [0.74, 0.30, 0.07, 0.45],
    [0.50, 0.64, 0.09, 0.55],
    [0.50, 0.20, 0.04, 0.3],
  ],
  // 6 — irregular cluster
  [
    [0.42, 0.38, 0.17, 1.0],
    [0.58, 0.56, 0.18, 1.0],
    [0.36, 0.62, 0.10, 0.7],
    [0.66, 0.34, 0.10, 0.7],
    [0.50, 0.50, 0.05, 0.4],
    [0.30, 0.42, 0.04, 0.3],
    [0.72, 0.62, 0.04, 0.3],
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
  // oscillation
  ax: number
  ay: number
  ar: number
  fx: number
  fy: number
  fr: number
  phx: number
  phy: number
  phr: number
  // slow home drift (low-freq independent wander)
  dax: number
  day: number
  dfx: number
  dfy: number
  dphx: number
  dphy: number
  // per-cell pursuit speed (varies so cells migrate at different paces)
  lerpXY: number
  lerpR: number
  // extra phase for membrane wobble octaves
  phM1: number
  phM2: number
  phM3: number
  phM4: number
}

const makeCells = (n: number): Cell[] => {
  const out: Cell[] = []
  for (let i = 0; i < n; i++) {
    const x = n > 1 ? 0.30 + (i / (n - 1)) * 0.40 : 0.5
    out.push({
      x,
      y: 0.5,
      r: 0,
      w: 1.0,
      hx: 0.5,
      hy: 0.5,
      hr: 0.001,
      hw: 1.0,
      ax: 0.018 + Math.random() * 0.028,
      ay: 0.018 + Math.random() * 0.028,
      ar: 0.10 + Math.random() * 0.14,
      fx: 0.30 + Math.random() * 0.40,
      fy: 0.28 + Math.random() * 0.40,
      fr: 0.45 + Math.random() * 0.65,
      phx: Math.random() * Math.PI * 2,
      phy: Math.random() * Math.PI * 2,
      phr: Math.random() * Math.PI * 2,
      dax: 0.02 + Math.random() * 0.025,
      day: 0.02 + Math.random() * 0.025,
      dfx: 0.05 + Math.random() * 0.08,
      dfy: 0.045 + Math.random() * 0.08,
      dphx: Math.random() * Math.PI * 2,
      dphy: Math.random() * Math.PI * 2,
      lerpXY: 0.05 + Math.random() * 0.06,
      lerpR: 0.04 + Math.random() * 0.05,
      phM1: Math.random() * Math.PI * 2,
      phM2: Math.random() * Math.PI * 2,
      phM3: Math.random() * Math.PI * 2,
      phM4: Math.random() * Math.PI * 2,
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

// ── field — step falloff for HARD edges + multi-octave wobble ──────────

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
    // multi-octave membrane wobble — per-cell phases give each cell a
    // distinct living edge (more organic, more random)
    const wob =
      0.13 * Math.sin(dx * 7 + dy * 5 + t * 0.55 + c.phM1) +
      0.08 * Math.cos(dx * 4 - dy * 12 + t * 0.75 + c.phM2) +
      0.05 * Math.sin(dx * 19 - dy * 9 + t * 1.05 + c.phM3) +
      0.03 * Math.cos(dx * 27 + dy * 23 + t * 1.55 + c.phM4)
    const r = c.r * (1 + wob)
    const r2 = r * r
    const d2 = dx * dx + dy * dy
    if (d2 < r2) b += c.w
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

// ── hover scramble (port of old VygrText logic) ────────────────────────
// Keyed per "word slot" in the text grid (row + startCol). When the cursor
// enters a word for the first time, a scramble record starts; chars in
// the word scramble staggered by position; each char locks back after
// HOVER_SCRAMBLE_WINDOW. When the cursor leaves and the cooldown elapses,
// the slot can fire again.

type HoverScramble = {
  start: number
  row: number
  startCol: number
  length: number
  glyphs: string[]
  lastRoll: number
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
  threshold = 0.5,
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
  const cursorRef = useRef({ x: -1, y: -1 })
  const scramblesRef = useRef<Map<string, HoverScramble>>(new Map())
  const lastHoveredKeyRef = useRef<string | null>(null)

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
      // 1-col safety margin to absorb sub-pixel rounding (mobile especially)
      const cols = Math.max(8, Math.floor(rect.width / charW) - 1)
      const rows = Math.max(4, Math.floor(rect.height / lineH))
      dimsRef.current = { cols, rows }
      textGridRef.current = buildTextGrid(cols, rows, text)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(cont)
    // re-measure after web fonts swap in (cheap insurance against metric change)
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => measure())
    }

    assignHomes(cellsRef.current, FORMATIONS[0])
    startTimeRef.current = performance.now()
    let raf = 0

    const onPointerMove = (clientX: number, clientY: number) => {
      const r = cont.getBoundingClientRect()
      cursorRef.current.x = clamp((clientX - r.left) / r.width, 0, 1)
      cursorRef.current.y = clamp((clientY - r.top) / r.height, 0, 1)
    }
    const handleMouseMove = (e: MouseEvent) =>
      onPointerMove(e.clientX, e.clientY)
    const handleMouseLeave = () => {
      cursorRef.current.x = -1
      cursorRef.current.y = -1
      lastHoveredKeyRef.current = null
    }
    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) onPointerMove(t.clientX, t.clientY)
    }
    const handleTouchEnd = () => {
      cursorRef.current.x = -1
      cursorRef.current.y = -1
      lastHoveredKeyRef.current = null
    }
    const handleClick = () => {
      const now = (performance.now() - startTimeRef.current) / 1000
      if (now < EXPANSION_END) return
      clickBoostsRef.current += 1
      lastSlotRef.current = -2
    }

    cont.addEventListener("mousemove", handleMouseMove)
    cont.addEventListener("mouseleave", handleMouseLeave)
    cont.addEventListener("touchmove", handleTouchMove)
    cont.addEventListener("touchend", handleTouchEnd)
    cont.addEventListener("click", handleClick)

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
      const typingT = Math.min(tNow, TYPEWRITER_END)
      const lockedChars: { col: number; ch: string; centerDist: number }[] = []
      const phraseHalf = phrase.length / 2
      let absIdx = 0
      let col = startCol
      for (let i = 0; i < phrase.length; i++) {
        const ch = phrase[i]
        if (ch === " ") {
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
      if (lockedChars.length > 0) {
        const fadeStart = TYPEWRITER_END + HOLD_DUR
        const fadeWindow = EXPANSION_END - fadeStart
        const fadeProgress = clamp((tNow - fadeStart) / fadeWindow, 0, 1)
        for (const { col, ch, centerDist } of lockedChars) {
          const charFadeStart = (1 - centerDist) * 0.6
          const charFadeEnd = charFadeStart + 0.35
          if (fadeProgress < charFadeStart) {
            out.push({ col, ch })
          } else if (fadeProgress < charFadeEnd) {
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
        if (
          slot !== lastSlotRef.current ||
          formationIdxRef.current !== desiredIdx
        ) {
          lastSlotRef.current = slot
          formationIdxRef.current = desiredIdx
          assignHomes(cellsRef.current, FORMATIONS[desiredIdx])
        }
      }

      // ── radii entrance ramp ──
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

      // ── update cells with slow home drift + per-cell pursuit ──
      const cells = cellsRef.current
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i]
        // slow independent wander on top of home
        const driftHx =
          c.hx + c.dax * Math.sin(tNow * c.dfx * 2 * Math.PI + c.dphx)
        const driftHy =
          c.hy + c.day * Math.sin(tNow * c.dfy * 2 * Math.PI + c.dphy)
        const desX =
          driftHx + c.ax * Math.sin(tNow * c.fx * 2 * Math.PI + c.phx)
        const desY =
          driftHy + c.ay * Math.sin(tNow * c.fy * 2 * Math.PI + c.phy)
        const desR =
          c.hr *
          (1 + c.ar * Math.sin(tNow * c.fr * 2 * Math.PI + c.phr)) *
          entranceR
        c.x += (desX - c.x) * c.lerpXY
        c.y += (desY - c.y) * c.lerpXY
        c.r += (desR - c.r) * c.lerpR
        c.w += (c.hw - c.w) * 0.05
      }

      // ── render field (hard edge, no shimmer) ──
      if (entranceR > 0.01) {
        const textGrid = textGridRef.current
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const nx = c / cols
            const ny = r / rows
            const b = fieldAt(nx, ny, cells, tNow)
            if (b < threshold) continue
            const ch = textGrid[r * cols + c]
            if (!ch || !ch.trim()) continue
            buf[r * cols + c] = ch
          }
        }
      }

      // ── typewriter overlay ──
      if (tNow < EXPANSION_END) {
        const row = Math.floor(rows / 2)
        const chars = buildTypewriterFrame(tNow, cols)
        for (let i = 0; i < chars.length; i++) {
          const { col, ch } = chars[i]
          if (col < 0 || col >= cols) continue
          buf[row * cols + col] = ch
        }
      }

      // ── hover scramble (word-based, aino/old VygrText style) ──
      const cur = cursorRef.current
      if (cur.x >= 0) {
        const col = Math.round(cur.x * cols)
        const row = Math.round(cur.y * rows)
        if (row >= 0 && row < rows && col >= 0 && col < cols) {
          // only trigger if a glyph is currently visible at this cell
          const visible = buf[row * cols + col]
          if (visible && visible !== " ") {
            // find word extent in textGrid for stable word slot
            const textGrid = textGridRef.current
            let s = col
            while (
              s > 0 &&
              textGrid[row * cols + (s - 1)] &&
              textGrid[row * cols + (s - 1)] !== " "
            )
              s--
            let e = col
            while (
              e < cols - 1 &&
              textGrid[row * cols + (e + 1)] &&
              textGrid[row * cols + (e + 1)] !== " "
            )
              e++
            const length = e - s + 1
            const key = `${row}:${s}`
            if (key !== lastHoveredKeyRef.current) {
              lastHoveredKeyRef.current = key
              if (!scramblesRef.current.has(key)) {
                const glyphs: string[] = new Array(length)
                for (let g = 0; g < length; g++) {
                  glyphs[g] =
                    SCRAMBLE_POOL[
                      Math.floor(Math.random() * SCRAMBLE_POOL.length)
                    ]
                }
                scramblesRef.current.set(key, {
                  start: tNow,
                  row,
                  startCol: s,
                  length,
                  glyphs,
                  lastRoll: tNow,
                })
              }
            }
          } else {
            lastHoveredKeyRef.current = null
          }
        }
      }

      // apply + clean active scrambles
      for (const [key, sc] of scramblesRef.current) {
        const totalDur =
          HOVER_SCRAMBLE_WINDOW + (sc.length - 1) * HOVER_CHAR_STAGGER
        const elapsed = tNow - sc.start
        if (elapsed > totalDur + 0.1) {
          scramblesRef.current.delete(key)
          continue
        }
        // throttled glyph re-roll (only chars currently scrambling get new glyphs)
        const shouldRoll = tNow - sc.lastRoll >= HOVER_SCRAMBLE_TICK
        if (shouldRoll) sc.lastRoll = tNow
        for (let i = 0; i < sc.length; i++) {
          const c = sc.startCol + i
          const idx = sc.row * cols + c
          const bufCh = buf[idx]
          if (!bufCh || bufCh === " ") continue
          const scStart = i * HOVER_CHAR_STAGGER
          const scEnd = scStart + HOVER_SCRAMBLE_WINDOW
          if (elapsed >= scStart && elapsed < scEnd) {
            if (shouldRoll) {
              sc.glyphs[i] =
                SCRAMBLE_POOL[
                  Math.floor(Math.random() * SCRAMBLE_POOL.length)
                ]
            }
            buf[idx] = sc.glyphs[i]
          }
        }
      }

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
