import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account · MedTracker",
  description: "Sign up or log in to sync your health data.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-white text-black antialiased">{children}</div>
  );
}
