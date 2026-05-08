import type { Metadata } from "next";
import BottomNav from "@/components/layout/BottomNav";
import ClinicalCorrelationScheduler from "@/components/ClinicalCorrelationScheduler";

export const metadata: Metadata = {
  title: "Medical ID | MedTracker",
  description:
    "Digital emergency medical identification — contacts, diagnoses, and medications.",
};

export default function EmergencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-gray-50 text-slate-900">
      <ClinicalCorrelationScheduler />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-6 sm:px-5">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
