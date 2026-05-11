/**
 * Tiaki service worker: periodic checks call `/api/weather-advisory` (same origin).
 * Evening push also runs from the main thread when alerts are enabled — SW is a fallback.
 */
const CACHE = "tiaki-sw-v1";
const COORDS_URL = "/tiaki-coords.json";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function readCoordsPayload() {
  const cache = await caches.open(CACHE);
  const res = await cache.match(new Request(COORDS_URL));
  if (!res) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function localHourInTimeZone(timeZone, nowMs) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || "UTC",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date(nowMs));
    const h = parts.find((p) => p.type === "hour")?.value;
    return h != null ? Number(h) : null;
  } catch {
    return null;
  }
}

async function maybeNotifyEvening() {
  const payload = await readCoordsPayload();
  if (!payload?.alertsEnabled || payload.lat == null || payload.lon == null) {
    return;
  }
  const tz = typeof payload.timeZone === "string" ? payload.timeZone : "UTC";
  const hour = localHourInTimeZone(tz, Date.now());
  if (hour !== 20) return;

  const dayKey = new Date().toISOString().slice(0, 10);
  const cache = await caches.open(CACHE);
  const lastRes = await cache.match(new Request("/tiaki-last-evening-notify"));
  if (lastRes) {
    const t = await lastRes.text();
    if (t === dayKey) return;
  }

  const url = `${self.location.origin}/api/weather-advisory?lat=${encodeURIComponent(String(payload.lat))}&lon=${encodeURIComponent(String(payload.lon))}`;
  const r = await fetch(url);
  if (!r.ok) return;
  const data = await r.json();
  if (!data?.weatherWarning) return;

  await self.registration.showNotification("Tiaki", {
    body: "Tiaki Alert: Tomorrow may be a high-flare day. Drink extra water tonight.",
    icon: "/icons/app-icon-192.png",
    badge: "/icons/app-icon-192.png",
    tag: "tiaki-evening-weather",
  });

  await cache.put(
    new Request("/tiaki-last-evening-notify"),
    new Response(dayKey, { headers: { "Content-Type": "text/plain" } }),
  );
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "tiaki-weather") {
    event.waitUntil(maybeNotifyEvening());
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CHECK_EVENING") {
    event.waitUntil(maybeNotifyEvening());
  }
});
