import { store, istanbulNow } from "./common.mjs";
import { airLabsAirport, airLabsFlight, aviationstackAirport } from "./providers.mjs";
import { activeFlights, missingSoon, toMin } from "./watch.mjs";

// The flight list comes from the uploaded KAPAK. No KAPAK for today -> no requests at all.
// A request is made only while at least one of our flights is in the air or about to land.
//
// AirLabs (if AIRLABS_KEY):     airport-wide every AIRLABS_EVERY_MIN (20) minutes while our flights are active,
//                               plus single-flight requests for our flights it missed (max AIRLABS_SINGLE_PER_POLL, 3).
// Aviationstack (fallback):     airport-wide, at most AVS_PER_DAY (3) a day and AVS_MONTHLY_LIMIT (100) a month,
//                               only when a flight of ours lands within 90 minutes and was not checked in the last 2 hours.
export async function poll({ force = false } = {}) {
  const s = store();
  const now = istanbulNow();
  const nowMin = now.hour * 60 + now.minute;
  const watch = await s.get("watch/" + now.date, { type: "json" });
  if (!watch || !Object.keys(watch).length) return { skipped: "На сегодня Капак не загружен, рейсы не отслеживаются" };

  const airlabsKey = process.env.AIRLABS_KEY;
  const avsKey = process.env.AVIATIONSTACK_KEY;
  if (!airlabsKey && !avsKey) return { skipped: "Ключ API рейсов не задан на сервере" };

  const snapKey = "live/" + now.date;
  const snap = (await s.get(snapKey, { type: "json" })) || { date: now.date, flights: {}, checked: {} };
  snap.checked = snap.checked || {};
  const meta = (await s.get("live/meta", { type: "json" })) || {};
  const month = now.date.slice(0, 7);
  if (meta.month !== month) { meta.month = month; meta.used = {}; }
  if (meta.day !== now.date) { meta.day = now.date; meta.today = {}; }
  meta.used = meta.used || {}; meta.today = meta.today || {};

  const active = activeFlights(watch, snap.flights, nowMin);
  if (!active.length && !force) return { skipped: "Сейчас ни один наш рейс не в пути", watched: Object.keys(watch).length };

  const minsSince = (p) => (meta["last" + p] ? (Date.now() - Date.parse(meta["last" + p])) / 60000 : Infinity);
  const count = (p, n) => { meta.used[p] = (meta.used[p] || 0) + n; meta.today[p] = (meta.today[p] || 0) + n; };
  let found = {}, provider = null, errors = [];

  // 1) AirLabs
  if (airlabsKey && (force || minsSince("AirLabs") >= Number(process.env.AIRLABS_EVERY_MIN || 20) - 1)) {
    try {
      const r = await airLabsAirport(airlabsKey, watch, Number(process.env.AIRLABS_PAGES || 1));
      count("AirLabs", r.requests); meta.lastAirLabs = new Date().toISOString();
      Object.assign(found, r.flights); provider = "AirLabs";
      // single-flight requests for ours that the airport list missed
      const merged = { ...snap.flights, ...found };
      const missing = missingSoon(watch, merged, nowMin).filter((w) => (snap.checked[w.code] || 0) < 2);
      for (const w of missing.slice(0, Number(process.env.AIRLABS_SINGLE_PER_POLL || 3))) {
        snap.checked[w.code] = (snap.checked[w.code] || 0) + 1;
        const rec = await airLabsFlight(airlabsKey, w.code); count("AirLabs", 1);
        if (rec) found[w.code] = rec;
      }
    } catch (e) { errors.push(String(e.message || e)); }
  }

  // 2) Aviationstack (main if no AirLabs, fallback if AirLabs failed)
  const avsWanted = avsKey && (!airlabsKey || errors.length);
  if (avsWanted) {
    const left = Number(process.env.AVS_MONTHLY_LIMIT || 100) - (meta.used.Aviationstack || 0);
    const leftToday = Number(process.env.AVS_PER_DAY || 3) - (meta.today.Aviationstack || 0);
    const soon = active.filter((w) => {
      const l = snap.flights[w.code];
      const eta = toMin((l && l.est) || w.sch);
      return eta - nowMin <= 90 && eta - nowMin >= -20;
    });
    const due = soon.length > 0 && minsSince("Aviationstack") >= 120;
    if (left > 0 && (force || (due && leftToday > 0))) {
      try {
        const r = await aviationstackAirport(avsKey, watch, 1);
        count("Aviationstack", r.requests); meta.lastAviationstack = new Date().toISOString();
        Object.assign(found, r.flights); provider = provider || "Aviationstack";
      } catch (e) { errors.push(String(e.message || e)); }
    }
  }

  if (!provider) {
    if (errors.length) { meta.lastError = errors.join(" / "); await s.setJSON("live/meta", meta); return { error: meta.lastError }; }
    return { skipped: "Не время для запроса", active: active.length, used: meta.used };
  }
  for (const [k, v] of Object.entries(found)) { if (!v.date || v.date === now.date) snap.flights[k] = v; }
  snap.updated = new Date().toISOString();
  snap.provider = provider;
  await s.setJSON(snapKey, snap);
  meta.lastError = errors.length ? errors.join(" / ") : null;
  await s.setJSON("live/meta", meta);
  return { ok: true, provider, found: Object.keys(found).length, active: active.length, used: meta.used };
}
