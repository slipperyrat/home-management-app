import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  middleware: ["/", "/dashboard(.*)"],
};

export default nextConfig;
