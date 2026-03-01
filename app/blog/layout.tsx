import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export const metadata: Metadata = {
  title: {
    absolute: "OFFO Blog – Ownership Clarity",
  },
  description:
    "Decision clarity for EV buying and ownership: predictability, buffers, fallback plans, and what to verify next.",
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  openGraph: {
    title: "OFFO Blog – Ownership Clarity",
    description:
      "Decision clarity for EV buying and ownership: predictability, buffers, fallback plans, and what to verify next.",
    url: `${SITE_URL}/blog`,
    type: "website",
    siteName: "OFFO",
  },
  twitter: {
    card: "summary",
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
