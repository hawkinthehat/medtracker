import BottomNav from "@/components/layout/BottomNav";
import ClinicalCorrelationScheduler from "@/components/ClinicalCorrelationScheduler";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f9fafb] text-slate-900">
      <ClinicalCorrelationScheduler />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-6 sm:px-5">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
