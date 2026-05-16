import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EV vs Gas Total Cost of Ownership Calculator — Free Tool | OFFO",
  description:
    "See the real 5-year cost of owning an EV versus a gas vehicle. Includes fuel, maintenance, insurance, depreciation, and federal incentives. Free calculator, no sign-up required.",
  openGraph: {
    title: "EV vs Gas TCO Calculator | OFFO",
    description:
      "Is an electric vehicle actually cheaper to own? Calculate 5-year total cost of ownership vs. a gas car — with real fuel, maintenance, and incentive data.",
    url: "https://offolab.com/tools/tco",
    siteName: "OFFO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@offolab",
    title: "EV vs Gas TCO Calculator | OFFO",
    description:
      "5-year cost comparison: EV vs. gas. Fuel, maintenance, insurance, depreciation, and federal incentives — free tool from OFFO.",
  },
  alternates: {
    canonical: "https://offolab.com/tools/tco",
  },
};

export default function TcoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
