"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { FeatureHelpTrigger } from "@/components/FeatureHelpModal";
import { qk } from "@/lib/query-keys";
import {
  isPressureAdvisorySuppressed,
  suppressPressureAdvisory4h,
} from "@/lib/pressure-advisory-snooze";
import { checkPressureDrop } from "@/lib/weather";

const LS_ALERTS = "tiaki-weather-alerts-enabled";
const LS_LAST_EVENING = "tiaki-last-evening-notify-date";
const CACHE_NAME = "tiaki-sw-v1";
const COORDS_REQ = new Request("/tiaki-coords.json");

async function cacheCoordsForWorker(payload: {
  lat: number;
  lon: number;
  alertsEnabled: boolean;
  timeZone: string;
}) {
  if (typeof caches === "undefined") return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    COORDS_REQ,
    new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function registerPeriodicIfPossible() {
  try {
    const reg = await navigator.serviceWorker.ready;
    type RegWithPeriodic = ServiceWorkerRegistration & {
      periodicSync?: {
        register: (
          tag: string,
          opts?: { minInterval: number },
        ) => Promise<void>;
      };
    };
    const ps = (reg as RegWithPeriodic).periodicSync;
    if (ps) {
      await ps.register("tiaki-weather", {
        minInterval: 60 * 60 * 1000,
      });
    }
  } catch {
    /* unsupported or denied */
  }
}

type WeatherSectionProps = {
  /** When true, do not render the pressure-drop advisory banner (debug / stuck UI). */
  skipBarometerAdvisory?: boolean;
  /** Tighter typography and spacing for the home dashboard carousel strip. */
  compact?: boolean;
};

export default function TiakiHomeWeatherSection({
  skipBarometerAdvisory = false,
  compact = false,
}: WeatherSectionProps = {}) {
  const { data: advisory, isLoading } = useQuery({
    queryKey: qk.weatherPressureAdvisory,
    queryFn: checkPressureDrop,
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 30,
  });

  const [alertsOn, setAlertsOn] = useState(false);
  const [advisoryTick, setAdvisoryTick] = useState(0);

  useEffect(() => {
    try {
      setAlertsOn(window.localStorage.getItem(LS_ALERTS) === "1");
    } catch {
      setAlertsOn(false);
    }
  }, []);

  /** Re-check snooze expiry without full page reload (~1 min). */
  useEffect(() => {
    const id = window.setInterval(() => setAdvisoryTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const pushCoordsToCaches = useCallback(async (enabled: boolean) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const tz =
            Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          await cacheCoordsForWorker({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            alertsEnabled: enabled,
            timeZone: tz,
          });
          resolve();
        },
        () => resolve(),
        { maximumAge: 120_000, timeout: 12_000, enableHighAccuracy: false },
      );
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (!alertsOn) return;
    void pushCoordsToCaches(true);
    void registerPeriodicIfPossible();
  }, [alertsOn, pushCoordsToCaches]);

  /** Local 8:00 PM notification — works when the device is awake; SW periodic sync is a fallback. */
  useEffect(() => {
    if (!alertsOn) return;
    const id = window.setInterval(async () => {
      const d = new Date();
      if (d.getHours() !== 20 || d.getMinutes() > 8) return;
      const dayKey = d.toISOString().slice(0, 10);
      try {
        if (window.localStorage.getItem(LS_LAST_EVENING) === dayKey) return;
      } catch {
        return;
      }
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;

      const coords = await new Promise<{ lat: number; lon: number } | null>(
        (resolve) => {
          if (!navigator.geolocation) {
            resolve(null);
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
              }),
            () => resolve(null),
            { maximumAge: 300_000, timeout: 15_000, enableHighAccuracy: false },
          );
        },
      );
      if (!coords) return;

      const res = await fetch(
        `/api/weather-advisory?lat=${coords.lat}&lon=${coords.lon}`,
      );
      const data = (await res.json()) as { weatherWarning?: boolean };
      if (!data?.weatherWarning) return;

      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("Tiaki", {
          body: "Tiaki Alert: Tomorrow may be a high-flare day. Drink extra water tonight.",
          icon: "/icons/app-icon-192.png",
          badge: "/icons/app-icon-192.png",
          tag: "tiaki-evening-weather",
        });
      } catch {
        new Notification("Tiaki", {
          body: "Tiaki Alert: Tomorrow may be a high-flare day. Drink extra water tonight.",
        });
      }

      try {
        window.localStorage.setItem(LS_LAST_EVENING, dayKey);
      } catch {
        /* ignore */
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: "CHECK_EVENING" });
      } catch {
        /* ignore */
      }
    }, 45_000);

    return () => window.clearInterval(id);
  }, [alertsOn]);

  async function handleToggle(next: boolean) {
    setAlertsOn(next);
    try {
      window.localStorage.setItem(LS_ALERTS, next ? "1" : "0");
    } catch {
      /* ignore */
    }

    if (next) {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      await pushCoordsToCaches(true);
      await registerPeriodicIfPossible();
    } else {
      await pushCoordsToCaches(false);
    }
  }

  const showBanner = advisory?.weatherWarning === true;
  void advisoryTick;
  const advisorySuppressed = isPressureAdvisorySuppressed();
  const showAdvisoryCard = showBanner && !advisorySuppressed;

  function dismissAdvisory() {
    suppressPressureAdvisory4h();
    setAdvisoryTick((n) => n + 1);
  }

  return (
    <div
      id="tiaki-barometer"
      className={compact ? "space-y-2" : "space-y-4"}
    >
      <div
        className={
          compact
            ? "flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-slate-900 bg-white px-2 py-1.5 shadow-sm sm:px-3 sm:py-2"
            : "flex flex-wrap items-center justify-between gap-2 rounded-2xl border-4 border-slate-900 bg-white px-3 py-3 shadow-sm sm:gap-3 sm:px-4 sm:py-4"
        }
      >
        <h2
          className={
            compact
              ? "text-sm font-black tracking-tight text-slate-900 sm:text-base"
              : "text-base font-black tracking-tight text-slate-900 sm:text-xl"
          }
        >
          Barometric pressure
        </h2>
        <FeatureHelpTrigger
          ariaLabel="Why barometric pressure matters"
          title="Barometric pressure"
        >
          <p>
            <strong>Why it matters for dysautonomia:</strong> Rapid drops in air
            pressure are linked to wider blood vessels and lighter head
            sensations — many people notice more dizziness, fatigue, or migraine
            overlap when pressure falls quickly.
          </p>
          <p>
            <strong>How Tiaki measures this:</strong> The advisory uses your
            device&apos;s GPS coordinates with OpenWeather forecast data for{" "}
            <em>your current location</em> — not a fixed city. Grant location for
            the most accurate heads-up.
          </p>
          <p>
            <strong>What to log:</strong> Keep doing your usual orthostatic and
            symptom checks; Tiaki attaches pressure context so you and your team
            can correlate flares with weather swings over time.
          </p>
        </FeatureHelpTrigger>
      </div>

      {/* TEMP: skipBarometerAdvisory bypasses this block from PlannerHomePage */}
      {!skipBarometerAdvisory && showAdvisoryCard && (
        <section
          role="alert"
          aria-live="polite"
          className={
            compact
              ? "relative z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-xl border-2 border-amber-700 bg-amber-300 shadow-md ring-2 ring-amber-500/80"
              : "relative z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border-4 border-amber-700 bg-amber-300 shadow-lg ring-4 ring-amber-500/80"
          }
        >
          <button
            type="button"
            onClick={dismissAdvisory}
            className={
              compact
                ? "absolute right-1.5 top-1.5 z-20 inline-flex h-9 w-9 items-center justify-center rounded-lg border-2 border-black bg-white text-slate-900 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 sm:right-2 sm:top-2 sm:h-10 sm:w-10"
                : "absolute right-2 top-2 z-20 inline-flex h-10 w-10 items-center justify-center rounded-xl border-[3px] border-black bg-white text-slate-900 shadow-md transition hover:bg-slate-100 focus-visible:outline focus-visible:ring-4 focus-visible:ring-sky-500 sm:right-3 sm:top-3 sm:h-12 sm:w-12 sm:border-4"
            }
            aria-label="Close advisory"
          >
            <span className="sr-only">Close</span>
            <X
              className={compact ? "h-4 w-4 sm:h-5 sm:w-5" : "h-5 w-5 sm:h-7 sm:w-7"}
              strokeWidth={2.5}
              aria-hidden
            />
          </button>
          <div
            className={
              compact
                ? "max-h-[75vh] min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-3 pt-2.5 sm:px-3 sm:pb-3 sm:pt-3"
                : "max-h-[75vh] min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4 sm:p-5"
            }
          >
            <p
              className={
                compact
                  ? "pr-12 text-center text-base font-black leading-snug text-slate-950"
                  : "pr-16 text-center text-xl font-black leading-snug text-slate-950 sm:text-2xl"
              }
            >
              Atmospheric pressure shift detected. Maintain hydration and salt
              protocols per your care plan.
            </p>
            {!isLoading && advisory != null && (
              <p
                className={
                  compact
                    ? "mt-2 text-center text-sm font-bold text-slate-900"
                    : "mt-3 text-center text-lg font-bold text-slate-900"
                }
              >
                Modeled drop ≈ {Math.round(advisory.dropHpa)} hPa over the next{" "}
                {advisory.windowHours} h (baseline{" "}
                {Math.round(advisory.baselineHpa)}{" "}
                → min {Math.round(advisory.minPressureHpa)} hPa).
              </p>
            )}
          </div>
          <div
            className={
              compact
                ? "sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                : "sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
            }
          >
            <button
              type="button"
              onClick={dismissAdvisory}
              className={
                compact
                  ? "min-h-[48px] w-full rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-black uppercase tracking-wide text-slate-950 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500"
                  : "min-h-[64px] w-full rounded-2xl border-4 border-black bg-white px-6 py-5 text-xl font-black uppercase tracking-wide text-slate-950 shadow-md transition hover:bg-slate-100 focus-visible:outline focus-visible:ring-4 focus-visible:ring-sky-500"
              }
            >
              Dismiss for 4 hours
            </button>
            {!compact && (
              <p className="mt-3 text-center text-xs font-semibold text-slate-800 sm:text-sm">
                Bottom tabs stay tappable above this card. Snooze uses local device
                storage.
              </p>
            )}
          </div>
        </section>
      )}

      <div
        className={
          compact
            ? "flex flex-col gap-2 rounded-xl border-2 border-slate-900 bg-white p-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-3"
            : "flex flex-col gap-2 rounded-2xl border-4 border-slate-900 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4"
        }
      >
        <div>
          <p
            className={
              compact
                ? "text-xs font-black text-slate-900 sm:text-sm"
                : "text-base font-black text-slate-900 sm:text-lg"
            }
          >
            Enable Weather Alerts
          </p>
          <p
            className={
              compact
                ? "text-xs font-medium text-slate-700"
                : "text-base font-medium text-slate-700"
            }
          >
            Evening Tiaki heads-up when pressure may crash tomorrow (notification
            permission + location).
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={alertsOn}
          onClick={() => void handleToggle(!alertsOn)}
          className={
            compact
              ? `min-h-[44px] min-w-[100px] shrink-0 rounded-lg border-2 border-black px-4 text-sm font-black uppercase tracking-wide transition ${
                  alertsOn
                    ? "bg-amber-400 text-slate-950"
                    : "bg-slate-100 text-slate-800"
                }`
              : `min-h-[56px] min-w-[120px] shrink-0 rounded-xl border-4 border-black px-6 text-lg font-black uppercase tracking-wide transition ${
                  alertsOn
                    ? "bg-amber-400 text-slate-950"
                    : "bg-slate-100 text-slate-800"
                }`
          }
        >
          {alertsOn ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
}
