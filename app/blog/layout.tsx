import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "OFFO Blog – Ownership Clarity",
  },
  description:
    "Decision clarity for EV buying and ownership: predictability, buffers, fallback plans, and what to verify next.",
  openGraph: {
    title: "OFFO Blog – Ownership Clarity",
    description:
      "Decision clarity for EV buying and ownership: predictability, buffers, fallback plans, and what to verify next.",
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
