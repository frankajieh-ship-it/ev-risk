import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Today's Best Used EV Deals — Pre-Analyzed by OFFO",
  description: "Browse OFFO-curated used EV listings with instant verdict, risk score, and negotiation scripts included. Filter by make, price, mileage, and location.",
  openGraph: {
    title: "Today's Best Used EV Deals — Pre-Analyzed by OFFO",
    description: "Browse OFFO-curated used EV listings with instant verdict, risk score, and negotiation scripts included.",
    url: "https://offolab.com/deals",
    siteName: "OFFO",
    type: "website",
  },
  alternates: {
    canonical: "https://offolab.com/deals",
  },
};

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
