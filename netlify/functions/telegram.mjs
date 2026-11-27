import { createHash } from "node:crypto";
import { store, json, authorized, isOffice } from "../lib/common.mjs";
import { driverByPin, getDrivers, vehsOf, jobsOf, saveLoc } from "../lib/drivers.mjs";
import { TOKEN, tgApi, tgSay as say, tgEsc as esc } from "../lib/tg.mjs";

// Telegram bot for drivers (iPhone or anyone without the Android app):
// the driver sends his PIN once, then shares a LIVE location — Telegram keeps sending it in the background.
// POST /api/tg        <- Telegram webhook (checked with the secret token)
// GET  /api/tg/setup  -> (office) connects the webhook; the bot token is TELEGRAM_BOT_TOKEN in Netlify
// GET/POST/DELETE /api/tg/sales (administrator) -> sales notifications: the chats that get them, a one-time link to subscribe
// state/00.00/tg = {bot: "username", links: {chatId: driverId}, subs: {chatId: {name, at}}, code: {v, exp}}
const SECRET = () => createHash("sha256").update("sarabi:" + TOKEN()).digest("hex").slice(0, 48);

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

  if (path === "/api/tg/sales") {
    const auth = await authorized(req);
    if (!auth.ok) return auth.res;
    if (auth.role !== "admin") return json({ error: "Только администратор" }, 403);
    const tg = (await s.get("state/00.00/tg", { type: "json" })) || {};
    tg.subs = tg.subs || {};
    if (req.method === "POST") {
      if (!TOKEN()) return json({ error: "В Netlify не задан TELEGRAM_BOT_TOKEN" }, 400);
      if (!tg.bot) { const me = await tgApi("getMe", {}); if (me.ok) tg.bot = me.result.username; }
      tg.code = { v: "S" + Math.random().toString(36).slice(2, 10).toUpperCase(), exp: Date.now() + 30 * 60000 };
      await s.setJSON("state/00.00/tg", tg);
    } else if (req.method === "DELETE") {
      const chat = new URL(req.url).searchParams.get("chat");
      if (chat && tg.subs[chat]) { delete tg.subs[chat]; await s.setJSON("state/00.00/tg", tg); await say(chat, "🔕 Уведомления о продажах отключены."); }
    }
    const code = tg.code && tg.code.exp > Date.now() ? tg.code.v : null;
    return json({ bot: tg.bot || null, hasToken: !!TOKEN(), subs: Object.entries(tg.subs).map(([chat, x]) => ({ chat, name: x.name, at: x.at })), link: code && tg.bot ? `https://t.me/${tg.bot}?start=${code}` : null, code });
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
  // sales notifications: the administrator's one-time link (t.me/bot?start=CODE) or the code typed in
  const code = text.replace(/^\/start\s*/i, "").trim().toUpperCase();
  if (tg.code && tg.code.exp > Date.now() && code && code === tg.code.v) {
    tg.subs = tg.subs || {};
    tg.subs[chat] = { name: [msg.from && msg.from.first_name, msg.from && msg.from.last_name].filter(Boolean).join(" ") || "—", at: new Date().toISOString() };
    tg.code = null;
    await s.setJSON("state/00.00/tg", tg);
    await say(chat, "✅ <b>SARABI · продажи</b>\nТеперь сюда приходит каждая продажа гидов: пакет, цена (440/380 — если была скидка), гости, автобус.\n/satis_off — отключить.");
    return json({ ok: true });
  }
  if (/^\/satis_off/i.test(text)) {
    if (tg.subs && tg.subs[chat]) { delete tg.subs[chat]; await s.setJSON("state/00.00/tg", tg); }
    await say(chat, "🔕 Уведомления о продажах отключены.");
    return json({ ok: true });
  }
  if (tg.subs && tg.subs[chat] && !id) { await say(chat, "💰 Сюда приходят продажи гидов.\n/satis_off — отключить."); return json({ ok: true }); }
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

export const config = { path: ["/api/tg", "/api/tg/setup", "/api/tg/sales"] };
