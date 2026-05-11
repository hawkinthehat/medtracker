import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export type WeatherLogRow = {
  id: string;
  recordedAt: string;
  pressureHpa: number;
  tempC: number;
  humidityPct: number | null;
};

function rowToWeatherLog(r: Record<string, unknown>): WeatherLogRow {
  return {
    id: String(r.id),
    recordedAt: String(r.recorded_at),
    pressureHpa: Number(r.pressure),
    tempC: Number(r.temp),
    humidityPct:
      r.humidity == null || r.humidity === ""
        ? null
        : Number(r.humidity),
  };
}

/** Recent barometric samples for specialist reports and correlation. */
export async function fetchWeatherLogsFromSupabase(
  limit = 500,
): Promise<WeatherLogRow[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("weather_logs")
    .select("id, recorded_at, pressure, temp, humidity")
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((x) => rowToWeatherLog(x as Record<string, unknown>));
}

export type WeatherLogInsert = {
  id: string;
  recordedAt: string;
  pressureHpa: number;
  tempC: number;
  humidityPct: number | null;
  userId: string | null;
};

export async function persistWeatherLogToSupabase(
  row: WeatherLogInsert,
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;

  const {
    data: { user },
  } = await sb.auth.getUser();
  const resolvedUserId = row.userId ?? user?.id ?? null;

  const { error } = await sb.from("weather_logs").insert({
    id: row.id,
    pressure: row.pressureHpa,
    temp: row.tempC,
    humidity: row.humidityPct,
    recorded_at: row.recordedAt,
    user_id: resolvedUserId,
  });
  if (error) {
    console.warn("weather_logs insert:", error.message);
    return false;
  }
  return true;
}
