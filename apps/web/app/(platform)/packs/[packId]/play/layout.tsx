import type { Metadata } from "next";

// A run can expose different clues and results to each player. Do not index
// these ephemeral game screens as if they were standalone content pages.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function PackPlayLayout({children}:{children:React.ReactNode}) {
  return children;
}
