import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // production build sırasında lint hatalarını yok say
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ["nodemailer"],
};

export default nextConfig;
