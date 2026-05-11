/**
 * Browser-only weather fetch + Supabase `weather_logs` insert.
 * Uses geolocation and NEXT_PUBLIC_OPENWEATHER_API_KEY (Current Weather API).
 */
import { persistWeatherLogToSupabase } from "@/lib/supabase/weather-logs";
import {
  setEnvironmentSnapshot,
  type EnvironmentSnapshot,
} from "@/lib/environment-snapshot";

export type WeatherSnapshot = EnvironmentSnapshot;

function fetchLatLon(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { maximumAge: 300_000, timeout: 15_000, enableHighAccuracy: false },
    );
  });
}

type OwmCurrentResponse = {
  main?: {
    pressure?: number;
    temp?: number;
    humidity?: number;
  };
};

export async function fetchOpenWeatherCurrent(
  lat: number,
  lon: number,
): Promise<{
  pressureHpa: number;
  tempC: number;
  humidityPct: number | null;
} | null> {
  const key = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
  if (!key?.trim()) return null;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as OwmCurrentResponse;
  const main = data.main;
  if (typeof main?.pressure !== "number" || typeof main?.temp !== "number") {
    return null;
  }
  const humidityPct =
    typeof main.humidity === "number" ? main.humidity : null;
  return {
    pressureHpa: main.pressure,
    tempC: main.temp,
    humidityPct,
  };
}

/**
 * Gets current position, pulls OpenWeather current conditions, writes `weather_logs`,
 * and refreshes the in-memory snapshot for correlation strings.
 * Safe to call from client components only.
 */
export async function fetchAndLogWeather(): Promise<WeatherSnapshot | null> {
  if (typeof window === "undefined") return null;

  const coords = await fetchLatLon();
  if (!coords) return null;

  const wx = await fetchOpenWeatherCurrent(coords.lat, coords.lon);
  if (!wx) return null;

  const recordedAt = new Date().toISOString();
  const snapshot: EnvironmentSnapshot = {
    pressureHpa: wx.pressureHpa,
    tempC: wx.tempC,
    humidityPct: wx.humidityPct ?? undefined,
    recordedAt,
  };
  setEnvironmentSnapshot(snapshot);

  const id = crypto.randomUUID();
  const ok = await persistWeatherLogToSupabase({
    id,
    recordedAt,
    pressureHpa: wx.pressureHpa,
    tempC: wx.tempC,
    humidityPct: wx.humidityPct,
    userId: null,
  });
  if (!ok) {
    return snapshot;
  }

  return snapshot;
}

/** Text appended to crisis / high-fog logs for specialist review (OH correlation). */
export function atmosphericPressureFooter(
  pressureHpa: number | undefined,
): string | null {
  if (pressureHpa == null || Number.isNaN(pressureHpa)) return null;
  return `Atmospheric Pressure: ${Math.round(pressureHpa)} hPa`;
}

// --- Tiaki pressure-drop advisory (24h forecast, 12h window) ---

export const ADVISORY_PRESSURE_DROP_HPA = 8;
export const ADVISORY_WINDOW_HOURS = 12;

export type PressureDropCheckResult = {
  /** True when modeled drop exceeds `ADVISORY_PRESSURE_DROP_HPA` in the window. */
  weatherWarning: boolean;
  dropHpa: number;
  baselineHpa: number;
  minPressureHpa: number;
  windowHours: number;
};

type OwmForecastListItem = { dt: number; main?: { pressure?: number } };
type OwmForecastResponse = { list?: OwmForecastListItem[] };

export function evaluatePressureDropFromForecast(
  baselineHpa: number,
  forecastList: OwmForecastListItem[],
  nowSec: number,
  windowHours: number,
): PressureDropCheckResult {
  const endSec = nowSec + windowHours * 3600;
  let minP = baselineHpa;
  for (const step of forecastList) {
    if (step.dt < nowSec || step.dt > endSec) continue;
    const p = step.main?.pressure;
    if (typeof p === "number") minP = Math.min(minP, p);
  }
  const drop = baselineHpa - minP;
  return {
    weatherWarning: drop > ADVISORY_PRESSURE_DROP_HPA,
    dropHpa: Math.max(0, drop),
    baselineHpa: baselineHpa,
    minPressureHpa: minP,
    windowHours,
  };
}

function getOpenWeatherApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
  return key?.trim() ? key.trim() : null;
}

async function fetchOpenWeatherForecastList(
  lat: number,
  lon: number,
): Promise<OwmForecastListItem[] | null> {
  const key = getOpenWeatherApiKey();
  if (!key) return null;
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as OwmForecastResponse;
  return Array.isArray(data.list) ? data.list : null;
}

/** Browser geolocation — safe on client only. */
export function fetchBrowserLatLon(): Promise<{ lat: number; lon: number } | null> {
  return fetchLatLon();
}

/**
 * Uses current conditions + 3-hour stepped forecast.
 * Warns if pressure falls more than 8 hPa within the next 12 hours (Tiaki advisory).
 */
export async function checkPressureDrop(): Promise<PressureDropCheckResult | null> {
  if (typeof window === "undefined") return null;
  const coords = await fetchLatLon();
  if (!coords) return null;
  return checkPressureDropForCoordinates(coords.lat, coords.lon);
}

/** Shared by `/api/weather-advisory` and push helpers — pass explicit coordinates. */
export async function checkPressureDropForCoordinates(
  lat: number,
  lon: number,
): Promise<PressureDropCheckResult | null> {
  if (!getOpenWeatherApiKey()) return null;

  const [current, forecastList] = await Promise.all([
    fetchOpenWeatherCurrent(lat, lon),
    fetchOpenWeatherForecastList(lat, lon),
  ]);

  if (!forecastList?.length) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  let baseline = current?.pressureHpa;
  if (typeof baseline !== "number") {
    const upcoming = forecastList.find((x) => x.dt >= nowSec);
    const first = upcoming ?? forecastList[0];
    const p = first?.main?.pressure;
    baseline = typeof p === "number" ? p : undefined;
  }
  if (typeof baseline !== "number") return null;

  return evaluatePressureDropFromForecast(
    baseline,
    forecastList,
    nowSec,
    ADVISORY_WINDOW_HOURS,
  );
}
