import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  images: {
    remotePatterns: [
      // Wikimedia Commons — static fallback photos
      { protocol: "https", hostname: "upload.wikimedia.org" },
      // VinAudit stock images
      { protocol: "https", hostname: "api.vinaudit.com" },
      { protocol: "https", hostname: "*.vinaudit.com" },
      // Auto.dev
      { protocol: "https", hostname: "auto.dev" },
      { protocol: "https", hostname: "*.auto.dev" },
      // CarGurus
      { protocol: "https", hostname: "*.cargurus.com" },
      // Cars.com
      { protocol: "https", hostname: "*.cars.com" },
      // CarMax
      { protocol: "https", hostname: "*.carmax.com" },
      // AutoTrader
      { protocol: "https", hostname: "images.autotrader.com" },
      { protocol: "https", hostname: "*.autotrader.com" },
      // CarFax / Dealer.com CDN
      { protocol: "https", hostname: "*.carfax.com" },
      { protocol: "https", hostname: "*.dealer.com" },
      // Common dealer listing photo CDNs
      { protocol: "https", hostname: "*.dealerfire.com" },
      { protocol: "https", hostname: "*.dealerimagepro.com" },
      { protocol: "https", hostname: "pictures.dealer.com" },
      { protocol: "https", hostname: "images.dealer.com" },
      { protocol: "https", hostname: "*.dealerinspire.com" },
      { protocol: "https", hostname: "*.coxautoinc.com" },
      { protocol: "https", hostname: "*.manheim.com" },
      { protocol: "https", hostname: "*.iaai.com" },
      { protocol: "https", hostname: "*.copart.com" },
      // Facebook Marketplace
      { protocol: "https", hostname: "*.fbcdn.net" },
      // Google / Gstatic
      { protocol: "https", hostname: "*.gstatic.com" },
      // Generic CDNs used by dealer sites
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "*.imgix.net" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/underpriced-ev-listing-checklist",
        destination: "/checklists/underpriced-ev-listing",
        permanent: true,
      },
    ];
  },
  outputFileTracingExcludes: {
    "/**": [
      "./Team/**",
      "./Images/**",
      "./docs/**",
      "./tools/**",
      "./tests/**",
      "./scripts/**",
      "./debug/**",
      "./database/**",
      "./*.md",
      "./*.txt",
      "./*.patch",
      "./*.css",
      "./stripe.exe",
      "./stripe.zip",
      "./stripe-cli.zip",
      "./tsconfig.tsbuildinfo",
      "./jest.config.js",
      "./jest.setup.js",
      "./eslint.config.mjs",
      "./postcss.config.mjs",
      "./test-*.js",
      "./test-*.mjs",
      "./package-lock.json",
    ],
  },
};

export default nextConfig;
