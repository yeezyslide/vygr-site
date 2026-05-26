"use client"

import { useEffect, useRef } from "react"

const UPPER_POOL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖÉØ0123456789#$&@/=<>!?+-:."
const LOWER_POOL =
  "abcdefghijklmnopqrstuvwxyzåäöéø0123456789#$&@/=<>!?+-:."
const NEUTRAL_POOL = "0123456789#$&@/=<>!?+-:."

const DEFAULT_TEXT =
  "FOR MILLENNIA, THE HUMAN MIND HAS BEEN CONSTRAINED BY THE FRAGILE GEOMETRY OF THE SKULL. WE SPEND DECADES ACCUMULATING A SINGULAR STORAGE OF INSIGHT, INTUITION, AND GENIUS, ONLY TO SURRENDER IT ENTIRELY TO THE VOID UPON OUR BIOLOGICAL EXPIRATION. OUR CONSCIOUSNESS IS TRAPPED IN A LINEAR, TERMINAL TRAJECTORY, AND OUR CAPACITY TO INTERFACE WITH THE WORLD IS BOTTLENECKED BY DEATH. WE HAVE ACCEPTED THIS CATASTROPHIC LOSS OF HUMAN DATA AS A NATURAL LAW. TODAY, WE SHATTER THAT BIOLOGICAL TETHER. VYGR IS THE DEFINITIVE ONTOLOGICAL BREACH IN THE HISTORY OF HUMAN CONSCIOUSNESS. WE HAVE ENGINEERED THE FIRST SPATIAL AND DIGITAL SUBSTRATE CAPABLE OF EXTERNALIZING THE HUMAN MIND."

