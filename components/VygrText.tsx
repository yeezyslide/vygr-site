"use client"

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
} from "react"

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖÉØ"
const DIGITS_SYM = "0123456789#$&@"
const POOL_UPPER = UPPER + DIGITS_SYM

function scrambleGlyph(original: string): string {
  if (/[A-ZÅÄÖÉØ]/.test(original))
    return POOL_UPPER[Math.floor(Math.random() * POOL_UPPER.length)]
  if (/[a-zåäöéø]/.test(original))
    return POOL_UPPER[Math.floor(Math.random() * POOL_UPPER.length)]
  return original
}

type Token =
  | { kind: "word"; text: string; wordIdx: number }
  | { kind: "space"; text: string }

interface VygrTextProps {
  text?: string
  color?: string
  backgroundColor?: string
  fontFamily?: string
  fontWeight?: number
  fontSize?: number
  lineHeight?: number
  letterSpacing?: number
  entranceDuration?: number
  lineAnimDuration?: number
  slideDistance?: number
  initialBlur?: number
  scrambleFps?: number
  hoverScrambleWindow?: number
  hoverCharStagger?: number
  hoverUpdateInterval?: number
  justify?: boolean
  logo?: string
  logoSize?: number
  logoGap?: number
}

export default function VygrText({
  text = "",
  color = "#FFFFFF",
  backgroundColor = "transparent",
  fontFamily = "Akkurat Mono, monospace",
  fontWeight = 400,
  fontSize = 14,
  lineHeight = 1.35,
  letterSpacing = 0,
  entranceDuration = 6,
  lineAnimDuration = 1.5,
  slideDistance = 10,
  initialBlur = 4,
  scrambleFps = 20,
  hoverScrambleWindow = 550,
  hoverCharStagger = 67,
  hoverUpdateInterval = 32,
  justify = true,
  logo = "",
  logoSize = 32,
  logoGap = 24,
}: VygrTextProps) {
  const tokens = useMemo<Token[]>(() => {
    const out: Token[] = []
    const src = text || ""
    let buf = ""
    let wordIdx = 0
    const flush = () => {
      if (buf) {
        out.push({ kind: "word", text: buf, wordIdx: wordIdx++ })
        buf = ""
      }
    }
    for (let i = 0; i < src.length; i++) {
      const c = src[i]
      if (/\s/.test(c)) {
        flush()
        out.push({ kind: "space", text: c })
      } else {
        buf += c
      }
    }
    flush()
    return out
  }, [text])

  const wordCount = useMemo(
    () => tokens.filter((t) => t.kind === "word").length,
    [tokens]
  )
  const wordLengths = useMemo(() => {
    const arr: number[] = new Array(wordCount).fill(0)
    for (const tok of tokens)
      if (tok.kind === "word") arr[tok.wordIdx] = tok.text.length
    return arr
  }, [tokens, wordCount])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [wordLine, setWordLine] = useState<number[]>([])
  const [lineCount, setLineCount] = useState(0)
  const [entered, setEntered] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useLayoutEffect(() => {
    if (wordCount === 0) return
    const nodes = wordRefs.current
    if (!nodes || nodes.length === 0) return
    const tops = new Map<number, number>()
    const lines: number[] = []
    for (let i = 0; i < wordCount; i++) {
      const el = nodes[i]
      if (!el) {
        lines.push(0)
        continue
      }
      const top = Math.round(el.getBoundingClientRect().top)
      if (!tops.has(top)) tops.set(top, tops.size)
      lines.push(tops.get(top)!)
    }
    setWordLine(lines)
    setLineCount(tops.size || 1)
  }, [wordCount, fontSize, text])

  const { wordCharStart, lineLens } = useMemo(() => {
    const wcs: number[] = new Array(wordCount).fill(0)
    const ll: Record<number, number> = {}
    if (wordLine.length === 0) return { wordCharStart: wcs, lineLens: ll }
    for (const tok of tokens) {
      if (tok.kind === "word") {
        const line = wordLine[tok.wordIdx] ?? 0
        wcs[tok.wordIdx] = ll[line] || 0
        ll[line] = (ll[line] || 0) + tok.text.length
      }
    }
    return { wordCharStart: wcs, lineLens: ll }
  }, [tokens, wordLine, wordCount])

  const perLineDelay =
    lineCount > 1
      ? Math.max(0, (entranceDuration - lineAnimDuration) / (lineCount - 1))
      : 0

  useEffect(() => {
    if (lineCount === 0) return
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true))
    })
    return () => cancelAnimationFrame(raf)
  }, [lineCount])

  useEffect(() => {
    if (lineCount === 0) return
    const start = performance.now()
    const interval = 1000 / Math.max(1, scrambleFps)
    const maxTime = entranceDuration + lineAnimDuration + 0.5
    const id = setInterval(() => {
      const e = (performance.now() - start) / 1000
      setElapsed(e)
      if (e >= maxTime) clearInterval(id)
    }, interval)
    return () => clearInterval(id)
  }, [lineCount, scrambleFps, entranceDuration, lineAnimDuration])

  const scramblesRef = useRef<Map<number, number>>(new Map())
  const [hasActiveScrambles, setHasActiveScrambles] = useState(false)
  const [, setHoverTick] = useState(0)

  useEffect(() => {
    if (!hasActiveScrambles) return
    const id = setInterval(() => {
      const now = performance.now()
      const ref = scramblesRef.current
      const doneKeys: number[] = []
      for (const [wIdx, start] of Array.from(ref)) {
        const N = wordLengths[wIdx] || 0
        const total = hoverScrambleWindow + (N - 1) * hoverCharStagger
        if (now - start > total + 50) doneKeys.push(wIdx)
      }
      for (const k of doneKeys) ref.delete(k)
      if (ref.size === 0) setHasActiveScrambles(false)
      else setHoverTick((t) => t + 1)
    }, hoverUpdateInterval)
    return () => clearInterval(id)
  }, [
    hasActiveScrambles,
    wordLengths,
    hoverScrambleWindow,
    hoverCharStagger,
    hoverUpdateInterval,
  ])

  const startHoverScramble = (wIdx: number) => {
    scramblesRef.current.set(wIdx, performance.now())
    setHasActiveScrambles(true)
  }

  const getHoverDisplay = (
    wIdx: number,
    charPos: number,
    wordLen: number,
    originalChar: string
  ): string | null => {
    const start = scramblesRef.current.get(wIdx)
    if (start === undefined) return null
    const hE = performance.now() - start
    const scStart = charPos * hoverCharStagger
    const scEnd = scStart + hoverScrambleWindow
    if (hE < scStart) return originalChar
    if (hE < scEnd) return scrambleGlyph(originalChar)
    return originalChar
  }

  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    backgroundColor,
    color,
    fontFamily,
    fontWeight,
    fontSize: `${fontSize}px`,
    lineHeight,
    letterSpacing: `${letterSpacing}em`,
    textAlign: justify ? "justify" : "left",
    textAlignLast: justify ? "justify" : "left",
    wordSpacing: "normal",
    hyphens: "auto",
    WebkitHyphens: "auto",
    whiteSpace: "normal",
    wordBreak: "normal",
    overflowWrap: "break-word",
    overflow: "hidden",
    cursor: "default",
    userSelect: "none",
    WebkitUserSelect: "none",
  }

  const hasMeasured = lineCount > 0

  const renderWords = () =>
    tokens.map((tok, tokIdx) => {
      if (tok.kind === "space") {
        return (
          <React.Fragment key={`s-${tokIdx}`}>
            {tok.text}
          </React.Fragment>
        )
      }
      const lineIdx = wordLine[tok.wordIdx] ?? 0
      const delay = lineIdx * perLineDelay
      const show = entered
      const lineLen = lineLens[lineIdx] || 1
      const startPos = wordCharStart[tok.wordIdx] || 0
      const wordLen = tok.text.length

      const wordStyle: React.CSSProperties = {
        display: "inline-block",
        transform: show
          ? "translateY(0px)"
          : `translateY(-${slideDistance}px)`,
        filter: show ? "blur(0px)" : `blur(${initialBlur}px)`,
        opacity: show ? 1 : 0,
        transition: hasMeasured
          ? `transform ${lineAnimDuration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, filter ${lineAnimDuration}s ease-out ${delay}s, opacity ${lineAnimDuration}s ease-out ${delay}s`
          : "none",
        willChange: "transform, filter, opacity",
      }

      return (
        <span
          key={`w-${tok.wordIdx}`}
          ref={(el) => {
            wordRefs.current[tok.wordIdx] = el
          }}
          style={wordStyle}
          onMouseEnter={() => startHoverScramble(tok.wordIdx)}
        >
          {tok.text.split("").map((ch, i) => {
            const posInLine = startPos + i
            const lockTime =
              delay +
              (posInLine / Math.max(1, lineLen)) * lineAnimDuration
            const entranceLocked = elapsed >= lockTime
            const hoverDisp = getHoverDisplay(
              tok.wordIdx,
              i,
              wordLen,
              ch
            )
            const display =
              hoverDisp !== null
                ? hoverDisp
                : entranceLocked
                  ? ch
                  : hasMeasured
                    ? scrambleGlyph(ch)
                    : ch
            return <span key={i}>{display}</span>
          })}
        </span>
      )
    })

  const logoShow = elapsed >= entranceDuration - lineAnimDuration * 0.5

  const logoStyle: React.CSSProperties = {
    display: "block",
    height: logoSize,
    width: "auto",
    marginTop: logoGap,
    marginLeft: "auto",
    marginRight: "auto",
    transform: logoShow ? "translateY(0px)" : `translateY(-${slideDistance}px)`,
    filter: logoShow ? "blur(0px)" : `blur(${initialBlur}px)`,
    opacity: logoShow ? 1 : 0,
    transition: `transform ${lineAnimDuration}s cubic-bezier(0.22, 1, 0.36, 1), filter ${lineAnimDuration}s ease-out, opacity ${lineAnimDuration}s ease-out`,
    willChange: "transform, filter, opacity",
  }

  return (
    <div ref={containerRef} style={containerStyle}>
      <div>
        {renderWords()}
      </div>
      {logo ? <img src={logo} alt="" style={logoStyle} /> : null}
    </div>
  )
}
