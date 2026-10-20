import type { NextConfig } from "next";

// ffmpeg reads frames from your videos so the partner can watch them. Only the places that look at posts carry it.
const ffmpeg = ["./node_modules/ffmpeg-static/ffmpeg"];

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/socials": ffmpeg,
    "/api/socials": ffmpeg,
    "/api/socials/look": ffmpeg,
  },
};

export default nextConfig;
