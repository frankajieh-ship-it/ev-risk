import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "auto.dev" },
      { protocol: "https", hostname: "*.cargurus.com" },
      { protocol: "https", hostname: "*.cars.com" },
      { protocol: "https", hostname: "*.carmax.com" },
      { protocol: "https", hostname: "images.autotrader.com" },
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
