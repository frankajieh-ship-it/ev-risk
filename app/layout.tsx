import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import JsonLd from "@/components/seo/JsonLd";
import { HumanSignalCollector } from "@/components/HumanSignalCollector";
import CookieConsent from "@/components/CookieConsent";
import { VitalsReporter } from "@/components/VitalsReporter";
import AnalyticsLoader from "@/components/AnalyticsLoader";
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
  metadataBase: new URL("https://offolab.com"),
  title: {
    default: "OFFO | Used EV Deal Checker & Charging Fit Score",
    template: "%s | OFFO",
  },
  description:
    "Paste a used EV listing. Get an instant risk verdict, hidden battery flags, and a charging fit score for your real life. Free.",
  openGraph: {
    title: "OFFO | Used EV Deal Checker & Charging Fit Score",
    description:
      "Paste a used EV listing. Get an instant risk verdict and charging fit score in seconds.",
    url: "https://offolab.com",
    siteName: "OFFO",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@offolab",
    title: "OFFO | Used EV Deal Checker & Charging Fit Score",
    description: "Paste a used EV listing. Get an instant risk verdict and charging fit score in seconds.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-48x48.png", type: "image/png", sizes: "48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
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
        <HumanSignalCollector />
        <CookieConsent />
        <VitalsReporter />
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
        />
        {/* GA only loads after the user explicitly accepts cookies */}
        <AnalyticsLoader />
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
          }
        `}</Script>
        {children}
      </body>
    </html>
  );
}
