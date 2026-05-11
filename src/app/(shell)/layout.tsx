import BottomNav from "@/components/layout/BottomNav";
import ResetUiBanner from "@/components/layout/ResetUiBanner";
import ClinicalCorrelationScheduler from "@/components/ClinicalCorrelationScheduler";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-slate-900">
      <ResetUiBanner />
      {/* Silent Scientist: nightly clinical correlation + metabolic pathway context */}
      <ClinicalCorrelationScheduler />
      <main className="mx-auto w-full max-w-5xl flex-1 bg-[#ffffff] px-4 pb-36 pt-10 sm:px-5 sm:pb-40">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
