import { flKey, hhmm } from "./common.mjs";

// Providers return { provider, flights: { "PC2008": record }, requests }.
// Record: status, sch, est, act (arrival, Antalya local HH:MM), depEst, depAct, from, term, date.

const AIRPORT = "AYT";

const fromAirLabsRow = (x) => ({
  status: x.status || "scheduled",
  sch: hhmm(x.arr_time),
  est: hhmm(x.arr_estimated),
  act: hhmm(x.arr_actual),
  depEst: hhmm(x.dep_estimated),
  depAct: hhmm(x.dep_actual),
  delay: x.arr_delayed ?? x.delayed ?? null,
  depDelay: x.dep_delayed ?? null,
  from: x.dep_iata || "",
  term: x.arr_terminal || "",
  date: String(x.arr_time || "").slice(0, 10),
});

const fromAvsRow = (x) => {
  const a = x.arrival || {}, d = x.departure || {};
  return {
    status: x.flight_status || "scheduled",
    sch: hhmm(a.scheduled),
    est: hhmm(a.estimated),
    act: hhmm(a.actual),
    depEst: hhmm(d.estimated),
    depAct: hhmm(d.actual),
    delay: a.delay ?? null,
    depDelay: d.delay ?? null,
    from: d.iata || "",
    term: a.terminal || "",
    date: String(a.scheduled || "").slice(0, 10) || x.flight_date,
  };
};

// Keep only the flights we watch (from KAPAK). Codeshares are matched too.
function collect(rows, toRec, codeOf, csOf, watch, today) {
  const out = {};
  for (const x of rows) {
    const rec = toRec(x);
    if (today && rec.date && rec.date !== today) continue;
    for (const c of [codeOf(x), csOf(x)].filter(Boolean)) {
      const k = flKey(c);
      if (!watch || watch[k]) out[k] = rec;
    }
  }
  return out;
}

// One request = every arrival into AYT. Cheapest way to cover many flights.
export async function airLabsAirport(key, watch, pages = 1, today) {
  let flights = {}, requests = 0;
  for (let page = 0; page < pages; page++) {
    const r = await fetch(`https://airlabs.co/api/v9/schedules?arr_iata=${AIRPORT}&limit=50&offset=${page * 50}&api_key=${encodeURIComponent(key)}`);
    requests++;
    const body = await r.json();
    if (body.error) throw new Error("AirLabs: " + (body.error.message || JSON.stringify(body.error)));
    const rows = body.response || [];
    Object.assign(flights, collect(rows, fromAirLabsRow, (x) => x.flight_iata, (x) => x.cs_flight_iata, watch, today));
    if (rows.length < 50) break;
  }
  return { provider: "AirLabs", flights, requests };
}

// One request = one flight. Used only for our flights the airport-wide answer missed.
export async function airLabsFlight(key, code) {
  const r = await fetch(`https://airlabs.co/api/v9/flight?flight_iata=${encodeURIComponent(code)}&api_key=${encodeURIComponent(key)}`);
  const body = await r.json();
  if (body.error) throw new Error("AirLabs: " + (body.error.message || JSON.stringify(body.error)));
  const x = body.response;
  if (!x || (x.arr_iata && x.arr_iata !== AIRPORT)) return null;
  return fromAirLabsRow(x);
}

export async function aviationstackAirport(key, watch, pages = 1, today) {
  let flights = {}, requests = 0;
  for (let page = 0; page < pages; page++) {
    const r = await fetch(`https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(key)}&arr_iata=${AIRPORT}&limit=100&offset=${page * 100}`);
    requests++;
    const body = await r.json();
    if (body.error) throw new Error("Aviationstack: " + (body.error.message || body.error.code));
    const rows = body.data || [];
    Object.assign(flights, collect(rows, fromAvsRow, (x) => x.flight && x.flight.iata, (x) => x.flight && x.flight.codeshared && x.flight.codeshared.flight_iata, watch, today));
    const total = body.pagination ? body.pagination.total : rows.length;
    if ((page + 1) * 100 >= total) break;
  }
  return { provider: "Aviationstack", flights, requests };
}

// One request = one flight, only today's instance into AYT.
export async function aviationstackFlight(key, code, today) {
  const r = await fetch(`https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(key)}&flight_iata=${encodeURIComponent(code)}&arr_iata=${AIRPORT}`);
  const body = await r.json();
  if (body.error) throw new Error("Aviationstack: " + (body.error.message || body.error.code));
  const recs = (body.data || []).map(fromAvsRow).filter((x) => !today || x.date === today);
  return recs[0] || null;
}
