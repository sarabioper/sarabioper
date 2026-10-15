import { poll } from "../lib/poll.mjs";

// Runs every 10 minutes; poll() itself decides whether a request to the flight API is due.
export default async () => {
  const r = await poll();
  console.log("poll-flights", JSON.stringify(r));
};

export const config = { schedule: "*/10 * * * *" };
