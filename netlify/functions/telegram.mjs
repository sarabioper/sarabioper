import { createHash } from "node:crypto";
import { store, json, authorized, isOffice } from "../lib/common.mjs";
import { driverByPin, getDrivers, vehsOf, jobsOf, saveLoc } from "../lib/drivers.mjs";

// Telegram bot for drivers (iPhone or anyone without the Android app):
// the driver sends his PIN once, then shares a LIVE location — Telegram keeps sending it in the background.
// POST /api/tg        <- Telegram webhook (checked with the secret token)
// GET  /api/tg/setup  -> (office) connects the webhook; the bot token is TELEGRAM_BOT_TOKEN in Netlify
// state/00.00/tg = {bot: "username", links: {chatId: driverId}}
const TOKEN = () => (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const SECRET = () => createHash("sha256").update("sarabi:" + TOKEN()).digest("hex").slice(0, 48);
const tgApi = async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false }));
};
const say = (chat, text) => tgApi("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true });
const esc = (x) => String(x == null ? "" : x).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const HOWTO = "📍 <b>Canlı konum nasıl paylaşılır</b>\n" +
  "1) Bu sohbette 📎 (ataş) → <b>Konum</b>\n" +
  "2) <b>Canlı Konumu Paylaş</b> → süre: <b>“Ben kapatana kadar”</b> (yoksa 8 saat)\n" +
  "3) Telefon konum izni sorarsa: <b>Her zaman</b>\n\n" +
  "Vardiya bitince sohbetteki haritada <b>Paylaşımı durdur</b>'a basın veya /bitir yazın.";

async function jobsText(s, d) {
  const vehs = await vehsOf(s, d);
  const jobs = await jobsOf(s, vehs);
  if (!jobs.length) return `🚐 ${esc(vehs.join(", ") || d.veh || "—")}\nBugün için iş bulunamadı.`;
  return `🚐 ${esc(vehs.join(", "))}\n<b>Bugünkü işler:</b>\n` + jobs.map((j) => j.k === "arr"
    ? `• <b>${esc(j.t)}</b> ✈ KARŞILAMA ${esc(j.fl)} → ${esc(j.h)} · ${esc(j.pax)} kişi${j.g ? " · Rehber " + esc(j.g) : ""}`
    : `• <b>${esc(j.t)}</b> 🏨 DÖNÜŞ ${esc(j.h)} → ${esc(j.fl)}${j.ft ? " (" + esc(j.ft) + ")" : ""} · ${esc(j.pax)} kişi`).join("\n");
}

export default async (req) => {
  const s = store();
  const path = new URL(req.url).pathname;

  if (path === "/api/tg/setup") {
    const auth = await authorized(req);
    if (!auth.ok) return auth.res;
    if (!isOffice(auth)) return json({ error: "Только для офиса" }, 403);
    if (!TOKEN()) return json({ error: "В Netlify не задан TELEGRAM_BOT_TOKEN" }, 400);
    const me = await tgApi("getMe", {});
    if (!me.ok) return json({ error: "Telegram не принял ключ бота: " + (me.description || "проверьте TELEGRAM_BOT_TOKEN") }, 400);
    const url = new URL(req.url).origin + "/api/tg";
    const hook = await tgApi("setWebhook", { url, secret_token: SECRET(), allowed_updates: ["message", "edited_message"], drop_pending_updates: true });
    if (!hook.ok) return json({ error: "Не удалось подключить бота: " + (hook.description || "") }, 400);
    const tg = (await s.get("state/00.00/tg", { type: "json" })) || {};
    tg.bot = me.result.username;
    await s.setJSON("state/00.00/tg", tg);
    return json({ ok: true, bot: tg.bot });
  }

  if (path !== "/api/tg" || req.method !== "POST") return json({ error: "Не найдено" }, 404);
  if (!TOKEN() || req.headers.get("x-telegram-bot-api-secret-token") !== SECRET()) return json({ error: "forbidden" }, 403);
  const up = await req.json().catch(() => ({}));
  const edited = !!up.edited_message;
  const msg = up.message || up.edited_message;
  if (!msg || !msg.chat || msg.chat.type !== "private") return json({ ok: true });
  const chat = String(msg.chat.id);
  const tg = (await s.get("state/00.00/tg", { type: "json" })) || {};
  tg.links = tg.links || {};
  const D = await getDrivers(s);
  const id = tg.links[chat] && D[tg.links[chat]] ? tg.links[chat] : null;

  // a position: the first message of a live location, then its updates (edited messages)
  if (msg.location) {
    if (!id) { if (!edited) await say(chat, "Önce ofisten aldığınız <b>6 haneli PIN</b> kodunu yazın."); return json({ ok: true }); }
    const L = msg.location;
    const live = L.live_period != null;
    // live_period 0x7FFFFFFF = "until I stop it"
    const until = live && L.live_period < 0x7fffffff ? (msg.date + L.live_period) * 1000 : null;
    await saveLoc(s, id, { lat: L.latitude, lng: L.longitude, acc: L.horizontal_accuracy, hdg: L.heading, until }, "telegram");
    if (!edited) await say(chat, live ? `✅ Canlı konum alındı. İyi yolculuklar, ${esc(D[id].name)}!\nBitince /bitir yazın.` : "Bu <b>tek seferlik</b> konum. Lütfen <b>Canlı Konumu Paylaş</b>'ı seçin.\n\n" + HOWTO);
    return json({ ok: true });
  }
  if (edited) return json({ ok: true });

  const text = String(msg.text || "").trim();
  const pin = text.replace(/\D/g, "");
  if (/^\/(bitir|stop)/i.test(text)) {
    if (id) await saveLoc(s, id, { off: true }, "telegram");
    await say(chat, id ? "⏹ Vardiya kapandı, konum artık takip edilmiyor. Sohbetteki canlı konumu da durdurun (haritada “Paylaşımı durdur”)." : "Önce PIN kodunuzu yazın.");
    return json({ ok: true });
  }
  if (/^\/(isler|işler|jobs)/i.test(text) && id) { await say(chat, await jobsText(s, D[id])); return json({ ok: true }); }
  if (pin.length === 6 && pin === text.replace(/\s/g, "")) {
    const d = await driverByPin(s, pin);
    if (!d) { await say(chat, "❌ PIN yanlış. Ofise sorun."); return json({ ok: true }); }
    tg.links[chat] = d.id;
    await s.setJSON("state/00.00/tg", tg);
    await say(chat, `👋 Merhaba <b>${esc(d.name)}</b>, bağlandınız.\n\n` + (await jobsText(s, d)) + "\n\n" + HOWTO);
    return json({ ok: true });
  }
  await say(chat, id ? `${esc(D[id].name)}, konumunuzu <b>canlı</b> paylaşın.\n/isler — bugünkü işler\n/bitir — vardiyayı bitir\n\n` + HOWTO
    : "🚐 <b>SARABI · Sürücü</b>\nOfisten aldığınız <b>6 haneli PIN</b> kodunu yazın.");
  return json({ ok: true });
};

export const config = { path: ["/api/tg", "/api/tg/setup"] };
