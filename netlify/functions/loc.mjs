import { store, json, authorized, isOffice, istanbulNow } from "../lib/common.mjs";

// Driver locations.
// POST /api/loc        (x-driver-pin)  -> {lat,lng,acc,spd,hdg,t} or {off:true}: the driver's phone reports where it is
// POST /api/loc/hello  (x-driver-pin)  -> who the driver is and today's jobs of his vehicle
// GET  /api/locs       (office)        -> the last position of every driver, with a short trail
// Drivers are created by the administrator (state/00.00/drivers = {id: {name, veh, phone, pin}}).
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, x-driver-pin", "access-control-allow-methods": "GET, POST, OPTIONS" };
const out = (data, status = 200) => { const r = json(data, status); for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v); return r; };

async function driverFromPin(s, req) {
  const pin = String(req.headers.get("x-driver-pin") || "").replace(/\D/g, "");
  if (pin.length < 4) return null;
  const D = (await s.get("state/00.00/drivers", { type: "json" })) || {};
  for (const [id, d] of Object.entries(D)) if (d && String(d.pin) === pin) return { id, ...d };
  return null;
}
const num = (v, lo, hi) => { const x = Number(v); return Number.isFinite(x) && x >= lo && x <= hi ? x : null; };

// the jobs of one vehicle today (and tomorrow early morning), from the uploaded KAPAK
const digits = (p) => String(p || "").replace(/\D/g, "").slice(-10);
const todayKey = () => { const { date } = istanbulNow(); return date.slice(8, 10) + "." + date.slice(5, 7); };
// one phone can drive several vehicles in a day (MİNİ 1 in the morning, MİNİ 8 in the evening)
async function vehsOf(s, me) {
  const V = new Set(me.veh ? [String(me.veh).toUpperCase()] : []);
  const ph = digits(me.phone);
  if (ph.length === 10) {
    const A = (await s.get("state/" + todayKey() + "/assign", { type: "json" })) || {};
    for (const [v, a] of Object.entries(A)) if (v[0] !== "~" && a && digits(a.phone) === ph) V.add(v.toUpperCase());
  }
  return [...V];
}
async function jobsOf(s, vehs) {
  if (!vehs.length) return [];
  const key = todayKey();
  const day = await s.get("day/" + key, { type: "json" });
  if (!day) return [];
  const man = (await s.get("state/" + key + "/extra", { type: "json" })) || {};
  const vOf = (g) => ((man["rg:" + g.id] || {}).v) || g.v;
  const norm = (x) => String(x || "").toUpperCase().replace(/[İI]/g, "I").replace(/\s+/g, " ").trim();
  const VS = new Set(vehs.map(norm));
  const mine = (g) => VS.has(norm(vOf(g)));
  const arr = (day.arr || []).filter((g) => !man["mv:" + g.id] && mine(g)).map((g) => ({ k: "arr", t: g.t, fl: g.fl, h: g.h, pax: g.pax, g: g.g, term: g.term, v: vOf(g) }));
  const extra = Object.entries(man).filter(([k, g]) => k.startsWith("g:") && g && mine(g)).map(([, g]) => ({ k: "arr", t: g.t, fl: g.fl, h: g.h, pax: g.pax, g: g.g, term: g.term, v: vOf(g) }));
  const dep = (day.dep || []).filter(mine).map((g) => ({ k: "dep", t: g.pu || g.t, fl: g.fl, ft: g.t, h: g.h, pax: g.pax, g: g.g, term: g.term, v: vOf(g) }));
  return [...arr, ...extra, ...dep].sort((a, b) => String(a.t).localeCompare(String(b.t)));
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const s = store();
  const path = new URL(req.url).pathname;

  if (path === "/api/locs") {
    const auth = await authorized(req);
    if (!auth.ok) return auth.res;
    if (!isOffice(auth)) return json({ error: "Только для офиса" }, 403);
    const { blobs } = await s.list({ prefix: "loc/" });
    const all = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })));
    const D = (await s.get("state/00.00/drivers", { type: "json" })) || {};
    // a driver removed by the administrator disappears from the map
    const L = [];
    for (const x of all) if (x && D[x.id]) { const vehs = await vehsOf(s, D[x.id]); L.push({ ...x, name: D[x.id].name, veh: vehs.join(", ") || D[x.id].veh, phone: D[x.id].phone }); }
    return json({ now: Date.now(), locs: L });
  }

  if (req.method !== "POST") return out({ error: "Не найдено" }, 404);
  const me = await driverFromPin(s, req);
  if (!me) return out({ error: "Неверный PIN водителя", pin: true }, 401);

  if (path === "/api/loc/hello") { const vehs = await vehsOf(s, me); return out({ name: me.name, veh: vehs.join(", ") || me.veh, jobs: await jobsOf(s, vehs) }); }

  let b = {};
  try { b = await req.json(); } catch (e) { /* empty body */ }
  const key = "loc/" + me.id;
  const prev = (await s.get(key, { type: "json" })) || { id: me.id, trail: [] };
  const now = Date.now();
  if (b.off) {
    await s.setJSON(key, { ...prev, on: false, offAt: now });
    return out({ ok: true });
  }
  const lat = num(b.lat, -90, 90), lng = num(b.lng, -180, 180);
  if (lat == null || lng == null) return out({ error: "Нет координат" }, 400);
  const trail = [...(prev.trail || []), [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5, now]].slice(-40);
  await s.setJSON(key, { id: me.id, lat, lng, acc: num(b.acc, 0, 1e5), spd: num(b.spd, 0, 100), hdg: num(b.hdg, 0, 360), at: now, on: true, onAt: prev.on ? prev.onAt || now : now, trail });
  return out({ ok: true });
};

export const config = { path: ["/api/loc", "/api/loc/hello", "/api/locs"] };
