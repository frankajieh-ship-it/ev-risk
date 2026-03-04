import type { Metadata } from "next";
import AdComparePageClient from "@/components/ad/AdComparePageClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export const metadata: Metadata = {
  title: "2025 Kia EV6 vs 2023 Tesla Model 3 — Side-by-Side Risk Comparison | OFFO",
  description:
    "Compare a 2025 Kia EV6 Light LR AWD ($31,497, 3K mi) against a 2023 Tesla Model 3 Performance ($31,631, 28K mi). See verdicts, risk flags, and must-ask questions side by side.",
  alternates: {
    canonical: `${SITE_URL}/ad/compare-ev6-model3`,
  },
  openGraph: {
    title: "EV6 vs Model 3 — Which Listing Has More Risk?",
    description:
      "One got a GREEN verdict. The other timed out. See the full side-by-side comparison with risk flags and must-ask questions.",
    url: `${SITE_URL}/ad/compare-ev6-model3`,
    type: "article",
    siteName: "OFFO",
  },
  twitter: {
    card: "summary_large_image",
    title: "EV6 vs Model 3 — Which Listing Has More Risk?",
    description:
      "One got a GREEN verdict. The other timed out. See the full comparison.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdCompareEv6Model3Page() {
  return <AdComparePageClient />;
}
