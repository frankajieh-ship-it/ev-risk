import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact / Feedback",
  description:
    "Questions, bugs, feedback, or success stories — we read everything.",
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
