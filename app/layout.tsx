import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "VYGR",
  description:
    "The definitive ontological breach in the history of human consciousness.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
