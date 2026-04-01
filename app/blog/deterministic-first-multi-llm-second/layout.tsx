import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Why We Use Deterministic Rules First + Multi-LLM Second | OFFO Engineering",
  description:
    "How OFFO built a two-layer EV deal intelligence pipeline: a deterministic rule engine that responds in under 500ms, upgraded asynchronously by a three-model AI chain.",
  openGraph: {
    title: "Deterministic First, Multi-LLM Second",
    description:
      "How OFFO built a two-layer EV deal intelligence pipeline that returns results in under 500ms then upgrades with AI.",
    type: "article",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
