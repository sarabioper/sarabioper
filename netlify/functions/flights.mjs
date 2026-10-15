import { store, json, authorized, istanbulNow } from "../lib/common.mjs";
import { poll } from "../lib/poll.mjs";

// GET /api/flights            -> today's saved flight statuses (no API quota used)
// GET /api/flights?refresh=1  -> ask the provider right now (uses one request), then return
export default async (req) => {
  const auth = authorized(req);
  if (!auth.ok) return auth.res;
  const url = new URL(req.url);
  let pollResult = null;
  if (url.searchParams.get("refresh") === "1") pollResult = await poll({ force: true });
  const s = store();
  const today = istanbulNow().date;
  const snap = await s.get("live/" + today, { type: "json" });
  const meta = (await s.get("live/meta", { type: "json" })) || {};
  if (!snap) {
    const noKey = !process.env.AIRLABS_KEY && !process.env.AVIATIONSTACK_KEY;
    return json({ date: today, flights: {}, message: noKey ? "Ключ API рейсов не задан на сервере" : "Статусы рейсов на сегодня ещё не загружены", used: meta.used || {}, lastError: meta.lastError || null, poll: pollResult });
  }
  return json({ ...snap, used: meta.used || {}, lastError: meta.lastError || null, poll: pollResult });
};

export const config = { path: "/api/flights" };
