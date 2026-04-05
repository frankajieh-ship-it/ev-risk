import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import JsonLd from "@/components/seo/JsonLd";
import { HumanSignalCollector } from "@/components/HumanSignalCollector";
import CookieConsent from "@/components/CookieConsent";
import { VitalsReporter } from "@/components/VitalsReporter";
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
    default: "OFFO | Used Car Deal Checker",
    template: "%s | OFFO",
  },
  description:
    "Paste a used car listing. Get an AI-powered deal verdict, risk flags, and must-ask questions in seconds. Free.",
  openGraph: {
    title: "OFFO | Used Car Deal Checker",
    description:
      "Paste a used car listing. Get a deal verdict in seconds.",
    url: "https://offolab.com",
    siteName: "OFFO",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OFFO | Used Car Deal Checker",
    description: "Paste a used car listing. Get a deal verdict in seconds.",
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
        {/* GA loads unconditionally but consent defaults to denied.
            CookieConsent upgrades to granted on Accept. */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17983820539"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              analytics_storage: 'denied',
              ad_storage: 'denied',
              wait_for_update: 2000,
            });
            gtag('js', new Date());
            gtag('config', 'AW-17983820539');
            ${process.env.NEXT_PUBLIC_GA4_ID ? `gtag('config', '${process.env.NEXT_PUBLIC_GA4_ID}');` : ""}
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
