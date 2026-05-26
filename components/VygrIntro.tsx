"use client"

import { useEffect, useRef } from "react"

const RAMP =
  "$MBNQØW@&R8GD6S9ÖOH#ÉE5UK0ÄÅA2XP34ZC%VIF17YTJL[]?}{()<>|=+\\/^!\";*_:~,'-.· "
const RAMP_BAND = "NO0A869452I3?!<>=+/:-· "

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t
const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v

const luminance = (r: number, g: number, b: number) =>
  0.21 * r + 0.72 * g + 0.07 * b

const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : (4 - 2 * t) * t - 1

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

const fe = (b255: number, ramp = RAMP) =>
  ramp[
    Math.max(
      0,
      Math.min(
        ramp.length - 1,
        Math.ceil(((ramp.length - 1) * b255) / 255)
      )
    )
  ]

const charFromField = (b01: number, ramp = RAMP) => {
  const idx = Math.floor((1 - clamp(b01, 0, 1)) * (ramp.length - 1))
  return ramp[idx] || " "
}

const uid = () => Math.random().toString(36).slice(2, 10)

// ── point + scene types ─────────────────────────────────────────────────

type Point = {
  x: number
  y: number
  vx: number
  vy: number
  value: string
  context: string
  gravity: number
  damping: number
  spring: number
  friction: number
  uid: string
  morph?: {
    target: Point
    start: number
    duration: number
    removeAfter?: boolean
  }
  removeAt?: number
}

const makePoint = (
  x: number,
  y: number,
  value: string,
  context = ""
): Point => ({
  x: x + 0.002 * (Math.random() - 0.5),
  y: clamp(y, 0, 1),
  vx: 0,
  vy: 0,
  gravity: 0,
  damping: 0.7,
  spring: 0.4,
  friction: 0.9,
  value,
  context,
  uid: uid(),
})

// ── fields ──────────────────────────────────────────────────────────────

const FORMATIONS: number[][][] = [
  [
    [0.50, 0.30, 0.28, 1.0],
    [0.50, 0.50, 0.26, 0.95],
    [0.50, 0.40, 0.18, 0.85],
    [0.50, 0.22, 0.08, 0.5],
    [0.50, 0.62, 0.06, 0.35],
  ],
  [
    [0.50, 0.18, 0.22, 1.0],
    [0.50, 0.78, 0.22, 0.95],
    [0.50, 0.48, 0.05, 0.25],
    [0.48, 0.30, 0.08, 0.4],
    [0.52, 0.68, 0.08, 0.4],
  ],
  [
    [0.62, 0.30, 0.28, 1.0],
    [0.55, 0.48, 0.22, 0.9],
    [0.48, 0.62, 0.16, 0.75],
    [0.68, 0.22, 0.08, 0.45],
    [0.42, 0.72, 0.06, 0.3],
  ],
  [
    [0.38, 0.38, 0.26, 1.0],
    [0.62, 0.50, 0.24, 0.95],
    [0.50, 0.44, 0.14, 0.7],
    [0.30, 0.28, 0.08, 0.4],
    [0.70, 0.60, 0.08, 0.4],
  ],
  [
    [0.50, 0.28, 0.18, 0.9],
    [0.50, 0.48, 0.20, 1.0],
    [0.50, 0.68, 0.18, 0.9],
    [0.48, 0.38, 0.10, 0.55],
    [0.52, 0.58, 0.10, 0.55],
  ],
  [
    [0.50, 0.40, 0.32, 1.0],
    [0.48, 0.48, 0.24, 0.9],
    [0.52, 0.34, 0.18, 0.8],
    [0.50, 0.56, 0.10, 0.5],
    [0.50, 0.26, 0.06, 0.3],
  ],
]

