import type { Metadata } from "next";

// Gameplay is interactive, session-specific content; searchable editorial content
// belongs on Discover and the published pack detail pages instead.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function PlayLayout({children}:{children:React.ReactNode}) {
  return children;
}
