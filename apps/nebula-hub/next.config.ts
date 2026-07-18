import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ["@privy-io/react-auth"],
  // Keep channel.wasm in the serverless trace so MPP deploy works on Vercel.
  // Keys match App Router paths that can open an MPP session.
  outputFileTracingIncludes: {
    "/mcp": ["./contracts/channel.wasm"],
    "/api/tools/[tool]": ["./contracts/channel.wasm"],
    "/api/tools": ["./contracts/channel.wasm"],
    "/*": ["./contracts/channel.wasm"],
  },
  // Avoid broken HMR/auth when the app is opened via 127.0.0.1 vs localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
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
