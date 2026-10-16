import { getStore } from "@netlify/blobs";

export const store = () => getStore({ name: "sarabi-ops", consistency: "strong" });

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// Every API call carries the shared password in the x-ops-key header.
export function authorized(req) {
  const want = process.env.OPS_PASSWORD;
  if (!want) return { ok: false, res: json({ error: "На сервере не задан пароль OPS_PASSWORD" }, 500) };
  let got = req.headers.get("x-ops-key") || "";
  try { got = decodeURIComponent(got); } catch (e) { /* old clients sent it unencoded */ }
  const norm = (x) => String(x).trim().normalize("NFC");
  if (norm(got) !== norm(want)) return { ok: false, res: json({ error: "Неверный пароль" }, 401) };
  return { ok: true };
}

// Current date and time in Istanbul.
export function istanbulNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24, minute: Number(parts.minute) };
}

// "PC2008", "PC 2008", "pc 02008" -> "PC2008"
export const flKey = (s) => {
  const m = String(s || "").toUpperCase().replace(/\s+/g, "").match(/^([A-Z0-9]{2})0*(\d+)$/);
  return m ? m[1] + m[2] : String(s || "").toUpperCase().replace(/\s+/g, "");
};

// "2026-10-15T12:10:00+00:00" or "2026-10-15 12:10" -> "12:10" (both providers give airport local time)
export const hhmm = (s) => {
  const m = String(s || "").match(/[T ](\d\d:\d\d)/);
  return m ? m[1] : null;
};
