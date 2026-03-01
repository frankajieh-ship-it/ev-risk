import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OFFO Chrome Extension",
  description:
    "One-click deal check on CarGurus EV listings. Get risk flags, fair price, and must-ask questions without leaving the page.",
};

export default function ExtensionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
