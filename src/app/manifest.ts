import type { MetadataRoute } from "next";

/** Installable PWA — opens full-screen without browser chrome (`display: standalone`). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedTracker",
    short_name: "MedTracker",
    description:
      "Medications, vitals, symptom journal, and specialist notes — Tiaki dashboard.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f9fafb",
    theme_color: "#f9fafb",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      {
        src: "/icons/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
