import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EV Risk Report",
  description:
    "Get a detailed risk assessment for any used EV listing. Battery health, maintenance costs, and ownership friction analysis.",
  openGraph: {
    title: "EV Risk Report | OFFO",
    description:
      "Detailed risk assessment for used EV listings.",
  },
};

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
