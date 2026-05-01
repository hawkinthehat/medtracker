import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const AppProviders = dynamic(
  () => import("@/components/providers/AppProviders"),
  { ssr: false }
);

export const metadata: Metadata = {
  title: "MedTracker",
  description:
    "Mobile-first health dashboard — medications, vitals, journal, and specialist transfer notes.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MedTracker",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.variable} min-h-dvh font-sans antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
