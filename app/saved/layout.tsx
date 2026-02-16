import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved Receipts",
  description:
    "View and manage your saved deal checker receipts.",
  openGraph: {
    title: "Saved Receipts | OFFO",
    description:
      "View and manage your saved deal checker receipts.",
  },
};

export default function SavedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
