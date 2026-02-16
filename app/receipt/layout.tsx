import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deal Checker",
  description:
    "Paste a used car listing URL or text. Get an AI-powered deal verdict, risk flags, and must-ask questions in seconds.",
  openGraph: {
    title: "Deal Checker | OFFO",
    description:
      "Paste a used car listing. Get a deal verdict, risk flags, and must-ask questions in seconds.",
  },
};

export default function ReceiptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
