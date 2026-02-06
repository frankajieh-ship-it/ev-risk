import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
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
