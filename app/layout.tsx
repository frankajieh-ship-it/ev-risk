import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import JsonLd from "@/components/seo/JsonLd";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "OFFO | Used Car Deal Checker",
    template: "%s | OFFO",
  },
  description:
    "Paste a used car listing. Get an AI-powered deal verdict, risk flags, and must-ask questions in seconds. Free.",
  openGraph: {
    title: "OFFO | Used Car Deal Checker",
    description:
      "Paste a used car listing. Get a deal verdict in seconds.",
    siteName: "OFFO",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "OFFO | Used Car Deal Checker",
    description: "Paste a used car listing. Get a deal verdict in seconds.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "OFFO Lab",
            url: "https://offolab.com",
          }}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "OFFO",
            url: "https://offolab.com",
          }}
        />
        {children}
      </body>
    </html>
  );
}
