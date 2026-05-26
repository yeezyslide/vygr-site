"use client"

import VygrIntro from "@/components/VygrIntro"

export default function Home() {
  return (
    <main
      style={{
        position: "relative",
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        background: "#000",
      }}
    >
      <VygrIntro
        firstClickShape="text"
        explodeSpread={0}
        revealDuration={2.5}
        pointerInfluence={0.8}
        cloudThreshold={0.35}
      />
    </main>
  )
}