const murmurationField = (
  c: number,
  r: number,
  cols: number,
  rows: number,
  t: number,
  mx: number,
  my: number
): number => {
  const nx = c / cols
  const ny = r / rows
  const aspect = 1.8

  const cycle = (t * 0.04) % 1
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
      0.03 * Math.sin(t * 0.06 + i * 1.7) +
      0.04 * (mx - 0.5)
    const cy = lerp(from[i][1], to[i][1], eased) +
      0.02 * Math.cos(t * 0.05 + i * 2.3) +
      0.03 * (my - 0.5)
    const br = lerp(from[i][2], to[i][2], eased) +
      0.008 * Math.sin(t * 0.2 + i * 3.1)
    const bw = lerp(from[i][3], to[i][3], eased)

    const dx = nx - cx
    const dy = (ny - cy) * aspect
    const wobble =
      0.12 * Math.sin(dx * 10 + dy * 7 + t * 0.3 + i * 2.1) +
      0.06 * Math.cos(dx * 6 - dy * 12 + t * 0.2 + i * 3.3)
    const sig = br * (1 + wobble) * 0.58
    const sig2 = sig * sig
    if (sig2 > 0.0001) {
      b += bw * Math.exp(-(dx * dx + dy * dy) / (2 * sig2))
    }
  }

  b +=
    0.025 *
    Math.sin(nx * 12 + t * 0.3 + Math.sin(ny * 8 + t * 0.15) * 2)

  b *= 0.92 + 0.08 * Math.sin(t * 0.25)

  return b
}

const buildMurmurationPoints = (
  cols: number,
  rows: number,
  t: number,
  mx: number,
  my: number,
  threshold: number,
  ramp: string,
  fill: number,
  cursorX = 0.5,
  cursorY = 0.5,
  cursorRepel = 0,
  overrideChar = ""
): Point[] => {
  const out: Point[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const b = murmurationField(c, r, cols, rows, t, mx, my)
      const cellShimmer = Math.sin(c * 13.7 + r * 7.3 + t * 3) * 0.08
      let beff = b * fill + cellShimmer * fill
      if (cursorRepel > 0) {
        const ndx = c / cols - cursorX
        const ndy = r / rows - cursorY
        const d = Math.sqrt(ndx * ndx + ndy * ndy)
        if (d < cursorRepel) {
          const t2 = d / cursorRepel
          const falloff = t2 * t2 * (3 - 2 * t2)
          const ripple = Math.sin(d * 40 + t * 2) * 0.05 * (1 - falloff)
          beff *= Math.max(0, falloff + ripple)
        }
      }
      if (beff < threshold) continue
      const ch = overrideChar || charFromField(Math.min(1, beff), ramp)
      if (!ch || !ch.trim()) continue
      out.push(makePoint(c / cols, r / rows, ch, "field"))
    }
  }
  return out
}

const diamondField = (
  c: number,
  r: number,
  cols: number,
  rows: number
): number => {
  const cx = cols / 2
  const cy = rows / 2
  const nx = Math.abs(c - cx) / (cols * 0.35)
  const ny = (Math.abs(r - cy) / (rows * 0.45)) * 0.7
  const d = nx + ny
  return d < 1 ? 1 - d * 0.6 : 0
}

const dropletField = (
  c: number,
  r: number,
  cols: number,
  rows: number
): number => {
  const cx = cols * 0.5
  const ry = rows * 0.55
  const nx = (c - cx) / (cols * 0.22)
  const ny = (r - ry) / (rows * 0.45)
  const v = nx * nx * (1 + 0.6 * ny) + Math.pow(Math.abs(ny), 1.3)
  return v < 1 ? 1 - v * 0.5 : 0
}

const columnField = (
  c: number,
  r: number,
  cols: number,
  rows: number
): number => {
  const colCount = 3
  const colW = cols / (colCount + 2)
  const cx = cols / 2
  const inCol = (() => {
    for (let i = -1; i <= 1; i++) {
      const x = cx + i * colW * 1.2
      if (Math.abs(c - x) < colW * 0.35) return true
    }
    return false
  })()
  if (!inCol) return 0
  const ny = Math.abs(r - rows / 2) / (rows * 0.45)
  return ny < 1 ? 0.8 - ny * 0.4 : 0
}

