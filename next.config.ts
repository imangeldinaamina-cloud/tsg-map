import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // This project lives next to other projects with their own lockfiles; pin the root.
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  // Local dev storage and raw downloads must never ship with a deployment.
  outputFileTracingExcludes: { "/**": [".data/**", "data-raw/**"] },
};

export default nextConfig;
