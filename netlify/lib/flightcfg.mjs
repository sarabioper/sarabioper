// Which flight-data service follows arrivals and departures, and the monthly limits of each plan.
// Chosen on the site (office / administrator); live/settings = {arr, dep, limits:{AirLabs, Aviationstack}}.
//   arr / dep: "auto" (AirLabs, Aviationstack as a fallback), "AirLabs", "Aviationstack" or "off".
export const PROVIDERS = ["AirLabs", "Aviationstack"];
export const keyOf = (p) => (p === "AirLabs" ? process.env.AIRLABS_KEY : p === "Aviationstack" ? process.env.AVIATIONSTACK_KEY : null);
export async function flightCfg(s) {
  const c = (await s.get("live/settings", { type: "json" })) || {};
  const ok = (v) => ["auto", "off", ...PROVIDERS].includes(v);
  return {
    arr: ok(c.arr) ? c.arr : "auto",
    dep: ok(c.dep) ? c.dep : "auto",
    limits: {
      AirLabs: Number((c.limits || {}).AirLabs) || Number(process.env.AIRLABS_MONTHLY_LIMIT || 1000),
      Aviationstack: Number((c.limits || {}).Aviationstack) || Number(process.env.AVS_MONTHLY_LIMIT || 100),
    },
    changedAt: c.changedAt || null,
    changedBy: c.changedBy || null,
  };
}
// the service actually used for one direction right now
export function pick(mode, meta) {
  if (mode === "off") return null;
  if (PROVIDERS.includes(mode)) return keyOf(mode) ? mode : null;
  const airlabsBasic = meta.airlabsBasicAt && Date.now() - Date.parse(meta.airlabsBasicAt) < 24 * 3600 * 1000;
  if (keyOf("AirLabs") && !(airlabsBasic && keyOf("Aviationstack"))) return "AirLabs";
  return keyOf("Aviationstack") ? "Aviationstack" : null;
}
