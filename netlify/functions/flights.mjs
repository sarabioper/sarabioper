import { store, json, authorized, istanbulNow } from "../lib/common.mjs";
import { poll } from "../lib/poll.mjs";

// GET /api/flights            -> today's saved flight statuses (no API quota used)
// GET /api/flights?refresh=1  -> manual refresh: asks the provider right now (uses quota).
//   Limited: REFRESH_MIN_GAP minutes between manual refreshes (15) and REFRESH_PER_DAY per day (5),
//   and never when the month's quota is used up.
const GAP = () => Number(process.env.REFRESH_MIN_GAP || 15);
const PER_DAY = () => Number(process.env.REFRESH_PER_DAY || 5);

function quotaOf(meta, today) {
  const airlabsBasic = meta.airlabsBasicAt && Date.now() - Date.parse(meta.airlabsBasicAt) < 24 * 3600 * 1000;
  const main = process.env.AIRLABS_KEY && !(airlabsBasic && process.env.AVIATIONSTACK_KEY) ? "AirLabs" : process.env.AVIATIONSTACK_KEY ? "Aviationstack" : null;
  const sameMonth = meta.month === today.slice(0, 7);
  const used = sameMonth ? (meta.used || {})[main] || 0 : 0;
  const limit = main === "AirLabs" ? Number(process.env.AIRLABS_MONTHLY_LIMIT || 1000) : Number(process.env.AVS_MONTHLY_LIMIT || 100);
  const manualToday = meta.manualDay === today ? meta.manualCount || 0 : 0;
  const nextAt = meta.lastManual ? new Date(Date.parse(meta.lastManual) + GAP() * 60000).toISOString() : null;
  return { airlabsBasic: !!airlabsBasic, provider: main, used, limit, left: Math.max(0, limit - used), manualToday, manualPerDay: PER_DAY(), gapMin: GAP(), nextAt, lastManual: meta.lastManual || null };
}

export default async (req) => {
  const auth = authorized(req);
  if (!auth.ok) return auth.res;
  const url = new URL(req.url);
  const s = store();
  const today = istanbulNow().date;
  let pollResult = null;
  if (url.searchParams.get("refresh") === "1") {
    const m0 = (await s.get("live/meta", { type: "json" })) || {};
    const q = quotaOf(m0, today);
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
  const quota = quotaOf(meta, today);
  const watch = (await s.get("watch/" + today, { type: "json" })) || {};
  const watched = Object.keys(watch);
  const coverage = { watched: watched.length, found: watched.filter((k) => snap && snap.flights[k]).length, missing: watched.filter((k) => !(snap && snap.flights[k])) };
  if (!snap) {
    const noKey = !process.env.AIRLABS_KEY && !process.env.AVIATIONSTACK_KEY;
    return json({ date: today, flights: {}, message: noKey ? "Ключ API рейсов не задан на сервере" : watched.length ? "Ждём, когда наши рейсы вылетят" : "Загрузите Капак на сегодня, чтобы следить за рейсами", coverage, quota, used: meta.used || {}, lastError: meta.lastError || null, poll: pollResult });
  }
  return json({ ...snap, coverage, quota, used: meta.used || {}, lastError: meta.lastError || null, poll: pollResult });
};

export const config = { path: "/api/flights" };
