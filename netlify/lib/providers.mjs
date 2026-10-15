import { flKey, hhmm } from "./common.mjs";

// Each provider returns { provider, flights: { "PC2008": {...} }, requests }.
// A flight record: status, sch, est, act (arrival times HH:MM, Antalya local),
// depEst, depAct, from, term, date.

const AIRPORT = "AYT";

export async function fromAirLabs(key, pages = 1) {
  const flights = {};
  let requests = 0;
  for (let page = 0; page < pages; page++) {
    const url = `https://airlabs.co/api/v9/schedules?arr_iata=${AIRPORT}&limit=50&offset=${page * 50}&api_key=${encodeURIComponent(key)}`;
    const r = await fetch(url);
    requests++;
    const body = await r.json();
    if (body.error) throw new Error("AirLabs: " + (body.error.message || JSON.stringify(body.error)));
    const rows = body.response || [];
    for (const x of rows) {
      const rec = {
        status: x.status || "scheduled",
        sch: hhmm(x.arr_time),
        est: hhmm(x.arr_estimated),
        act: hhmm(x.arr_actual),
        depEst: hhmm(x.dep_estimated),
        depAct: hhmm(x.dep_actual),
        delay: x.arr_delayed ?? x.delayed ?? null,
        from: x.dep_iata || "",
        term: x.arr_terminal || "",
        date: String(x.arr_time || "").slice(0, 10),
      };
      if (x.flight_iata) flights[flKey(x.flight_iata)] = rec;
      if (x.cs_flight_iata) flights[flKey(x.cs_flight_iata)] = { ...rec, operatedBy: x.flight_iata };
    }
    if (rows.length < 50) break;
  }
  return { provider: "AirLabs", flights, requests };
}

export async function fromAviationstack(key, pages = 1) {
  const flights = {};
  let requests = 0;
  for (let page = 0; page < pages; page++) {
    const url = `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(key)}&arr_iata=${AIRPORT}&limit=100&offset=${page * 100}`;
    const r = await fetch(url);
    requests++;
    const body = await r.json();
    if (body.error) throw new Error("Aviationstack: " + (body.error.message || body.error.code));
    const rows = body.data || [];
    for (const x of rows) {
      const a = x.arrival || {}, d = x.departure || {};
      const rec = {
        status: x.flight_status || "scheduled",
        sch: hhmm(a.scheduled),
        est: hhmm(a.estimated),
        act: hhmm(a.actual),
        depEst: hhmm(d.estimated),
        depAct: hhmm(d.actual),
        delay: a.delay ?? null,
        from: d.iata || "",
        term: a.terminal || "",
        date: x.flight_date || String(a.scheduled || "").slice(0, 10),
      };
      const code = x.flight && x.flight.iata;
      if (code) flights[flKey(code)] = rec;
      const cs = x.flight && x.flight.codeshared && x.flight.codeshared.flight_iata;
      if (cs) flights[flKey(cs)] = { ...rec, operatedBy: code };
    }
    const total = body.pagination ? body.pagination.total : rows.length;
    if ((page + 1) * 100 >= total) break;
  }
  return { provider: "Aviationstack", flights, requests };
}
