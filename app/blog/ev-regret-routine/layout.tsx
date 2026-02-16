import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EV Regret Isn't About Range. It's About Routine.",
  description:
    "After analyzing dozens of real EV regret stories, one pattern kept repeating: the problem wasn't range — it was routine mismatch.",
  openGraph: {
    title: "EV Regret Isn't About Range. It's About Routine.",
    description:
      "After analyzing dozens of real EV regret stories, one pattern kept repeating: the problem wasn't range — it was routine mismatch.",
  },
};

export default function EVRegretRoutineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
