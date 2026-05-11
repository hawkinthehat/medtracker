import { NextResponse, type NextRequest } from "next/server";
import { checkPressureDropForCoordinates } from "@/lib/weather";

/** Server-side pressure advisory for service worker / cron (no browser geolocation). */
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  if (lat == null || lon == null) {
    return NextResponse.json(
      { error: "lat and lon query parameters are required" },
      { status: 400 },
    );
  }
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) {
    return NextResponse.json({ error: "invalid lat/lon" }, { status: 400 });
  }
  const result = await checkPressureDropForCoordinates(la, lo);
  if (!result) {
    return NextResponse.json(
      { weatherWarning: false, unavailable: true },
      { status: 200 },
    );
  }
  return NextResponse.json(result);
}
