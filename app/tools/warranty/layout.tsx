import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Battery Warranty Checker — Free EV Tool | OFFO",
  description:
    "Find out exactly how much battery warranty is left on any used EV before you buy. Free tool — no sign-up. Covers Tesla, Hyundai, Kia, Chevy Bolt, Ford, Rivian, and more.",
  openGraph: {
    title: "Free EV Battery Warranty Checker",
    description: "How much warranty is left? Check any used EV's battery coverage in seconds — free.",
    url: "https://offolab.com/tools/warranty",
  },
  twitter: {
    card: "summary_large_image",
    site: "@offolab",
    title: "Free EV Battery Warranty Checker",
    description: "Check how much battery warranty is left on any used EV — free, no sign-up.",
  },
};

export default function WarrantyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
