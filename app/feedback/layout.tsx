import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback",
  description:
    "Share your experience with OFFO's deal checker. Your feedback helps us improve.",
  openGraph: {
    title: "Feedback | OFFO",
    description:
      "Share your experience with OFFO's deal checker.",
  },
};

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
