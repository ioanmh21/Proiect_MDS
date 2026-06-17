import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false,
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
