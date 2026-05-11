"use client";

/**
 * Temporary escape hatch when the UI feels stuck — clears browser storage and reloads.
 * Container uses pointer-events-none so only the button captures clicks (no full-width blocker).
 */
export default function ResetUiBanner() {
  function resetAll() {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.reload();
  }

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[110] flex justify-center px-1 pt-[max(2px,env(safe-area-inset-top))]"
      role="region"
      aria-label="Temporary debug toolbar"
    >
      <button
        type="button"
        onClick={resetAll}
        className="pointer-events-auto rounded-b-md border border-red-800 bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase leading-none tracking-wide text-red-950 shadow-sm hover:bg-red-200"
      >
        Reset UI (clear storage · reload)
      </button>
    </div>
  );
}
