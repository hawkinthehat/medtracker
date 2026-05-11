import { Suspense } from "react";
import AuthPageContent from "./AuthPageContent";

function AuthFallback() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-4">
      <p className="text-xl font-semibold text-black">Loading…</p>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <AuthPageContent />
    </Suspense>
  );
}
