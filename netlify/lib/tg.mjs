// Telegram: shared by the drivers' bot and the sales notifications
// state/00.00/tg = {bot, links:{chatId: driverId}, subs:{chatId:{name, at}}, code:{v, exp}}
export const TOKEN = () => (process.env.TELEGRAM_BOT_TOKEN || "").trim();
export const tgApi = async (method, body) => {
  if (!TOKEN()) return { ok: false };
  const r = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return r ? r.json().catch(() => ({ ok: false })) : { ok: false };
};
export const tgSay = (chat, text) => tgApi("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true });
export const tgEsc = (x) => String(x == null ? "" : x).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const money = (v) => (Math.round((+v || 0) * 100) / 100).toLocaleString("ru-RU") + " $";
const dm = (iso) => (iso ? iso.slice(8, 10) + "." + iso.slice(5, 7) : "");

// one message per ticket: bus, guests, every line as "440/380 ×2 = 760 $" (list price / price sold, when a discount or surcharge was given)
export async function notifySales(s, list) {
  if (!TOKEN() || !list.length) return;
  const tg = (await s.get("state/00.00/tg", { type: "json" })) || {};
  const chats = Object.keys(tg.subs || {});
  if (!chats.length) return;
  const T = (await s.get("state/00.00/tours", { type: "json" })) || {};
  const by = new Map();
  for (const v of list) { const k = v.tk || v.id; if (!by.has(k)) by.set(k, []); by.get(k).push(v); }
  for (const L of by.values()) {
    const t = T[L[0].tid] || {};
    const days = (t.days || []).length ? ` · ${dm(t.days[0].d)}–${dm(t.days[t.days.length - 1].d)}` : "";
    const names = [...new Set(L.map((x) => x.n).filter(Boolean))];
    const refs = [...new Set(L.map((x) => x.ref).filter(Boolean))];
    // the same item at the same price for several guests is one line: «440/380 ×2»
    const M = new Map();
    for (const x of L) { const k = [x.name || x.item, x.price, x.list || ""].join("|"); const m = M.get(k); if (m) { m.qty = (+m.qty || 1) + (+x.qty || 1); m.sum = (+m.sum || 0) + (+x.sum || 0); } else M.set(k, { ...x }); }
    const lines = [...M.values()].map((x) => {
      const q = +x.qty || 1, p = +x.price || 0, l = +x.list || 0;
      const pr = l && l !== p ? `<b>${l}/${p}</b>${p < l ? " 🔻" : " 🔺"}` : `<b>${p}</b>`;
      return `• ${tgEsc(x.name || x.item)} ${pr}${q > 1 ? " ×" + q : ""} = ${money(x.sum)}`;
    });
    const tot = L.reduce((a, x) => a + (+x.sum || 0), 0);
    const disc = L.reduce((a, x) => a + ((+x.list || +x.price || 0) - (+x.price || 0)) * (+x.qty || 1), 0);
    const text = `💰 <b>Продажа</b> · 🚌 ${tgEsc(t.bus || "—")}${days}\n` +
      (names.length ? `👤 ${tgEsc(names.join(", "))}\n` : "") + lines.join("\n") +
      `\n<b>Итого: ${money(tot)}</b>${disc > 0 ? ` · скидка ${money(disc)}` : disc < 0 ? ` · сверху ${money(-disc)}` : ""}\n` +
      `Продал: ${tgEsc(L[0].by || "—")}${refs.length ? " · 🤝 привёл " + tgEsc(refs.join(", ")) : ""}${L[0].tk ? " · билет " + tgEsc(L[0].tk) : ""}`;
    await Promise.all(chats.map((c) => tgSay(c, text)));
  }
}
