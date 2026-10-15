import { flKey } from "./common.mjs";

// Approximate flight time to Antalya, minutes, by origin airport.
const DUR = { AER: 120, SOC: 120, FRU: 330, UFA: 270, SAW: 75, IST: 75, ESB: 70, TZX: 80, TBS: 150, GYD: 180, TSE: 330, NQZ: 330,
  SVX: 300, VKO: 225, SVO: 225, DME: 225, MOW: 225, KRR: 150, ALA: 360, CIT: 330, MRV: 150, VNO: 180, LED: 240, KUF: 270,
  OVB: 330, DXB: 270, CEK: 300, KGD: 240, STR: 210, CGN: 210, KZN: 240, BER: 210, AMS: 240, REN: 270 };

const toMin = (t) => { const m = /^(\d\d):(\d\d)$/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

// Build the list of flights to follow from an uploaded day (Excel KAPAK).
// Only real flight numbers into AYT are watched; "!!!" / "???" rows and Gazipaşa are skipped.
export function watchFromDay(day) {
  const list = {};
  for (const g of day.arr || []) {
    if (!g.fl || /^[!?]/.test(g.fl) || (g.to && g.to !== "AYT")) continue;
    const sch = toMin(g.t);
    if (sch == null) continue;
    const key = flKey(g.fl);
    const w = list[key] || (list[key] = { code: key, sch: g.t, from: g.org || "", pax: 0 });
    w.pax += Number(g.pax) || 0;
  }
  for (const w of Object.values(list)) {
    const s = toMin(w.sch), dur = DUR[w.from] || 180;
    w.winStart = s - dur - 30; // around take-off
    w.winEnd = s + 60;         // an hour after scheduled landing
  }
  return list;
}

// Flights we still need news about at minute `now` (Istanbul): inside their window and not landed yet.
export function activeFlights(watch, live, now) {
  return Object.values(watch || {}).filter((w) => {
    const l = live[w.code];
    if (l && (l.act || ["landed", "cancelled", "diverted"].includes(l.status))) return false;
    const eta = l && l.est ? toMin(l.est) : toMin(w.sch);
    const end = Math.max(w.winEnd, (eta ?? 0) + 30);
    return now >= w.winStart && now <= end;
  });
}

// Flights landing soon that the airport-wide answer did not include.
export function missingSoon(watch, live, now, aheadMin = 120) {
  return Object.values(watch || {}).filter((w) => !live[w.code] && toMin(w.sch) - now <= aheadMin && toMin(w.sch) - now >= -30);
}

export { toMin };
