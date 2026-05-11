"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
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

export default function TiakiHomeWeatherSection() {
  const { data: advisory, isLoading } = useQuery({
    queryKey: qk.weatherPressureAdvisory,
    queryFn: checkPressureDrop,
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 30,
  });

  const [alertsOn, setAlertsOn] = useState(false);

  useEffect(() => {
    try {
      setAlertsOn(window.localStorage.getItem(LS_ALERTS) === "1");
    } catch {
      setAlertsOn(false);
    }
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

  return (
    <div className="space-y-4">
      {showBanner && (
        <section
          role="alert"
          aria-live="polite"
          className="rounded-2xl border-4 border-amber-700 bg-amber-300 p-5 shadow-lg ring-4 ring-amber-500/80"
        >
          <p className="text-center text-xl font-black leading-snug text-slate-950 sm:text-2xl">
            ⚠️ Weather Alert: Pressure Drop Detected for Tomorrow. Please
            increase your water and salt intake tonight to prepare.
          </p>
          {!isLoading && advisory != null && (
            <p className="mt-3 text-center text-lg font-bold text-slate-900">
              Modeled drop ≈ {Math.round(advisory.dropHpa)} hPa over the next{" "}
              {advisory.windowHours} h (baseline {Math.round(advisory.baselineHpa)}{" "}
              → min {Math.round(advisory.minPressureHpa)} hPa).
            </p>
          )}
        </section>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border-4 border-slate-900 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-black text-slate-900">
            Enable Weather Alerts
          </p>
          <p className="text-base font-medium text-slate-700">
            Evening Tiaki heads-up when pressure may crash tomorrow (notification
            permission + location).
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={alertsOn}
          onClick={() => void handleToggle(!alertsOn)}
          className={`min-h-[56px] min-w-[120px] shrink-0 rounded-xl border-4 border-black px-6 text-lg font-black uppercase tracking-wide transition ${
            alertsOn
              ? "bg-amber-400 text-slate-950"
              : "bg-slate-100 text-slate-800"
          }`}
        >
          {alertsOn ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
}
