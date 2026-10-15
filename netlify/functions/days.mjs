import { store, json, authorized } from "../lib/common.mjs";

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
    const { blobs } = await s.list({ prefix: "day/" });
    const keys = blobs.map((b) => b.key.slice(4)).sort((a, b) => dayOrder(b) - dayOrder(a)).slice(0, 7);
    const days = [];
    for (const k of keys) {
      const d = await s.get("day/" + k, { type: "json" });
      if (!d) continue;
      d.assign = (await s.get("state/" + k + "/assign", { type: "json" })) || d.assign || {};
      d.met = (await s.get("state/" + k + "/met", { type: "json" })) || {};
      days.push(d);
    }
    return json({ days });
  }

  const d = url.searchParams.get("d") || "";
  if (!/^\d\d\.\d\d$/.test(d)) return json({ error: "Неверная дата" }, 400);

  if (req.method === "PUT" && path === "/api/day") {
    const body = await req.json();
    if (!body || !Array.isArray(body.arr) || !Array.isArray(body.dep)) return json({ error: "Неверный формат дня" }, 400);
    body.key = d;
    body.savedAt = new Date().toISOString();
    await s.setJSON("day/" + d, body);
    return json({ ok: true });
  }

  if (req.method === "PUT" && path === "/api/state") {
    const kind = url.searchParams.get("kind");
    if (!["assign", "met"].includes(kind)) return json({ error: "Неверный тип" }, 400);
    const body = await req.json();
    if (kind === "met") {
      // merge marks so two guides ticking at once do not overwrite each other
      const prev = (await s.get("state/" + d + "/met", { type: "json" })) || {};
      for (const [id, marks] of Object.entries(body || {})) prev[id] = { ...(prev[id] || {}), ...marks };
      await s.setJSON("state/" + d + "/met", prev);
    } else {
      await s.setJSON("state/" + d + "/assign", body || {});
    }
    return json({ ok: true });
  }

  return json({ error: "Не найдено" }, 404);
};

// "15.10" -> sortable number (month*100 + day); good within a season.
const dayOrder = (k) => { const [dd, mm] = k.split(".").map(Number); return mm * 100 + dd; };

export const config = { path: ["/api/days", "/api/day", "/api/state"] };
