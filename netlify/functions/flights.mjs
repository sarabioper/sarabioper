import { store, json, authorized, forbidden, istanbulNow, isOffice } from "../lib/common.mjs";
import { poll } from "../lib/poll.mjs";
import { flightCfg, pick, keyOf, PROVIDERS } from "../lib/flightcfg.mjs";

// GET /api/flights            -> today's saved flight statuses (no API quota used)
// GET /api/flights?refresh=1  -> manual refresh: asks the provider right now (uses quota).
//   Limited: REFRESH_MIN_GAP minutes between manual refreshes (15) and REFRESH_PER_DAY per day (5),
//   and never when the month's quota is used up.
const GAP = () => Number(process.env.REFRESH_MIN_GAP || 15);
const PER_DAY = () => Number(process.env.REFRESH_PER_DAY || 5);

function quotaOf(meta, today, cfg) {
  const airlabsBasic = meta.airlabsBasicAt && Date.now() - Date.parse(meta.airlabsBasicAt) < 24 * 3600 * 1000;
  const main = pick(cfg.arr, meta) || pick(cfg.dep, meta);
  const sameMonth = meta.month === today.slice(0, 7);
  const used = sameMonth ? (meta.used || {})[main] || 0 : 0;
  const limit = main ? cfg.limits[main] : 0;
  const manualToday = meta.manualDay === today ? meta.manualCount || 0 : 0;
  const nextAt = meta.lastManual ? new Date(Date.parse(meta.lastManual) + GAP() * 60000).toISOString() : null;
  return { airlabsBasic: !!airlabsBasic, arr: pick(cfg.arr, meta), dep: pick(cfg.dep, meta), arrMode: cfg.arr, depMode: cfg.dep, provider: main, used, limit, left: Math.max(0, limit - used), manualToday, manualPerDay: PER_DAY(), gapMin: GAP(), nextAt, lastManual: meta.lastManual || null };
}

export default async (req) => {
  const auth = await authorized(req);
  if (!auth.ok) return auth.res;
  const url = new URL(req.url);
  const s = store();
  const today = istanbulNow().date;
  const cfg = await flightCfg(s);

  // GET/PUT /api/flights/providers: the services, their keys and monthly quota; choose one for arrivals and for departures
  if (url.pathname === "/api/flights/providers") {
    if (!isOffice(auth)) return forbidden();
    if (req.method === "PUT") {
      const b = (await req.json().catch(() => ({}))) || {};
      const ok = (v) => ["auto", "off", ...PROVIDERS].includes(v);
      const prev = (await s.get("live/settings", { type: "json" })) || {};
      const next = { ...prev, arr: ok(b.arr) ? b.arr : cfg.arr, dep: ok(b.dep) ? b.dep : cfg.dep, limits: { ...(prev.limits || {}) }, changedAt: new Date().toISOString(), changedBy: auth.role === "admin" ? "администратор" : "офис" };
      for (const p of PROVIDERS) { const n = Number((b.limits || {})[p]); if (n > 0 && n < 1e7) next.limits[p] = Math.round(n); }
      await s.setJSON("live/settings", next);
      const log = (await s.get("auth/log", { type: "json" })) || [];
      log.push({ at: next.changedAt, what: `Рейсы: прилёты — ${next.arr}, вылеты — ${next.dep} (${next.changedBy})` });
      await s.setJSON("auth/log", log.slice(-500));
    }
    const c = await flightCfg(s);
    const meta = (await s.get("live/meta", { type: "json" })) || {};
    const month = today.slice(0, 7), same = meta.month === month;
    const [y, m] = month.split("-").map(Number);
    const reset = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)).toISOString().slice(0, 10);
    const info = {};
    for (const p of PROVIDERS) {
      const used = same ? (meta.used || {})[p] || 0 : 0;
      info[p] = { key: !!keyOf(p), used, limit: c.limits[p], left: Math.max(0, c.limits[p] - used), today: meta.day === today ? (meta.today || {})[p] || 0 : 0,
        last: p === "AirLabs" ? meta.lastAirLabs || null : meta.lastAviationstack || null, lastDep: p === "AirLabs" ? meta.lastAirLabsDep || null : meta.lastAvsDep || null,
        basic: p === "AirLabs" && !!(meta.airlabsBasicAt && Date.now() - Date.parse(meta.airlabsBasicAt) < 24 * 3600 * 1000) };
    }
    return json({ cfg: c, providers: info, now: { arr: pick(c.arr, meta), dep: pick(c.dep, meta) }, reset, lastError: meta.lastError || null });
  }
  let pollResult = null;
  if (url.searchParams.get("refresh") === "1") {
    if (!isOffice(auth)) return forbidden();
    const m0 = (await s.get("live/meta", { type: "json" })) || {};
    const q = quotaOf(m0, today, cfg);
    if (!q.provider) return json({ error: "Ключ API рейсов не задан на сервере", quota: q }, 429);
    if (q.left <= 0) return json({ error: "Лимит запросов на этот месяц исчерпан", quota: q }, 429);
    if (q.manualToday >= q.manualPerDay) return json({ error: "Ручные обновления на сегодня закончились", quota: q }, 429);
    if (q.nextAt && Date.now() < Date.parse(q.nextAt)) return json({ error: "Слишком часто", quota: q }, 429);
    pollResult = await poll({ force: true });
    const m1 = (await s.get("live/meta", { type: "json" })) || {};
    m1.manualCount = (m1.manualDay === today ? m1.manualCount || 0 : 0) + 1;
    m1.manualDay = today;
    m1.lastManual = new Date().toISOString();
    await s.setJSON("live/meta", m1);
  }
  const snap = await s.get("live/" + today, { type: "json" });
  const meta = (await s.get("live/meta", { type: "json" })) || {};
  const quota = quotaOf(meta, today, cfg);
  const watch = (await s.get("watch/" + today, { type: "json" })) || {};
  const watched = Object.keys(watch);
  const coverage = { watched: watched.length, found: watched.filter((k) => snap && snap.flights[k]).length, missing: watched.filter((k) => !(snap && snap.flights[k])) };
  if (!snap) {
    const noKey = !process.env.AIRLABS_KEY && !process.env.AVIATIONSTACK_KEY;
    return json({ date: today, flights: {}, message: noKey ? "Ключ API рейсов не задан на сервере" : watched.length ? "Ждём, когда наши рейсы вылетят" : "Загрузите Капак на сегодня, чтобы следить за рейсами", coverage, quota, used: meta.used || {}, lastError: meta.lastError || null, poll: pollResult });
  }
  return json({ ...snap, coverage, quota, used: meta.used || {}, lastError: meta.lastError || null, poll: pollResult });
};

export const config = { path: ["/api/flights", "/api/flights/providers"] };