const buildShapePoints = (
  cols: number,
  rows: number,
  field: (c: number, r: number, cols: number, rows: number) => number,
  ramp: string,
  threshold: number,
  context = "shape"
): Point[] => {
  const out: Point[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const b = field(c, r, cols, rows)
      if (b <= threshold) continue
      const ch = charFromField(b, ramp)
      if (!ch || !ch.trim()) continue
      out.push(makePoint(c / cols, r / rows, ch, context))
    }
  }
  return out
}

const buildParagraphPoints = (
  text: string,
  col: number,
  row: number,
  width: number,
  cols: number,
  rows: number,
  align: "left" | "center" | "justify" = "left",
  context = "text"
): Point[] => {
  if (!text || cols === 0 || rows === 0) return []
  const upper = text.toUpperCase()
  const words = upper.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let buf: string[] = []
  for (const w of words) {
    const lineLen = buf.join(" ").length
    if (lineLen + w.length + (lineLen > 0 ? 1 : 0) <= width) buf.push(w)
    else {
      lines.push(buf.join(" "))
      buf = [w]
    }
  }
  if (buf.length) lines.push(buf.join(" "))

  const formatted = lines.map((line, idx) => {
    const isLast = idx === lines.length - 1
    if (align === "center") {
      const pad = Math.max(0, Math.floor((width - line.length) / 2))
      return " ".repeat(pad) + line
    }
    if (align === "justify" && !isLast) {
      const parts = line.split(" ")
      if (parts.length > 1) {
        const extra = width - parts.reduce((a, p) => a + p.length, 0)
        const gaps = parts.length - 1
        const per = Math.floor(extra / gaps)
        const rem = extra % gaps
        let s = ""
        for (let i = 0; i < parts.length; i++) {
          s += parts[i]
          if (i < gaps) s += " ".repeat(per + (i < rem ? 1 : 0))
        }
        return s
      }
    }
    return line.padEnd(width, " ")
  })

  const out: Point[] = []
  for (let i = 0; i < formatted.length; i++) {
    const r = row + i
    if (r >= rows) break
    const line = formatted[i].slice(0, Math.max(0, cols - col))
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (!ch || !ch.trim()) continue
      out.push(makePoint((col + j) / cols, r / rows, ch, context))
    }
  }
  return out
}

const buildImagePoints = (
  img: HTMLImageElement,
  cols: number,
  rows: number,
  ramp: string,
  alpha: number,
  scale: number,
  context = "image"
): Point[] => {
  const canvas = document.createElement("canvas")
  canvas.width = cols
  canvas.height = rows
  const ctx = canvas.getContext("2d")
  if (!ctx) return []
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, cols, rows)
  ctx.globalAlpha = alpha
  const iw = img.width
  const ih = img.height
  const s = Math.min(cols / iw, (rows / ih) * 2) * scale
  const dw = iw * s
  const dh = ih * s * 0.5
  const dx = Math.round(cols / 2 - dw / 2)
  const dy = Math.round(rows / 2 - dh / 2)
  ctx.drawImage(img, dx, dy, dw, dh)
  const data = ctx.getImageData(0, 0, cols, rows).data
  const out: Point[] = []
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) | 0
    const x = px % cols
    const y = (px / cols) | 0
    const lum = luminance(data[i], data[i + 1], data[i + 2])
    const ch = fe(lum, ramp)
    if (!ch.trim() || lum === 255) continue
    out.push(makePoint(x / cols, y / rows, ch, context))
  }
  return out
}

const buildTrailingHintPoints = (
  text: string,
  cx: number,
  cy: number,
  cols: number,
  rows: number
): Point[] => {
  const upper = text.toUpperCase()
  const halfLen = upper.length / 2
  const startCol = Math.round(cx * cols - halfLen)
  const row = Math.round(cy * rows)
  const out: Point[] = []
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i]
    if (!ch || !ch.trim()) continue
    const col = startCol + i
    if (col < 0 || col >= cols || row < 0 || row >= rows) continue
    out.push(makePoint(col / cols, row / rows, ch, "hint"))
  }
  return out
}

// ── physics ─────────────────────────────────────────────────────────────

