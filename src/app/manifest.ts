import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lodestar",
    short_name: "Lodestar",
    description: "Your daily guide: what to do today, why, and what's next.",
    start_url: "/",
    display: "standalone",
    background_color: "#e8edf0",
    theme_color: "#e8edf0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
