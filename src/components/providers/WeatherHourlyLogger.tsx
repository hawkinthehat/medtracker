"use client";

import { useEffect } from "react";
import { fetchAndLogWeather } from "@/lib/weather";

const HOUR_BUCKET_MS = 60 * 60 * 1000;

function hourBucketKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

/**
 * Polls ~hourly: geolocation + OpenWeather → `weather_logs` via {@link fetchAndLogWeather}.
 */
export default function WeatherHourlyLogger() {
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      const bucket = hourBucketKey();
      try {
        if (typeof sessionStorage !== "undefined") {
          const dedupeKey = `medtracker-weather-hour-${bucket}`;
          if (sessionStorage.getItem(dedupeKey) === "1") return;
        }
      } catch {
        /* ignore */
      }

      try {
        const snap = await fetchAndLogWeather();
        if (!snap || cancelled) return;
        try {
          sessionStorage.setItem(`medtracker-weather-hour-${bucket}`, "1");
        } catch {
          /* ignore */
        }
      } catch (e) {
        console.warn("[weather] hourly logger tick failed (non-fatal):", e);
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), HOUR_BUCKET_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return null;
}