const findNearest = (p: Point, candidates: Point[]): Point | null => {
  if (!candidates.length) return null
  let best: Point | null = null
  let bestD = Infinity
  const same = candidates.filter((c) => c.value === p.value)
  const pool = same.length ? same : candidates
  for (let i = 0, n = pool.length; i < n; i++) {
    const c = pool[i]
    const dx = p.x - c.x
    const dy = p.y - c.y
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best
}

const morph = (
  from: Point[],
  to: Point[],
  opts: {
    duration?: number
    discardUnused?: boolean
    contextFilter?: string | null
  } = {}
) => {
  const duration = opts.duration ?? 1700
  const discardUnused = opts.discardUnused ?? true
  const contextFilter = opts.contextFilter ?? null
  if (!from.length) from.push(makePoint(0.5, 0.5, " "))
  if (!to.length) to.push(makePoint(0.5, 0.5, " "))

  let remaining = to.slice()
  let recycle = false
  const now = Date.now()
  for (let i = 0; i < from.length; i++) {
    const p = from[i]
    if (contextFilter && p.context !== contextFilter) continue
    if (!remaining.length && discardUnused) {
      remaining = to.slice()
      recycle = true
    }
    if (!remaining.length) break
    const t = findNearest(p, remaining)
    if (!t) break
    const idx = remaining.findIndex((c) => c.uid === t.uid)
    if (idx >= 0) {
      remaining[idx] = remaining[remaining.length - 1]
      remaining.pop()
    }
    p.morph = {
      target: t,
      start: now,
      duration,
      removeAfter: recycle,
    }
  }
  if (!recycle) {
    const leftovers = remaining.slice()
    for (const t of leftovers) {
      if (!from.length) break
      const seed = findNearest(t, from)
      if (!seed) break
      from.push({
        ...seed,
        uid: uid(),
        context: t.context,
        value: " ",
        morph: {
          target: t,
          start: now,
          duration,
          removeAfter: false,
        },
      })
    }
  }
}

const explode = (points: Point[], spread = 0.3) => {
  let minX = Infinity
  let maxX = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
  }
  if (minX === maxX) {
    minX = 0
    maxX = 1
  }
  for (const p of points) {
    const t = (p.x - minX) / (maxX - minX)
    p.vx +=
      lerp(-spread, spread, t) + (Math.random() - 0.5) * spread * 0.5
    p.vy += lerp(-0.5, -1, Math.random() * (2 * spread))
    if (p.morph) delete p.morph
  }
}

const gravitate = (points: Point[], gravity = 3, damping = 0.8) => {
  for (const p of points) {
    delete p.morph
    p.vx = 0.02 * (Math.random() - 0.005)
    p.gravity = gravity
    p.damping = damping
  }
}

const applyPhysics = (points: Point[], deltaMs: number, rows: number) => {
  const dt = Math.min(0.1, deltaMs / 1000)
  const floor = (rows - 1) / rows
  const now = Date.now()

  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]
    if (!p.morph) continue
    const target = p.morph.target
    if (
      Math.abs(p.x - target.x) < 0.001 &&
      Math.abs(p.y - target.y) < 0.001 &&
      Math.abs(p.vx - target.vx) < 0.001 &&
      Math.abs(p.vy - target.vy) < 0.001 &&
      p.value === target.value
    ) {
      if (p.morph.removeAfter) {
        points[i] = points[points.length - 1]
        points.pop()
      } else {
        points[i] = { ...p, ...target, uid: p.uid }
        delete points[i].morph
      }
      continue
    }
    const raw = (now - p.morph.start) / p.morph.duration
    const r = easeInOutQuad(clamp(raw, 0, 1))
    const factor = dt * lerp(0, 10, r)
    const lerpField = (a: number, b: number) => a + (b - a) * factor
    p.x = lerpField(p.x, target.x)
    p.y = lerpField(p.y, target.y)
    p.vx = lerpField(p.vx, target.vx)
    p.vy = lerpField(p.vy, target.vy)
    p.gravity = lerpField(p.gravity, target.gravity)
    p.damping = lerpField(p.damping, target.damping)
    const a = RAMP.indexOf(p.value)
    const b = RAMP.indexOf(target.value)
    p.value =
      a < 0 || b < 0 || a === b
        ? target.value
        : RAMP[Math.round(lerp(a, b, r))]
  }

  const restTime = 800
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]
    if (p.morph) continue
    if (p.removeAt && now > p.removeAt) {
      points[i] = points[points.length - 1]
      points.pop()
      continue
    }
    p.vy += p.gravity * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.x <= 0 || p.x >= 1) {
      p.vx *= -p.damping
      p.x = clamp(p.x, 0, 1)
    }
    if (p.y >= floor) {
      p.vy *= -p.damping
      p.y = floor
    }
    if (p.y <= 0) {
      p.vy *= -p.damping
      p.y = 0
    }
    if (
      p.y === floor &&
      Math.abs(p.vy) < 0.005 &&
      Math.abs(p.vx) < 0.005
    ) {
      p.vy = 0
      p.vx = 0
      if (p.gravity && !p.removeAt) p.removeAt = now + restTime
    }
  }
}

