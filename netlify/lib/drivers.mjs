import { istanbulNow } from "./common.mjs";

// Drivers (state/00.00/drivers = {id: {name, veh, phone, pin}}) and their last position (loc/<id>).
// Shared by the Android app (functions/loc.mjs) and the Telegram bot (functions/telegram.mjs).
export const digits = (p) => String(p || "").replace(/\D/g, "").slice(-10);
export const todayKey = () => { const { date } = istanbulNow(); return date.slice(8, 10) + "." + date.slice(5, 7); };
export const getDrivers = async (s) => (await s.get("state/00.00/drivers", { type: "json" })) || {};
export async function driverByPin(s, pin) {
  pin = String(pin || "").replace(/\D/g, "");
  if (pin.length < 4) return null;
  const D = await getDrivers(s);
  for (const [id, d] of Object.entries(D)) if (d && String(d.pin) === pin) return { id, ...d };
  return null;
}
const num = (v, lo, hi) => { const x = Number(v); return Number.isFinite(x) && x >= lo && x <= hi ? x : null; };

// one phone can drive several vehicles in a day (MİNİ 1 in the morning, MİNİ 8 in the evening)
export async function vehsOf(s, me, assign) {
  const V = new Set(me.veh ? [String(me.veh).toUpperCase()] : []);
  const ph = digits(me.phone);
  if (ph.length === 10) {
    const A = assign || (await s.get("state/" + todayKey() + "/assign", { type: "json" })) || {};
    for (const [v, a] of Object.entries(A)) if (v[0] !== "~" && a && digits(a.phone) === ph) V.add(v.toUpperCase());
  }
  return [...V];
}
// today's jobs of these vehicles, from the uploaded KAPAK and the hand-added groups
export async function jobsOf(s, vehs) {
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
// a new position (or the end of the shift); src = "app" | "telegram"; until = when a Telegram live location ends
export async function saveLoc(s, id, b, src) {
  const key = "loc/" + id;
  const prev = (await s.get(key, { type: "json" })) || { id, trail: [] };
  const now = Date.now();
  if (b.off) { await s.setJSON(key, { ...prev, on: false, offAt: now }); return true; }
  const lat = num(b.lat, -90, 90), lng = num(b.lng, -180, 180);
  if (lat == null || lng == null) return false;
  const trail = [...(prev.trail || []), [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5, now]].slice(-40);
  await s.setJSON(key, { id, lat, lng, acc: num(b.acc, 0, 1e5), spd: num(b.spd, 0, 100), hdg: num(b.hdg, 0, 360), at: now, on: true, onAt: prev.on ? prev.onAt || now : now, src: src || "app", until: b.until || null, trail });
  return true;
}
