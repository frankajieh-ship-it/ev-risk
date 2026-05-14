import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "https://www.offolab.com";

const ogTitle = "EV Fit Check — Does This EV Match Your Routine?";
const ogSubtitle = "3 questions. Instant score. Know if an EV fits your commute, charging, and climate — free.";

export const metadata: Metadata = {
  title: "EV Fit Check — Does This EV Match Your Routine? | OFFO",
  description:
    "Answer 3 questions about your commute, charging access, and climate. Get an instant EV routine fit score showing whether any electric vehicle actually fits your real life — free, no sign-up.",
  alternates: {
    canonical: `${SITE_URL}/routine`,
  },
  openGraph: {
    title: ogTitle,
    description: ogSubtitle,
    url: `${SITE_URL}/routine`,
    type: "website",
    siteName: "OFFO",
    images: [
      {
        url: `${APP_URL}/api/og?title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`,
        width: 1200,
        height: 630,
        alt: ogTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: ogTitle,
    description: ogSubtitle,
    images: [
      `${APP_URL}/api/og?title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`,
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RoutineLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "OFFO EV Fit Check",
              description:
                "A free EV routine fit checker that tells you whether an electric vehicle matches your commute, charging access, and climate in under 2 minutes.",
              url: `${SITE_URL}/routine`,
              applicationCategory: "FinanceApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              author: {
                "@type": "Organization",
                name: "OFFO Lab",
                url: SITE_URL,
              },
            },
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "What is an EV fit check?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "An EV fit check evaluates whether an electric vehicle matches your specific daily routine — your commute distance, charging access at home or work, and local climate. Unlike a standard VIN report, it scores lifestyle fit rather than vehicle history.",
                  },
                },
                {
                  "@type": "Question",
                  name: "What is an EV routine score?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "An EV routine score is a 0–100 rating of how well an electric vehicle fits your daily driving patterns. It factors in commute miles, charging access (home L2, workplace, or public-only), climate, and long-distance trip frequency. A score above 80 means the EV is a strong fit; below 45 indicates high friction.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Does an EV fit check replace a VIN report?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "No — an EV fit check and a VIN report answer different questions. A VIN report (like Carfax or OFFO's receipt check) reveals vehicle history, recalls, and battery health. An EV fit check tells you whether the vehicle type matches your lifestyle. Ideally, run both before buying a used EV.",
                  },
                },
              ],
            },
          ]),
        }}
      />
      {children}
    </>
  );
}