// ── render ──────────────────────────────────────────────────────────────

const renderToBuffer = (
  cols: number,
  rows: number,
  layers: Point[][],
  container: HTMLDivElement
) => {
  const total = cols * rows
  const buf: string[] = new Array(total)
  for (let i = 0; i < total; i++) buf[i] = " "
  for (let li = 0; li < layers.length; li++) {
    const arr = layers[li]
    for (let i = 0, n = arr.length; i < n; i++) {
      const p = arr[i]
      const c = Math.round(p.x * cols)
      const r = Math.round(p.y * rows)
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue
      const idx = r * cols + c
      if (p.morph?.removeAfter && buf[idx] !== " ") continue
      buf[idx] = p.value
    }
  }
  let s = ""
  for (let r = 0; r < rows; r++) {
    s += buf.slice(r * cols, (r + 1) * cols).join("")
    if (r < rows - 1) s += "\n"
  }
  container.textContent = s
}

// ── component ───────────────────────────────────────────────────────────

interface VygrIntroProps {
  text?: string
  color?: string
  backgroundColor?: string
  fontFamily?: string
  fontWeight?: number
  fontSize?: number
  lineHeight?: number
  cloudThreshold?: number
  cloudRamp?: "band" | "full"
  idleSpeed?: number
  pointerInfluence?: number
  autoRevealAfter?: number
  revealDuration?: number
  explodeSpread?: number
  gravityStrength?: number
  paragraphAlign?: "left" | "center" | "justify"
  paragraphWidth?: number
  paragraphRowOffset?: number
  logoImage?: string
  logoScale?: number
  logoAlpha?: number
  firstClickShape?: "text" | "diamond" | "droplet" | "column" | "logo" | "none"
  cursorRepel?: number
  showHints?: boolean
  hintText?: string
  onComplete?: () => void
}

