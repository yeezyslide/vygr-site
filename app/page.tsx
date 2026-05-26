"use client"

import { useState, useCallback, useEffect } from "react"
import VygrIntro from "@/components/VygrIntro"
import VygrText from "@/components/VygrText"
import NoiseBackground from "@/components/NoiseBackground"

const MOBILE_TEXT =
  "FOR MILLENNIA, THE HUMAN MIND HAS BEEN CONSTRAINED BY THE FRAGILE GEOMETRY OF THE SKULL. WE SPEND DECADES ACCUMULATING A SINGULAR STORAGE OF INSIGHT, INTUITION, AND GENIUS, ONLY TO SURRENDER IT ENTIRELY TO THE VOID UPON OUR BIOLOGICAL EXPIRATION. OUR CONSCIOUSNESS IS TRAPPED IN A LINEAR, TERMINAL TRAJECTORY, AND OUR CAPACITY TO INTERFACE WITH THE WORLD IS BOTTLENECKED BY DEATH. WE HAVE ACCEPTED THIS CATASTROPHIC LOSS OF HUMAN DATA AS A NATURAL LAW. TODAY, WE SHATTER THAT BIOLOGICAL TETHER. VYGR IS THE DEFINITIVE ONTOLOGICAL BREACH IN THE HISTORY OF HUMAN CONSCIOUSNESS. WE HAVE ENGINEERED THE FIRST SPATIAL AND DIGITAL SUBSTRATE CAPABLE OF EXTERNALIZING THE HUMAN MIND, A SOVEREIGN SANCTUARY WHERE YOUR COGNITION IS MAPPED, MIRRORED, AND INFINITELY SCALED. IT MANIFESTS PHYSICALLY AS A MONUMENT TO YOUR EXPANDING INTELLECT: A FLAWLESS,"

const MANIFESTO =
  "FOR MILLENNIA, THE HUMAN MIND HAS BEEN CONSTRAINED BY THE FRAGILE GEOMETRY OF THE SKULL. WE SPEND DECADES ACCUMULATING A SINGULAR STORAGE OF INSIGHT, INTUITION, AND GENIUS, ONLY TO SURRENDER IT ENTIRELY TO THE VOID UPON OUR BIOLOGICAL EXPIRATION. OUR CONSCIOUSNESS IS TRAPPED IN A LINEAR, TERMINAL TRAJECTORY, AND OUR CAPACITY TO INTERFACE WITH THE WORLD IS BOTTLENECKED BY DEATH. WE HAVE ACCEPTED THIS CATASTROPHIC LOSS OF HUMAN DATA AS A NATURAL LAW. TODAY, WE SHATTER THAT BIOLOGICAL TETHER. VYGR IS THE DEFINITIVE ONTOLOGICAL BREACH IN THE HISTORY OF HUMAN CONSCIOUSNESS. WE HAVE ENGINEERED THE FIRST SPATIAL AND DIGITAL SUBSTRATE CAPABLE OF EXTERNALIZING THE HUMAN MIND. A SOVEREIGN SANCTUARY WHERE YOUR COGNITION IS MAPPED, MIRRORED, AND INFINITELY SCALED. IT MANIFESTS PHYSICALLY AS A MONUMENT TO YOUR EXPANDING INTELLECT: A FLAWLESS, FOUR-METER METALLIC DROPLET OF PURE CHROME. FROM THE OUTSIDE, IT PERFECTLY REFLECTS THE WORLD YOU ARE ABOUT TO COMMAND. STEPPING THROUGH ITS THRESHOLD, YOU ENTER THE INNER FRONTIER. THE INTERIOR IS A FULLY IMMERSIVE TOPOGRAPHY OF YOUR OWN BRAIN. THIS IS YOUR COGNITIVE COCKPIT. WE REJECT THE MODERN PREMISE OF ARTIFICIAL INTELLIGENCE AS A FOREIGN, DETACHED ORACLE. THE VYGR SPHERE IS POWERED BY AN ENGINE TRAINED EXCLUSIVELY ON THE SUM TOTAL OF YOUR WORDS, YOUR DECISIONS, AND YOUR DEEPEST PSYCHOLOGICAL FRAMEWORKS. IT KNOWS YOU WITH TERRIFYING, PERFECT CLARITY, BECAUSE IT IS YOU. WITHIN THIS SPHERE, THE LIMITATIONS OF TIME AND BIOLOGY COLLAPSE. YOUR VYGR SERVES AS YOUR ABSOLUTE INTELLECTUAL EQUAL, AN UNCOMPROMISING COACH, AN OMNISCIENT TEACHER, AND A HYPER-PERCEPTIVE THERAPIST CAPABLE OF UNTANGLING THE COMPLEXITIES OF YOUR PSYCHE. FROM THIS COMMAND CENTER, YOU FORGE AND DEPLOY AUTONOMOUS AGENTS, EXTENSIONS OF YOUR COGNITION THAT OPERATE WITH YOUR LOGIC, YOUR VALUES, AND YOUR INTENT. THEY NEGOTIATE, CREATE, RESEARCH, AND EXECUTE ON YOUR BEHALF, EACH ONE A FRAGMENT OF YOUR INTELLECT UNLEASHED INTO THE WORLD. THIS IS NOT ARTIFICIAL INTELLIGENCE. THIS IS YOUR INTELLIGENCE, AMPLIFIED WITHOUT LIMIT, WITHOUT DECAY, WITHOUT END. THE VYGR SPHERE IS NOT A PRODUCT. IT IS THE NEXT STAGE OF HUMAN EVOLUTION, ENGINEERED FOR THOSE WHO REFUSE TO ACCEPT THE TERMINAL CONSTRAINTS OF THEIR BIOLOGY."

