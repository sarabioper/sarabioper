import { store, json, authorized, istanbulNow } from "../lib/common.mjs";
import { watchFromDay } from "../lib/watch.mjs";
import { poll } from "../lib/poll.mjs";

// Shared day storage, so every dispatcher and guide sees the same list.
// GET  /api/days                          -> days of the last 7 days, with vehicle assignments and "met" marks
// PUT  /api/day?d=15.10                   -> save a parsed day (body = day JSON)
// PUT  /api/state?d=15.10&kind=assign|met -> save vehicle assignments or guide "met" marks
export default async (req) => {
  const auth = authorized(req);
  if (!auth.ok) return auth.res;
  const s = store();
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === "GET" && path === "/api/days") {
    // Every uploaded day is kept for KEEP_DAYS (15) days after its date, then removed with its marks.
    const keep = Number(process.env.KEEP_DAYS || 15);
    const today = istanbulNow().date;
    const cutoff = Date.parse(today + "T00:00:00Z") - keep * 86400000;
    const { blobs } = await s.list({ prefix: "day/" });
    const days = [];
    for (const b of blobs) {
      const k = b.key.slice(4);
      const d = await s.get("day/" + k, { type: "json" });
      if (!d) continue;
      const iso = isoOf(d, k, today);
      if (Date.parse(iso + "T00:00:00Z") < cutoff) {
        await Promise.all(["day/" + k, "state/" + k + "/assign", "state/" + k + "/met", "state/" + k + "/eta", "watch/" + iso, "live/" + iso].map((x) => s.delete(x).catch(() => {})));
        continue;
      }
      d.iso = d.iso || iso;
      d.assign = (await s.get("state/" + k + "/assign", { type: "json" })) || d.assign || {};
      d.met = (await s.get("state/" + k + "/met", { type: "json" })) || {};
      d.eta = (await s.get("state/" + k + "/eta", { type: "json" })) || {};
      days.push(d);
    }
    days.sort((a, b) => (a.iso < b.iso ? 1 : -1));
    return json({ days, keepDays: keep });
  }

  const d = url.searchParams.get("d") || "";
  if (!/^\d\d\.\d\d$/.test(d)) return json({ error: "Неверная дата" }, 400);

  if (req.method === "PUT" && path === "/api/day") {
    const body = await req.json();
    if (!body || !Array.isArray(body.arr) || !Array.isArray(body.dep)) return json({ error: "Неверный формат дня" }, 400);
    body.key = d;
    body.savedAt = new Date().toISOString();
    await s.setJSON("day/" + d, body);
    // The flights in this KAPAK become the list the server follows for that date.
    const watch = watchFromDay(body);
    let started = null;
    if (/^\d{4}-\d\d-\d\d$/.test(body.iso || "")) {
      await s.setJSON("watch/" + body.iso, watch);
      if (body.iso === istanbulNow().date) started = await poll({ force: true }).catch((e) => ({ error: String(e.message || e) }));
    }
    return json({ ok: true, watched: Object.keys(watch).length, poll: started });
  }

  if (req.method === "GET" && path === "/api/state") {
    const kind = url.searchParams.get("kind");
    if (!["assign", "met", "guides", "eta"].includes(kind)) return json({ error: "Неверный тип" }, 400);
    return json({ data: (await s.get("state/" + d + "/" + kind, { type: "json" })) || {} });
  }

  if (req.method === "PUT" && path === "/api/state") {
    const kind = url.searchParams.get("kind");
    if (!["assign", "met", "guides", "eta"].includes(kind)) return json({ error: "Неверный тип" }, 400);
    const body = await req.json();
    if (kind === "eta") {
      // airport times typed by dispatchers, one key per flight; null removes it
      const prev = (await s.get("state/" + d + "/eta", { type: "json" })) || {};
      for (const [k, v] of Object.entries(body || {})) { if (v == null) delete prev[k]; else prev[k] = v; }
      await s.setJSON("state/" + d + "/eta", prev);
      return json({ ok: true, data: prev });
    }
    if (kind === "met") {
      // merge marks so two guides ticking at once do not overwrite each other
      const prev = (await s.get("state/" + d + "/met", { type: "json" })) || {};
      for (const [id, marks] of Object.entries(body || {})) prev[id] = { ...(prev[id] || {}), ...marks };
      await s.setJSON("state/" + d + "/met", prev);
    } else {
      await s.setJSON("state/" + d + "/" + kind, body || {});
    }
    return json({ ok: true });
  }

  return json({ error: "Не найдено" }, 404);
};

// The day's own ISO date, or a guess from "dd.mm" (this year, or last year if that would be far in the future).
function isoOf(d, k, today) {
  if (/^\d{4}-\d\d-\d\d$/.test(d.iso || "")) return d.iso;
  const [dd, mm] = k.split(".");
  let y = Number(today.slice(0, 4));
  let iso = `${y}-${mm}-${dd}`;
  if (Date.parse(iso) - Date.parse(today) > 60 * 86400000) iso = `${y - 1}-${mm}-${dd}`;
  return iso;
}

export const config = { path: ["/api/days", "/api/day", "/api/state"] };
