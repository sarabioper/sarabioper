import { store, istanbulNow } from "./common.mjs";
import { fromAirLabs, fromAviationstack } from "./providers.mjs";

// Decides whether a poll is due, calls the provider and merges the result into today's snapshot.
// Quota plan (all configurable with environment variables):
//   AirLabs:        every AIRLABS_EVERY_MIN minutes (default 20) between 05:00 and 01:00
//   Aviationstack:  only at hours in AVS_HOURS (default "8,13,18" -> 90 requests a month)
export async function poll({ force = false } = {}) {
  const s = store();
  const now = istanbulNow();
  const meta = (await s.get("live/meta", { type: "json" })) || {};
  const month = now.date.slice(0, 7);
  if (meta.month !== month) { meta.month = month; meta.used = {}; }
  meta.used = meta.used || {};

  const airlabsKey = process.env.AIRLABS_KEY;
  const avsKey = process.env.AVIATIONSTACK_KEY;
  if (!airlabsKey && !avsKey) return { skipped: "Ключ API рейсов не задан на сервере" };

  const minsSinceLast = meta.last ? (Date.now() - Date.parse(meta.last)) / 60000 : Infinity;
  const nightTime = now.hour >= 1 && now.hour < 5;
  let job = null;

  if (airlabsKey) {
    const every = Number(process.env.AIRLABS_EVERY_MIN || 20);
    if (force || (!nightTime && minsSinceLast >= every - 1)) job = () => fromAirLabs(airlabsKey, Number(process.env.AIRLABS_PAGES || 1));
  }
  if (!job && avsKey) {
    const hours = String(process.env.AVS_HOURS || "8,13,18").split(",").map(Number);
    const limit = Number(process.env.AVS_MONTHLY_LIMIT || 100);
    const left = limit - (meta.used.Aviationstack || 0);
    const due = hours.includes(now.hour) && minsSinceLast > 50;
    if (left > 0 && (force || due)) job = () => fromAviationstack(avsKey, Number(process.env.AVS_PAGES || 1));
  }
  if (!job) return { skipped: "Не время для запроса", used: meta.used };

  let result;
  try {
    result = await job();
  } catch (e) {
    meta.lastError = String(e.message || e);
    await s.setJSON("live/meta", meta);
    // Fall back to Aviationstack if AirLabs failed (quota or error).
    if (airlabsKey && avsKey && !String(e.message).startsWith("Aviationstack")) {
      try { result = await fromAviationstack(avsKey, 1); } catch (e2) { return { error: meta.lastError + " / " + e2.message }; }
    } else return { error: meta.lastError };
  }

  const snapKey = "live/" + now.date;
  const prev = (await s.get(snapKey, { type: "json" })) || { flights: {} };
  const flights = { ...prev.flights };
  for (const [k, v] of Object.entries(result.flights)) {
    if (v.date && v.date !== now.date) continue;
    flights[k] = v;
  }
  const snap = { date: now.date, updated: new Date().toISOString(), provider: result.provider, flights };
  await s.setJSON(snapKey, snap);
  meta.last = snap.updated;
  meta.used[result.provider] = (meta.used[result.provider] || 0) + result.requests;
  delete meta.lastError;
  await s.setJSON("live/meta", meta);
  return { ok: true, provider: result.provider, count: Object.keys(result.flights).length, used: meta.used };
}