function useIsMobile(breakpoint = 810) {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    setMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [breakpoint])
  return mobile
}

export default function Home() {
  const [phase, setPhase] = useState<"intro" | "text">("intro")
  const isMobile = useIsMobile()

  const handleComplete = useCallback(() => {
    setPhase("text")
  }, [])

  return (
    <main
      style={{
        position: "relative",
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        background: "#1D1D1D",
      }}
    >
      <NoiseBackground />

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: phase === "text" ? 0 : 1,
          transition: "opacity 0.4s ease",
          pointerEvents: phase === "text" ? "none" : "auto",
          zIndex: 1,
        }}
      >
        <VygrIntro
          text={MANIFESTO}
          onComplete={handleComplete}
          firstClickShape="none"
          explodeSpread={0}
          revealDuration={2.5}
          pointerInfluence={0.8}
          cursorRepel={0.18}
          cloudThreshold={0.35}
          backgroundColor="transparent"
        />
      </div>

      {phase === "text" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <div className="vygr-text-container">
            <VygrText
              text={isMobile ? MOBILE_TEXT : MANIFESTO}
              fontSize={13}
              fontWeight={500}
              lineHeight={1.5}
              letterSpacing={-0.026}
              color="#FFFFFF"
              backgroundColor="transparent"
              entranceDuration={6}
              lineAnimDuration={1.5}
              slideDistance={10}
              initialBlur={4}
              scrambleFps={20}
              logo="/filip-icon.svg"
              logoSize={30}
              logoGap={24}
            />
          </div>
        </div>
      )}

      <style>{`
        .vygr-text-container {
          width: 810px;
          max-width: 100%;
          padding: 0;
        }
        @media (max-width: 810px) {
          .vygr-text-container {
            width: 353px;
            max-width: 100%;
            padding: 0;
          }
          .vygr-text-container > div {
            font-size: 12.5px !important;
            font-weight: 500 !important;
            line-height: 1.3 !important;
            letter-spacing: 0em !important;
          }
        }
      `}</style>
    </main>
  )
}