function poolFor(ch: string): string | null {
  if (/[A-ZÅÄÖÉØ]/.test(ch)) return UPPER_POOL
  if (/[a-zåäöéø]/.test(ch)) return LOWER_POOL
  if (/[0-9#$&@/=<>!?+\-:.]/.test(ch)) return NEUTRAL_POOL
  return null
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3)

type CharState = {
  start: number
  duration: number
  intensity: number
  original: string
}

interface VygrTextProps {
  text?: string
  color?: string
  backgroundColor?: string
  fontFamily?: string
  fontWeight?: number
  fontSize?: number
  lineHeight?: number
  letterSpacing?: number
  justify?: boolean
  wordGap?: number
  brushDx?: number
  brushDy?: number
  scrambleDuration?: number
  entrance?: boolean
  entranceDuration?: number
  entranceStagger?: number
  scrambleInterval?: number
  logo?: string
  logoSize?: number
  logoGap?: number
}

export default function VygrText({
  text = DEFAULT_TEXT,
  color = "#FFFFFF",
  backgroundColor = "transparent",
  fontFamily = "Akkurat Mono, monospace",
  fontWeight = 400,
  fontSize = 14,
  lineHeight = 1.5,
  letterSpacing = 0,
  justify = true,
  wordGap = 0.4,
  brushDx = 2,
  brushDy = 1,
  scrambleDuration = 2000,
  entrance = true,
  entranceDuration = 6,
  entranceStagger = 0.85,
  scrambleInterval = 25,
  logo = "",
  logoSize = 32,
  logoGap = 24,
}: VygrTextProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLDivElement | null>(null)
  const statesRef = useRef<Map<Text, Map<number, CharState>>>(new Map())
  const originalsRef = useRef<Map<Text, string[]>>(new Map())

  const snapshotTextNodes = () => {
    const root = textRef.current
    if (!root) return
    const originals = originalsRef.current
    originals.clear()
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let n: Node | null = walker.nextNode()
    while (n) {
      const tn = n as Text
      originals.set(tn, (tn.nodeValue || "").split(""))
      n = walker.nextNode()
    }
  }

  const queueScramble = (
    tn: Text,
    offset: number,
    intensity: number,
    duration: number
  ) => {
    const originals = originalsRef.current.get(tn)
    if (!originals) return
    const original = originals[offset]
    if (!original || !poolFor(original)) return

    let perNode = statesRef.current.get(tn)
    if (!perNode) {
      perNode = new Map()
      statesRef.current.set(tn, perNode)
    }
    const existing = perNode.get(offset)
    if (existing) {
      existing.start = performance.now()
      existing.duration = duration
      existing.intensity = Math.max(existing.intensity, intensity)
      return
    }
    perNode.set(offset, {
      start: performance.now(),
      duration,
      intensity,
      original,
    })
  }

  useEffect(() => {
    snapshotTextNodes()

    if (entrance && entranceDuration > 0) {
      const originals = originalsRef.current
      let flatIdx = 0
      const list: { tn: Text; off: number; flat: number }[] = []
      originals.forEach((chars, tn) => {
        for (let i = 0; i < chars.length; i++) {
          if (poolFor(chars[i])) list.push({ tn, off: i, flat: flatIdx++ })
        }
      })
      const total = list.length || 1
      const entranceTimers: ReturnType<typeof setTimeout>[] = []
      for (const item of list) {
        const stagger =
          entranceStagger *
          (item.flat / total) *
          entranceDuration *
          1000
        entranceTimers.push(
          setTimeout(() => {
            queueScramble(item.tn, item.off, 1, scrambleDuration)
          }, stagger)
        )
      }

      const cleanup = () => entranceTimers.forEach(clearTimeout)
      const cleanupRef = { fn: cleanup }

      let timer: ReturnType<typeof setTimeout> | null = null
      const tick = () => {
        const now = performance.now()
        const states = statesRef.current
        const originals = originalsRef.current

        for (const [tn, perNode] of Array.from(states)) {
          const chars = originals.get(tn)
          if (!chars) {
            states.delete(tn)
            continue
          }
          let mutated = false
          let arr: string[] | null = null
          for (const [offset, st] of Array.from(perNode)) {
            const e = (now - st.start) / Math.max(1, st.duration)
            if (e >= 1) {
              if (!arr) arr = (tn.nodeValue || "").split("")
              if (arr[offset] !== st.original) {
                arr[offset] = st.original
                mutated = true
              }
              perNode.delete(offset)
              continue
            }
            const pool = poolFor(st.original)
            if (!pool) {
              perNode.delete(offset)
              continue
            }
            const eased = ease(e)
            const wpos =
              ((Math.sin(now * 0.012 + offset * 0.7) + 1) / 2) *
              (pool.length - 1)
            const jitter =
              ((now * 0.025 + offset * 1.3) % 1) *
              pool.length *
              st.intensity
            const pick =
              Math.floor(wpos + jitter * (1 - eased)) % pool.length
            if (!arr) arr = (tn.nodeValue || "").split("")
            const next = pool[pick]
            if (arr[offset] !== next) {
              arr[offset] = next
              mutated = true
            }
          }
          if (mutated && arr) tn.nodeValue = arr.join("")
          if (perNode.size === 0) states.delete(tn)
        }

        timer = setTimeout(tick, scrambleInterval)
      }
      timer = setTimeout(tick, scrambleInterval)

      return () => {
        cleanupRef.fn()
        if (timer != null) clearTimeout(timer)
        const originals = originalsRef.current
        originals.forEach((chars, tn) => {
          tn.nodeValue = chars.join("")
        })
        statesRef.current.clear()
      }
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = () => {
      const now = performance.now()
      const states = statesRef.current
      const originals = originalsRef.current

      for (const [tn, perNode] of Array.from(states)) {
        const chars = originals.get(tn)
        if (!chars) {
          states.delete(tn)
          continue
        }
        let mutated = false
        let arr: string[] | null = null
        for (const [offset, st] of Array.from(perNode)) {
          const e = (now - st.start) / Math.max(1, st.duration)
          if (e >= 1) {
            if (!arr) arr = (tn.nodeValue || "").split("")
            if (arr[offset] !== st.original) {
              arr[offset] = st.original
              mutated = true
            }
            perNode.delete(offset)
            continue
          }
          const pool = poolFor(st.original)
          if (!pool) {
            perNode.delete(offset)
            continue
          }
          const eased = ease(e)
          const wpos =
            ((Math.sin(now * 0.012 + offset * 0.7) + 1) / 2) *
            (pool.length - 1)
          const jitter =
            ((now * 0.025 + offset * 1.3) % 1) *
            pool.length *
            st.intensity
          const pick =
            Math.floor(wpos + jitter * (1 - eased)) % pool.length
          if (!arr) arr = (tn.nodeValue || "").split("")
          const next = pool[pick]
          if (arr[offset] !== next) {
            arr[offset] = next
            mutated = true
          }
        }
        if (mutated && arr) tn.nodeValue = arr.join("")
        if (perNode.size === 0) states.delete(tn)
      }

      timer = setTimeout(tick, scrambleInterval)
    }
    timer = setTimeout(tick, scrambleInterval)

    return () => {
      if (timer != null) clearTimeout(timer)
      const originals = originalsRef.current
      originals.forEach((chars, tn) => {
        tn.nodeValue = chars.join("")
      })
      statesRef.current.clear()
    }
  }, [
    text,
    entrance,
    entranceDuration,
    entranceStagger,
    scrambleDuration,
    scrambleInterval,
  ])

  useEffect(() => {
    const id = requestAnimationFrame(() => snapshotTextNodes())
    return () => cancelAnimationFrame(id)
  }, [text, fontSize, fontFamily])

  const handlePointer = (clientX: number, clientY: number) => {
    const root = textRef.current
    if (!root) return
    const fs = Math.max(4, fontSize || 14)
    const cell = fs * 0.6

    for (let ly = -brushDy; ly <= brushDy; ly++) {
      for (let lx = -brushDx; lx <= brushDx; lx++) {
        const px = clientX + lx * cell
        const py = clientY + ly * cell * 1.6
        let tn: Text | null = null
        let off = -1

        // @ts-ignore -- caretPositionFromPoint is standard but not in all TS libs
        if (document.caretPositionFromPoint) {
          // @ts-ignore
          const pos = document.caretPositionFromPoint(px, py)
          if (pos && pos.offsetNode && pos.offsetNode.nodeType === 3) {
            tn = pos.offsetNode as Text
            off = pos.offset
          }
        } else if ((document as any).caretRangeFromPoint) {
          const range = (document as any).caretRangeFromPoint(px, py)
          if (
            range &&
            range.startContainer &&
            range.startContainer.nodeType === 3
          ) {
            tn = range.startContainer as Text
            off = range.startOffset
          }
        }
        if (!tn || off < 0) continue
        if (!root.contains(tn)) continue
        const chars = originalsRef.current.get(tn)
        if (!chars) continue
        if (off >= chars.length) continue

        const r = Math.sqrt(lx * lx + ly * ly)
        const intensity = Math.max(
          0.2,
          1 - r / Math.max(1, Math.max(brushDx, brushDy))
        )
        queueScramble(tn, off, intensity, scrambleDuration)
      }
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor,
        color,
        fontFamily,
        fontWeight,
        fontSize: `${fontSize}px`,
        lineHeight,
        letterSpacing: `${letterSpacing}em`,
        cursor: "default",
        userSelect: "none",
        WebkitUserSelect: "none",
        overflow: "hidden",
      }}
      onMouseMove={(e) => handlePointer(e.clientX, e.clientY)}
      onTouchMove={(e) => {
        const t = e.touches[0]
        if (t) handlePointer(t.clientX, t.clientY)
      }}
      onTouchStart={(e) => {
        const t = e.touches[0]
        if (t) handlePointer(t.clientX, t.clientY)
      }}
    >
      <div
        ref={textRef}
        style={{
          maxWidth: "60ch",
          margin: "0 auto",
          textAlign: justify ? "justify" : "left",
          textAlignLast: "left",
          wordSpacing: justify ? "0.05em" : `${wordGap}em`,
          hyphens: "auto",
          WebkitHyphens: "auto",
          whiteSpace: "normal",
          wordBreak: "normal",
          overflowWrap: "break-word",
        }}
      >
        {text}
      </div>
      {logo ? (
        <img
          src={logo}
          alt=""
          style={{
            display: "block",
            height: logoSize,
            width: "auto",
            marginTop: logoGap,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        />
      ) : null}
    </div>
  )
}
