import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import Script from "next/script";
import { Inter } from "next/font/google";
import { getSupabasePublicConfig } from "@/lib/env";
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
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { url, anonKey } = getSupabasePublicConfig();
  const inlineBootstrap = JSON.stringify({ url, anonKey }).replace(
    /</g,
    "\\u003c",
  );

  return (
    <html lang="en" className="light h-full">
      <body
        className={`${inter.variable} min-h-dvh bg-[#ffffff] font-sans text-[#0f172a] antialiased`}
      >
        <Script
          id="tiaki-supabase-public"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{window.__TIAKI_SUPABASE_PUBLIC__=Object.assign(window.__TIAKI_SUPABASE_PUBLIC__||{},JSON.parse(${JSON.stringify(inlineBootstrap)}));}catch(e){}`,
          }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
