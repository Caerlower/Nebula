import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return {
      // The marketing landing (apps/landing) is built to public/landing and
      // served as the site root; the product app owns every other route.
      beforeFiles: [{ source: "/", destination: "/landing/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
  // @stellar/stellar-sdk optionally requires the native sodium binding;
  // the browser bundle must fall back to its pure-JS implementation.
  turbopack: {
    resolveAlias: {
      "sodium-native": "./src/lib/sodium-native-stub.ts",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "sodium-native": false,
    };
    return config;
  },
};

export default nextConfig;
