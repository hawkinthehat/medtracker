import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

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
