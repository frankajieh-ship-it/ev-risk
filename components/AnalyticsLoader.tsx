"use client";

import Script from "next/script";
import { useConsent } from "@/hooks/useConsent";

const AW_ID = "AW-17983820539";
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

export default function AnalyticsLoader() {
  const { consent } = useConsent();
  if (consent !== "granted") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${AW_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${AW_ID}');
        ${GA4_ID ? `gtag('config', '${GA4_ID}');` : ""}
      `}</Script>
    </>
  );
}
