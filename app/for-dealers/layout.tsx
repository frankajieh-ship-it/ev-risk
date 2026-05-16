import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OFFO for EV Dealers — Buyer Intelligence & Verified Inventory",
  description:
    "Connect with high-intent used EV buyers before they walk in. Get real market pricing intel, manage verified inventory, and grow your EV dealership with OFFO.",
  openGraph: {
    title: "OFFO for EV Dealers — Buyer Intelligence & Verified Inventory",
    description:
      "Know your buyer before they walk in. OFFO gives EV dealers anonymized buyer demand data, real pricing intel, and a verified inventory listing — free to apply.",
    url: "https://offolab.com/for-dealers",
    siteName: "OFFO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@offolab",
    title: "OFFO for EV Dealers",
    description:
      "High-intent buyer matching, real market pricing, and verified inventory for EV dealerships. Apply for dealer access.",
  },
  alternates: {
    canonical: "https://offolab.com/for-dealers",
  },
};

export default function ForDealersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
