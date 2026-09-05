import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The end-to-end suite drives the dev server over 127.0.0.1, which Next
  // treats as a different origin and refuses to serve dev resources to,
  // leaving the client bundle unhydrated and every page empty.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
