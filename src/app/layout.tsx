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
  appleWebApp: {
    capable: true,
    title: "MedTracker",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light h-full">
      <body
        className={`${inter.variable} min-h-dvh bg-background font-sans text-foreground antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
