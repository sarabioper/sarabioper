import { store, json, authorized, forbidden, istanbulNow, isOffice } from "../lib/common.mjs";
import { watchFromDay, watchDepFromDay } from "../lib/watch.mjs";
import { poll } from "../lib/poll.mjs";
import { guideFromPin, dayForGuide, toursForGuide, sameGuide } from "../lib/guide.mjs";

// Shared day storage, so every dispatcher and guide sees the same list.
// GET  /api/days                          -> days of the last 7 days, with vehicle assignments and "met" marks
// PUT  /api/day?d=15.10                   -> save a parsed day (body = day JSON)
// PUT  /api/state?d=15.10&kind=assign|met -> save vehicle assignments or guide "met" marks
export default async (req) => {
  const auth = await authorized(req);
  if (!auth.ok) return auth.res;
  const s = store();
  const url = new URL(req.url);
  const path = url.pathname;
  // a guide is known by his PIN; without a valid one he gets nothing
  let me = null;
  if (auth.role === "guide") {
    me = await guideFromPin(s, req);
    if (!me) return json({ error: "Нужен PIN гида", pin: true }, 401);
  }
  if (req.method === "GET" && path === "/api/whoami") return json({ role: auth.role, me });

  // admin cabinet: passwords, guide PINs and the log of changes; only the admin
  if (path === "/api/admin") {
    if (auth.role !== "admin") return forbidden();
    const log = (await s.get("auth/log", { type: "json" })) || [];
    if (req.method === "GET") {
      const pw = (await s.get("auth/passwords", { type: "json" })) || {};
      const pins = (await s.get("state/00.00/pins", { type: "json" })) || {};
      return json({ passwords: { ops: pw.ops || process.env.OPS_PASSWORD || "", guide: pw.guide || process.env.GUIDE_PASSWORD || "" }, fromEnv: { ops: !pw.ops, guide: !pw.guide }, pins, log: log.slice(-200).reverse() });
    }
    if (req.method === "PUT") {
      const body = (await req.json()) || {};
      const add = (what) => log.push({ at: new Date().toISOString(), what });
      if (body.passwords) {
        const pw = (await s.get("auth/passwords", { type: "json" })) || {};
        for (const k of ["ops", "guide"]) {
          const v = body.passwords[k];
          if (v === undefined) continue;
          const t = String(v || "").trim();
          if (t && t.length < 6) return json({ error: "Пароль — минимум 6 символов" }, 400);
          if (t && process.env.ADMIN_PASSWORD && t === process.env.ADMIN_PASSWORD.trim()) return json({ error: "Пароль не может совпадать с паролем администратора" }, 400);
          if (t) pw[k] = t; else delete pw[k];
          add((k === "ops" ? "Пароль операционного отдела" : "Пароль гидов") + " изменён");
        }
        if (pw.ops && pw.guide && pw.ops === pw.guide) return json({ error: "Пароли офиса и гидов должны отличаться" }, 400);
        await s.setJSON("auth/passwords", pw);
      }
      if (body.pins) {
        const old = (await s.get("state/00.00/pins", { type: "json" })) || {};
        const pins = {};
        const seen = new Set();
        for (const [n, p] of Object.entries(body.pins)) {
          const v = String(p || "").replace(/\D/g, "");
          if (!v) continue;
          if (v.length < 4 || v.length > 8) return json({ error: "PIN — от 4 до 8 цифр: " + n }, 400);
          if (seen.has(v)) return json({ error: "Одинаковый PIN у двух гидов: " + v }, 400);
          seen.add(v); pins[n] = v;
        }
        for (const n of new Set([...Object.keys(old), ...Object.keys(pins)])) {
          if (old[n] && !pins[n]) add("PIN забран: " + n);
          else if (!old[n] && pins[n]) add("PIN выдан: " + n);
          else if (old[n] !== pins[n]) add("PIN изменён: " + n);
        }
        await s.setJSON("state/00.00/pins", pins);
      }
      await s.setJSON("auth/log", log.slice(-500));
      return json({ ok: true });
    }
  }


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
        await Promise.all(["day/" + k, "state/" + k + "/assign", "state/" + k + "/met", "state/" + k + "/eta", "state/" + k + "/extra", "watch/" + iso, "watchdep/" + iso, "live/" + iso].map((x) => s.delete(x).catch(() => {})));
        continue;
      }
      d.iso = d.iso || iso;
      d.assign = (await s.get("state/" + k + "/assign", { type: "json" })) || d.assign || {};
      d.met = (await s.get("state/" + k + "/met", { type: "json" })) || {};
      d.eta = (await s.get("state/" + k + "/eta", { type: "json" })) || {};
      d.manual = (await s.get("state/" + k + "/extra", { type: "json" })) || {};
      days.push(me ? dayForGuide(d, me) : d);
    }
    days.sort((a, b) => (a.iso < b.iso ? 1 : -1));
    return json({ days, keepDays: keep, role: auth.role, me });
  }

  const d = url.searchParams.get("d") || "";
  if (!/^\d\d\.\d\d$/.test(d)) return json({ error: "Неверная дата" }, 400);

  if (req.method === "PUT" && path === "/api/day") {
    if (!isOffice(auth)) return forbidden();
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
      await s.setJSON("watchdep/" + body.iso, watchDepFromDay(body));
      if (body.iso === istanbulNow().date) started = await poll({ force: true }).catch((e) => ({ error: String(e.message || e) }));
    }
    return json({ ok: true, watched: Object.keys(watch).length, poll: started });
  }

  if (req.method === "GET" && path === "/api/state") {
    const kind = url.searchParams.get("kind");
    if (!["assign", "met", "guides", "eta", "settings", "tours", "tourmarks", "extra", "reports", "pins"].includes(kind)) return json({ error: "Неверный тип" }, 400);
    if (kind === "pins" && auth.role !== "admin") return forbidden();
    const data = (await s.get("state/" + d + "/" + kind, { type: "json" })) || {};
    if (me) {
      if (kind === "tours") return json({ data: toursForGuide(data, me) });
      if (kind === "reports") return json({ data: Object.fromEntries(Object.entries(data).filter(([, r]) => r && sameGuide(r.author, me))) });
      if (kind === "guides") return json({ data: Object.fromEntries(Object.entries(data).filter(([n]) => n !== "~off" && sameGuide(n, me))) });
      if (kind === "tourmarks") {
        // other buses' stop times stay (coordination); notes about other buses' guests do not
        const T = (await s.get("state/00.00/tours", { type: "json" })) || {};
        const own = new Set(Object.values(T).filter((t) => t && (sameGuide(t.guide, me) || sameGuide(t.kok, me))).map((t) => t.id));
        return json({ data: Object.fromEntries(Object.entries(data).filter(([k]) => !k.includes("|gn|") || own.has(k.split("|")[0]))) });
      }
      if (kind === "met" || kind === "extra") {
        const day = (await s.get("day/" + d, { type: "json" })) || {};
        const man = (await s.get("state/" + d + "/extra", { type: "json" })) || {};
        const cut = dayForGuide({ ...day, manual: man, met: kind === "met" ? data : {} }, me);
        return json({ data: kind === "met" ? cut.met : cut.manual });
      }
    }
    return json({ data });
  }

  if (req.method === "PUT" && path === "/api/state") {
    const kind = url.searchParams.get("kind");
    // guides may only save their check-ins (and guest notes, kept with them) and excursion stops
    if (!isOffice(auth) && !["met", "tourmarks", "reports"].includes(kind)) return forbidden();
    if (kind === "pins") return forbidden(); // PINs are set only in the admin cabinet
    if (!["assign", "met", "guides", "eta", "settings", "tours", "tourmarks", "extra", "reports", "pins"].includes(kind)) return json({ error: "Неверный тип" }, 400);
    const body = await req.json();
    if (kind === "extra") {
      // guests added by hand on the arrivals board (late booking, moved to another flight); one key per group
      const prev = (await s.get("state/" + d + "/extra", { type: "json" })) || {};
      for (const [k, v] of Object.entries(body || {})) { if (v == null) delete prev[k]; else prev[k] = v; }
      await s.setJSON("state/" + d + "/extra", prev);
      // follow the new flights too (without forcing a poll, so no extra API requests)
      const iso = url.searchParams.get("iso") || "";
      if (/^\d{4}-\d\d-\d\d$/.test(iso)) {
        const add = watchFromDay({ arr: Object.values(prev).filter((g) => g && g.fl), dep: [] });
        if (Object.keys(add).length) {
          const watch = (await s.get("watch/" + iso, { type: "json" })) || {};
          let ch = false;
          for (const [k, w] of Object.entries(add)) if (!watch[k]) { watch[k] = w; ch = true; }
          if (ch) await s.setJSON("watch/" + iso, watch);
        }
      }
      return json({ ok: true });
    }
    if (kind === "reports") {
      // incident reports from guides and the office, one key per report; only the office may delete one
      if (me) for (const v of Object.values(body || {})) if (v && typeof v === "object") v.author = me;
      const prev = (await s.get("state/" + d + "/reports", { type: "json" })) || {};
      for (const [k, v] of Object.entries(body || {})) {
        if (v == null) { if (isOffice(auth)) delete prev[k]; continue; }
        if (typeof v !== "object" || String(v.text || "").length > 5000) continue;
        prev[k] = { ...v, by: auth.role, savedAt: prev[k] ? prev[k].savedAt : new Date().toISOString() };
      }
      await s.setJSON("state/" + d + "/reports", prev);
      return json({ ok: true });
    }
    if (kind === "tours" || kind === "tourmarks") {
      // excursion programs and guide check-ins: one key per bus program / per stop, null removes it,
      // so a guide ticking a stop never overwrites an operator editing another program
      const prev = (await s.get("state/" + d + "/" + kind, { type: "json" })) || {};
      for (const [k, v] of Object.entries(body || {})) { if (v == null) delete prev[k]; else prev[k] = v; }
      await s.setJSON("state/" + d + "/" + kind, prev);
      return json({ ok: true });
    }
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

export const config = { path: ["/api/days", "/api/day", "/api/state", "/api/whoami", "/api/admin"] };
