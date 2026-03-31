import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export const metadata: Metadata = {
  title: "Deal Checker",
  description:
    "Paste a used car listing URL or text. Get an instant deal verdict, risk flags, and must-ask questions in seconds.",
  alternates: {
    canonical: `${SITE_URL}/receipt`,
  },
  openGraph: {
    title: "Deal Checker | OFFO",
    description:
      "Paste a used car listing. Get a deal verdict, risk flags, and must-ask questions in seconds.",
    url: `${SITE_URL}/receipt`,
    siteName: "OFFO",
    type: "website",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "OFFO Deal Checker — Paste a listing, get a verdict",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Deal Checker | OFFO",
    description:
      "Paste a used car listing. Get a deal verdict, risk flags, and must-ask questions in seconds.",
    images: ["/og-default.png"],
  },
};

export default function ReceiptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "OFFO Deal Checker",
            applicationCategory: "UtilitiesApplication",
            operatingSystem: "Web",
            url: `${SITE_URL}/receipt`,
            description:
              "Paste a used car listing. Get an AI-powered deal verdict, risk flags, and must-ask questions in seconds.",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            provider: {
              "@type": "Organization",
              name: "OFFO Lab",
              url: SITE_URL,
            },
          }),
        }}
      />
      {children}
    </>
  );
}
