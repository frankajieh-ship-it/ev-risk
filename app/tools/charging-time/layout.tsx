import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EV Charging Time Calculator — Free Tool | OFFO",
  description:
    "Calculate real-world charging times for any electric vehicle. See Level 1, Level 2, and DC fast charge estimates based on actual battery specs and charger curves. Free, no sign-up.",
  openGraph: {
    title: "EV Charging Time Calculator | OFFO",
    description:
      "How long will it actually take to charge your EV? Get accurate estimates for Level 1, Level 2, and DC fast charging — based on real battery and charger data.",
    url: "https://offolab.com/tools/charging-time",
    siteName: "OFFO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@offolab",
    title: "EV Charging Time Calculator | OFFO",
    description:
      "Accurate charging time estimates for 14+ popular EVs. Level 1, Level 2, and DC fast charging — free tool, no account needed.",
  },
  alternates: {
    canonical: "https://offolab.com/tools/charging-time",
  },
};

export default function ChargingTimeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
