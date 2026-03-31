import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

const ogTitle = "Copart Auction Analyzer | OFFO";
const ogSubtitle = "Free risk score, ARV estimate, and max safe bid for any lot.";

export const metadata: Metadata = {
  title: "Copart Auction Analyzer",
  description:
    "Free Copart auction risk analysis. Paste any lot URL to get a salvage risk score, repair cost estimate, after-repair value, and max safe bid in seconds.",
  alternates: {
    canonical: `${SITE_URL}/copart`,
  },
  openGraph: {
    title: ogTitle,
    description:
      "Free Copart auction risk analysis. Paste any lot URL to get a salvage risk score, repair cost estimate, ARV, and max safe bid in seconds.",
    url: `${SITE_URL}/copart`,
    siteName: "OFFO",
    type: "website",
    images: [
      {
        url: `${APP_URL}/api/og?title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`,
        width: 1200,
        height: 630,
        alt: ogTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: ogTitle,
    description:
      "Free Copart auction risk analysis. Salvage risk score, ARV, repair cost, and max safe bid.",
    images: [
      `${APP_URL}/api/og?title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`,
    ],
  },
};

export default function CopartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
