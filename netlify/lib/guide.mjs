// Guides log in with the guide password plus a personal PIN; they only receive their own work.
const TR = { "İ": "I", "I": "I", "ı": "I", "Ş": "S", "Ğ": "G", "Ü": "U", "Ö": "O", "Ç": "C" };
export const normName = (s) => String(s || "").toLocaleUpperCase("tr").replace(/[İIıŞĞÜÖÇ]/g, (c) => TR[c] || c)
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
// "ALİBEK" (KAPAK) and "ALİBEK MUFTİ" (vehicle list) are the same guide; two full names must be equal
export function sameGuide(a, b) {
  const A = normName(a).split(" ").filter(Boolean), B = normName(b).split(" ").filter(Boolean);
  if (!A.length || !B.length) return false;
  if (A.join(" ") === B.join(" ")) return true;
  if (A.length === 1 || B.length === 1) return A[0] === B[0];
  return false;
}
export async function guideFromPin(s, req) {
  const pin = String(req.headers.get("x-guide-pin") || "").trim();
  if (!/^\d{4,8}$/.test(pin)) return null;
  const pins = (await s.get("state/00.00/pins", { type: "json" })) || {};
  const name = Object.keys(pins).find((n) => String(pins[n]) === pin);
  return name || null;
}
// one day cut down to the guide's own groups (a reassignment "rg:" decides who meets the group now)
export function dayForGuide(d, me) {
  const man = d.manual || {};
  const eff = (g) => ((man["rg:" + g.id] || {}).g) || g.g;
  const mine = (g) => sameGuide(eff(g), me);
  const out = { ...d, arr: (d.arr || []).filter(mine), dep: (d.dep || []).filter(mine), h2hList: (d.h2hList || []).filter((g) => sameGuide(g.g, me)) };
  const manual = {};
  for (const [k, v] of Object.entries(man)) if (k.startsWith("g:") && v && mine(v)) manual[k] = v;
  const ids = new Set([...out.arr, ...out.dep, ...out.h2hList, ...Object.values(manual)].map((g) => g.id));
  for (const [k, v] of Object.entries(man)) { const id = k.slice(3); if ((k.startsWith("rg:") || k.startsWith("mv:")) && ids.has(id)) manual[k] = v; }
  out.manual = manual;
  out.met = Object.fromEntries(Object.entries(d.met || {}).filter(([id]) => ids.has(id)));
  delete out.recon; delete out.check; delete out.breakdown;
  return out;
}
// tours: his own bus with its guests (without money and passport numbers); other buses only as a route, for coordination
export function toursForGuide(T, me) {
  const out = {};
  for (const [k, t] of Object.entries(T || {})) {
    if (!t || !t.days) { if (k === "~places") out[k] = t; continue; }
    if (sameGuide(t.guide, me) || sameGuide(t.kok, me)) out[k] = { ...t, gx: (t.gx || []).map(({ trf, pass, ...x }) => x) };
    else out[k] = { id: t.id, bus: t.bus, name: t.name, pax: t.pax, days: t.days };
  }
  return out;
}
