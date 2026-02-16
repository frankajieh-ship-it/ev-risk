import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare Deals",
  description:
    "Compare two used car listings side by side. See which deal has fewer risks and better value.",
  openGraph: {
    title: "Compare Deals | OFFO",
    description:
      "Compare two used car listings side by side.",
  },
};

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
