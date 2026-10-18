import { store, istanbulNow } from "./common.mjs";
import { airLabsAirport, airLabsFlight, aviationstackAirport, aviationstackFlight } from "./providers.mjs";
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

  // 1) AirLabs. On the Free plan it has no live times: detected once, then skipped for a day.
  const airlabsBasic = meta.airlabsBasicAt && Date.now() - Date.parse(meta.airlabsBasicAt) < 24 * 3600 * 1000;
  if (airlabsKey && !airlabsBasic && (force || minsSince("AirLabs") >= Number(process.env.AIRLABS_EVERY_MIN || 20) - 1)) {
    try {
      const r = await airLabsAirport(airlabsKey, watch, Number(process.env.AIRLABS_PAGES || 1), now.date);
      count("AirLabs", r.requests); meta.lastAirLabs = new Date().toISOString();
      if (r.basic) { meta.airlabsBasicAt = new Date().toISOString(); errors.push("AirLabs: тариф без живых данных (только расписание)"); }
      else { Object.assign(found, r.flights); provider = "AirLabs"; meta.airlabsBasicAt = null; }
      // single-flight requests for ours that the airport list missed
      const merged = { ...snap.flights, ...found };
      const missing = missingSoon(watch, merged, nowMin).filter((w) => (snap.checked[w.code] || 0) < 2);
      for (const w of provider ? missing.slice(0, Number(process.env.AIRLABS_SINGLE_PER_POLL || 3)) : []) {
        snap.checked[w.code] = (snap.checked[w.code] || 0) + 1;
        const rec = await airLabsFlight(airlabsKey, w.code); count("AirLabs", 1);
        if (rec && rec.rich) found[w.code] = rec;
      }
    } catch (e) { errors.push(String(e.message || e)); }
  }

  // 2) Aviationstack (main if no AirLabs, fallback if AirLabs failed)
  const avsWanted = avsKey && (!airlabsKey || errors.length || airlabsBasic);
  if (avsWanted) {
    const left = Number(process.env.AVS_MONTHLY_LIMIT || 100) - (meta.used.Aviationstack || 0);
    const leftToday = Number(process.env.AVS_PER_DAY || 3) - (meta.today.Aviationstack || 0);
    // our flights landing within 90 minutes, or already late and still not landed
    const soon = active.filter((w) => {
      const l = snap.flights[w.code];
      const eta = toMin((l && l.est) || w.sch);
      return eta - nowMin <= 90;
    });
    const every = Number(process.env.AVS_EVERY_MIN || 120);
    const due = soon.length > 0 && minsSince("Aviationstack") >= every - 1;
    if (left > 0 && (force || (due && leftToday > 0))) {
      try {
        const r = await aviationstackAirport(avsKey, watch, Number(process.env.AVS_PAGES || 1), now.date);
        count("Aviationstack", r.requests); meta.lastAviationstack = new Date().toISOString();
        Object.assign(found, r.flights); provider = provider || "Aviationstack";
        // paid plans: ask by flight number for the ones that matter right now
        const single = Number(process.env.AVS_SINGLE_PER_POLL || 0);
        const need = soon.filter((w) => { const l = found[w.code] || snap.flights[w.code]; return !l || !(l.est || l.act); }).slice(0, single);
        for (const w of need) {
          if (Number(process.env.AVS_MONTHLY_LIMIT || 100) - (meta.used.Aviationstack || 0) <= 0) break;
          const rec = await aviationstackFlight(avsKey, w.code, now.date); count("Aviationstack", 1);
          if (rec) found[w.code] = rec;
        }
      } catch (e) { errors.push(String(e.message || e)); }
    }
  }

  if (!provider) {
    if (errors.length) { meta.lastError = errors.join(" / "); await s.setJSON("live/meta", meta); return { error: meta.lastError }; }
    return { skipped: "Не время для запроса", active: active.length, used: meta.used };
  }
  const stamp = new Date().toISOString();
  for (const [k, v] of Object.entries(found)) {
    if (v.date && v.date !== now.date) continue;
    const old = snap.flights[k];
    if (v.rich === false && old && old.rich !== false) continue; // never replace live data with a bare timetable line
    snap.flights[k] = { ...v, at: stamp, src: v.src || provider };
  }
  snap.updated = new Date().toISOString();
  snap.provider = provider;
  await s.setJSON(snapKey, snap);
  meta.lastError = errors.length ? errors.join(" / ") : null;
  await s.setJSON("live/meta", meta);
  return { ok: true, provider, found: Object.keys(found).length, active: active.length, used: meta.used };
}