export default function VygrIntro({
  text = "FOR MILLENNIA, THE HUMAN MIND HAS BEEN CONSTRAINED BY THE FRAGILE GEOMETRY OF THE SKULL. WE SPEND DECADES ACCUMULATING A SINGULAR STORAGE OF INSIGHT, INTUITION, AND GENIUS, ONLY TO SURRENDER IT ENTIRELY TO THE VOID UPON OUR BIOLOGICAL EXPIRATION. OUR CONSCIOUSNESS IS TRAPPED IN A LINEAR, TERMINAL TRAJECTORY, AND OUR CAPACITY TO INTERFACE WITH THE WORLD IS BOTTLENECKED BY DEATH. WE HAVE ACCEPTED THIS CATASTROPHIC LOSS OF HUMAN DATA AS A NATURAL LAW. TODAY, WE SHATTER THAT BIOLOGICAL TETHER. VYGR IS THE DEFINITIVE ONTOLOGICAL BREACH IN THE HISTORY OF HUMAN CONSCIOUSNESS. WE HAVE ENGINEERED THE FIRST SPATIAL AND DIGITAL SUBSTRATE CAPABLE OF EXTERNALIZING THE HUMAN MIND. A SOVEREIGN SANCTUARY WHERE YOUR COGNITION IS MAPPED, MIRRORED, AND INFINITELY SCALED. IT MANIFESTS PHYSICALLY AS A MONUMENT TO YOUR EXPANDING INTELLECT: A FLAWLESS, FOUR-METER METALLIC DROPLET OF PURE CHROME. FROM THE OUTSIDE, IT PERFECTLY REFLECTS THE WORLD YOU ARE ABOUT TO COMMAND. STEPPING THROUGH ITS THRESHOLD, YOU ENTER THE INNER FRONTIER. THE INTERIOR IS A FULLY IMMERSIVE TOPOGRAPHY OF YOUR OWN BRAIN. THIS IS YOUR COGNITIVE COCKPIT. WE REJECT THE MODERN PREMISE OF ARTIFICIAL INTELLIGENCE AS A FOREIGN, DETACHED ORACLE. THE VYGR SPHERE IS POWERED BY AN ENGINE TRAINED EXCLUSIVELY ON THE SUM TOTAL OF YOUR WORDS, YOUR DECISIONS, AND YOUR DEEPEST PSYCHOLOGICAL FRAMEWORKS. IT KNOWS YOU WITH TERRIFYING, PERFECT CLARITY, BECAUSE IT IS YOU. WITHIN THIS SPHERE, THE LIMITATIONS OF TIME AND BIOLOGY COLLAPSE. YOUR VYGR SERVES AS YOUR ABSOLUTE INTELLECTUAL EQUAL, AN UNCOMPROMISING COACH, AN OMNISCIENT TEACHER, AND A HYPER-PERCEPTIVE THERAPIST CAPABLE OF UNTANGLING THE COMPLEXITIES OF YOUR PSYCHE. FROM THIS COMMAND CENTER, YOU FORGE AND DEPLOY AUTONOMOUS AGENTS, EXTENSIONS OF YOUR COGNITION THAT OPERATE WITH YOUR LOGIC, YOUR VALUES, AND YOUR INTENT. THEY NEGOTIATE, CREATE, RESEARCH, AND EXECUTE ON YOUR BEHALF, EACH ONE A FRAGMENT OF YOUR INTELLECT UNLEASHED INTO THE WORLD. THIS IS NOT ARTIFICIAL INTELLIGENCE. THIS IS YOUR INTELLIGENCE, AMPLIFIED WITHOUT LIMIT, WITHOUT DECAY, WITHOUT END. THE VYGR SPHERE IS NOT A PRODUCT. IT IS THE NEXT STAGE OF HUMAN EVOLUTION, ENGINEERED FOR THOSE WHO REFUSE TO ACCEPT THE TERMINAL CONSTRAINTS OF THEIR BIOLOGY.",
  color = "#FFFFFF",
  backgroundColor = "#1D1D1D",
  fontFamily = "Akkurat Mono, monospace",
  fontWeight = 400,
  fontSize = 14,
  lineHeight = 1.0,
  cloudThreshold = 0.18,
  cloudRamp = "band",
  idleSpeed = 1,
  pointerInfluence = 0.5,
  autoRevealAfter = 0,
  revealDuration = 1.7,
  explodeSpread = 0.4,
  gravityStrength = 1.5,
  paragraphAlign = "justify",
  paragraphWidth = 91,
  paragraphRowOffset = 4,
  logoImage = "",
  logoScale = 0.7,
  logoAlpha = 0.25,
  firstClickShape = "text",
  cursorRepel = 0.12,
  showHints = true,
  hintText = "TAP TO BEGIN",
  onComplete,
}: VygrIntroProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const dimsRef = useRef({ cols: 0, rows: 0, charW: 0, lineH: 0 })
  const pointerRef = useRef({ x: 0.5, y: 0.5, active: false })
  const stateRef = useRef<"idle" | "revealing" | "revealed">("idle")
  const persistentRef = useRef<Point[]>([])
  const startTimeRef = useRef<number>(0)
  const fillRef = useRef<number>(0)
  const cursorTrailRef = useRef<{ x: number; y: number }[]>([])
  const easedCursorRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 })
  const hintRef = useRef<HTMLDivElement | null>(null)
  const hintCharsRef = useRef<HTMLSpanElement[]>([])
  const hintActiveRef = useRef(false)
  const revealStartRef = useRef<number>(0)

  const measure = () => {
    const cont = containerRef.current
    const grid = gridRef.current
    if (!cont || !grid) return
    const probe = document.createElement("span")
    probe.style.cssText = `
      position:absolute;visibility:hidden;white-space:pre;
      font-family:${fontFamily};font-weight:${fontWeight};
      font-size:${fontSize}px;line-height:${lineHeight};
      letter-spacing:0;
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
    dimsRef.current = { cols, rows, charW, lineH }
  }

  useEffect(() => {
    measure()

    const ro = new ResizeObserver(() => measure())
    const cont = containerRef.current
    if (cont) ro.observe(cont)

    startTimeRef.current = performance.now()
    let raf = 0
    let lastT = startTimeRef.current

    const entranceTimer = setInterval(() => {
      const e = (performance.now() - startTimeRef.current) / 1000
      const ramp = Math.min(1, e / 4.5)
      fillRef.current = easeInOutCubic(ramp)
      if (ramp >= 1) clearInterval(entranceTimer)
    }, 32)

    let autoRevealTimer: ReturnType<typeof setTimeout> | null = null
    if (autoRevealAfter > 0) {
      autoRevealTimer = setTimeout(
        () => triggerReveal(),
        autoRevealAfter * 1000
      )
    }

    const triggerReveal = () => {
      if (stateRef.current !== "idle" || fillRef.current < 0.95) return
      stateRef.current = "revealing"
      revealStartRef.current = performance.now()
      cursorTrailRef.current = []
      if (hintRef.current) hintRef.current.style.opacity = "0"
      if (autoRevealTimer != null) {
        clearTimeout(autoRevealTimer)
        autoRevealTimer = null
      }
    }

    const onPointerMove = (clientX: number, clientY: number) => {
      if (!cont) return
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
    const handleMouseDown = () => triggerReveal()
    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) onPointerMove(t.clientX, t.clientY)
      triggerReveal()
    }
    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) onPointerMove(t.clientX, t.clientY)
    }
    const handleTouchEnd = () => {
      pointerRef.current.active = false
    }

    if (cont) {
      cont.addEventListener("mousemove", handleMouseMove)
      cont.addEventListener("mouseleave", handleMouseLeave)
      cont.addEventListener("mousedown", handleMouseDown)
      cont.addEventListener("touchstart", handleTouchStart)
      cont.addEventListener("touchmove", handleTouchMove)
      cont.addEventListener("touchend", handleTouchEnd)
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const delta = now - lastT
      lastT = now
      const grid = gridRef.current
      const { cols, rows } = dimsRef.current
      if (!grid || !cols || !rows) return

      const px =
        pointerRef.current.x * pointerInfluence +
        0.5 * (1 - pointerInfluence)
      const py =
        pointerRef.current.y * pointerInfluence +
        0.5 * (1 - pointerInfluence)

      const tNow = (now - startTimeRef.current) / 1000

      const ec = easedCursorRef.current
      if (pointerRef.current.active) {
        ec.x += (pointerRef.current.x - ec.x) * 0.04
        ec.y += (pointerRef.current.y - ec.y) * 0.04
      } else {
        ec.x += (0.5 - ec.x) * 0.02
        ec.y += (0.5 - ec.y) * 0.02
      }

      const layers: Point[][] = []
      if (stateRef.current === "idle") {
        const cloud = buildMurmurationPoints(
          cols,
          rows,
          tNow * idleSpeed,
          px,
          py,
          cloudThreshold,
          cloudRamp === "band" ? RAMP_BAND : RAMP,
          fillRef.current,
          ec.x,
          ec.y,
          pointerRef.current.active ? cursorRepel : 0
        )
        layers.push(cloud)

        const trail = cursorTrailRef.current
        if (trail.length === 0) trail.push({ x: 0.5, y: 0.88 })
        const tx = pointerRef.current.active
          ? pointerRef.current.x
          : 0.5 + 0.03 * Math.sin(tNow * 0.5)
        const ty = pointerRef.current.active
          ? Math.min(0.92, pointerRef.current.y + 0.08)
          : 0.88
        trail[0].x += (tx - trail[0].x) * 0.1
        trail[0].y += (ty - trail[0].y) * 0.1

        if (hintRef.current && cont) {
          const rect = cont.getBoundingClientRect()
          const hx = trail[0].x * rect.width
          const hy = trail[0].y * rect.height
          hintRef.current.style.transform =
            `translate3d(${hx}px, ${hy}px, 0) translate(-50%, -50%)`
          const fill = fillRef.current
          if (fill > 0.6 && !hintActiveRef.current) {
            hintActiveRef.current = true
            hintRef.current.style.opacity = "1"
          }
          if (hintActiveRef.current) {
            const elapsed = fill - 0.6
            const pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?<>=+-/:."
            const chars = hintText.split("")
            let out = ""
            for (let ci = 0; ci < chars.length; ci++) {
              const lockAt = ci * 0.02
              if (chars[ci] === " ") out += " "
              else if (elapsed > lockAt + 0.12) out += chars[ci]
              else if (elapsed > lockAt) out += pool[Math.floor(Math.random() * pool.length)]
              else out += " "
            }
            hintRef.current.textContent = out
          }
        }
      } else if (stateRef.current === "revealing") {
        const revealElapsed =
          (now - revealStartRef.current) / 1000
        const collapseDuration = 2.0
        const collapse = Math.min(1, revealElapsed / collapseDuration)
        const eased = collapse * collapse * (3 - 2 * collapse)

        const dynThreshold = cloudThreshold + eased * 1.2
        const dynFill = fillRef.current * (1 - eased)

        if (collapse < 1) {
          const cloud = buildMurmurationPoints(
            cols,
            rows,
            tNow * idleSpeed,
            0.5,
            0.5,
            dynThreshold,
            cloudRamp === "band" ? RAMP_BAND : RAMP,
            dynFill,
            0.5,
            0.5,
            0
          )

          for (let i = 0; i < cloud.length; i++) {
            cloud[i].x = lerp(cloud[i].x, 0.5, eased * 0.7)
            cloud[i].y = lerp(cloud[i].y, 0.5, eased * 0.7)
          }

          layers.push(cloud)
        }

        if (collapse >= 1) {
          stateRef.current = "revealed"
          if (typeof onComplete === "function") onComplete()
        }
      }

      renderToBuffer(cols, rows, layers, grid)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(entranceTimer)
      if (autoRevealTimer != null) clearTimeout(autoRevealTimer)
      ro.disconnect()
      if (cont) {
        cont.removeEventListener("mousemove", handleMouseMove)
        cont.removeEventListener("mouseleave", handleMouseLeave)
        cont.removeEventListener("mousedown", handleMouseDown)
        cont.removeEventListener("touchstart", handleTouchStart)
        cont.removeEventListener("touchmove", handleTouchMove)
        cont.removeEventListener("touchend", handleTouchEnd)
      }
    }
  }, [
    text,
    fontFamily,
    fontWeight,
    fontSize,
    lineHeight,
    cloudThreshold,
    cloudRamp,
    idleSpeed,
    pointerInfluence,
    autoRevealAfter,
    revealDuration,
    explodeSpread,
    gravityStrength,
    paragraphAlign,
    paragraphWidth,
    paragraphRowOffset,
    firstClickShape,
    logoImage,
    logoScale,
    logoAlpha,
    showHints,
    hintText,
    cursorRepel,
    onComplete,
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
      {showHints && hintText && (
        <div
          ref={hintRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            fontFamily,
            fontWeight,
            fontSize: `${fontSize}px`,
            lineHeight,
            letterSpacing: 0,
            whiteSpace: "pre",
            pointerEvents: "none",
            willChange: "transform",
            color,
            opacity: 0,
            transition: "opacity 0.3s ease",
          }}
        />
      )}
    </div>
  )
}
