import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const backendBaseUrl = (
  process.env.API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://sipscouts.onrender.com"
    : "http://localhost:5001")
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBaseUrl}/api/:path*`,
      },
    ];
  },
};

export default withPWA(nextConfig);
