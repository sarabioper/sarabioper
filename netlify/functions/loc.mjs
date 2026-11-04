import { store, json, authorized, isOffice } from "../lib/common.mjs";
import { getDrivers, driverByPin, vehsOf, jobsOf, saveLoc, todayKey } from "../lib/drivers.mjs";

// Driver locations.
// POST /api/loc        (x-driver-pin)  -> {lat,lng,acc,spd,hdg,t} or {off:true}: the driver's phone reports where it is
// POST /api/loc/hello  (x-driver-pin)  -> who the driver is and today's jobs of his vehicles
// GET  /api/locs       (office)        -> every driver: last position (if any), vehicles and today's jobs
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, x-driver-pin", "access-control-allow-methods": "GET, POST, OPTIONS" };
const out = (data, status = 200) => { const r = json(data, status); for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v); return r; };

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const s = store();
  const path = new URL(req.url).pathname;

  if (path === "/api/locs") {
    const auth = await authorized(req);
    if (!auth.ok) return auth.res;
    if (!isOffice(auth)) return json({ error: "Только для офиса" }, 403);
    const D = await getDrivers(s);
    const A = (await s.get("state/" + todayKey() + "/assign", { type: "json" })) || {};
    const tg = (await s.get("state/00.00/tg", { type: "json" })) || {};
    const L = await Promise.all(Object.entries(D).map(async ([id, d]) => {
      const x = (await s.get("loc/" + id, { type: "json" })) || { id, on: false, never: true };
      const vehs = await vehsOf(s, d, A);
      // a Telegram live location that has run out counts as switched off
      const on = !!x.on && !(x.until && Date.now() > x.until);
      return { ...x, on, name: d.name, veh: vehs.join(", ") || d.veh, phone: d.phone, tg: !!(tg.links && Object.values(tg.links).includes(id)) };
    }));
    return json({ now: Date.now(), locs: L, bot: tg.bot || null });
  }

  if (req.method !== "POST") return out({ error: "Не найдено" }, 404);
  const me = await driverByPin(s, req.headers.get("x-driver-pin"));
  if (!me) return out({ error: "Неверный PIN водителя", pin: true }, 401);

  if (path === "/api/loc/hello") { const vehs = await vehsOf(s, me); return out({ name: me.name, veh: vehs.join(", ") || me.veh, jobs: await jobsOf(s, vehs) }); }

  let b = {};
  try { b = await req.json(); } catch (e) { /* empty body */ }
  if (!(await saveLoc(s, me.id, b, "app"))) return out({ error: "Нет координат" }, 400);
  return out({ ok: true });
};

export const config = { path: ["/api/loc", "/api/loc/hello", "/api/locs"] };
