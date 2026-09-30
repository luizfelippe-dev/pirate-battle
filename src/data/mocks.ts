import { http, HttpResponse, delay, passthrough } from "msw";
import { setupWorker } from "msw/browser";
import { read, save, playerId, type Match } from "./storage";
import { balance, defaults, validOptions } from "../game/config";
import { basePath, assetUrl } from "../paths";
export const scenarios = [
  "success",
  "empty",
  "populated",
  "slow",
  "variable",
  "timeout",
  "offline",
  "bad-request",
  "server-error",
  "ranking-error",
  "history-error",
  "timeout-after-save",
  "asset-error-once",
] as const;
export type Scenario = (typeof scenarios)[number];
let requestCount = 0;
let assetFailureDelivered = false;
export function fixtures(): Match[] {
  return Array.from({ length: 23 }, (_, i) => ({
    id: `fixture-${i}`,
    playerId: `captain-${i}`,
    playerName:
      [
        "Blackwater",
        "Anne Bonny",
        "Salt & Thunder",
        "Old Seabird",
        "Calico Jack",
      ][i % 5] + ` ${i + 1}`,
    date: new Date(Date.UTC(2026, 8, 20, 12, i)).toISOString(),
    score: 25 - i,
    duration: 90,
    reason: "time",
    config: { ...defaults },
    version: balance.version,
  }));
}
async function condition(resource: string) {
  const s = read<Scenario>("scenario", "success");
  const n = ++requestCount;
  await delay(
    s === "slow" ? 1800 : s === "variable" ? (n % 2 === 0 ? 90 : 1600) : 120,
  );
  if (s === "timeout") {
    await delay(6000);
    return HttpResponse.json({ error: "Request timed out" }, { status: 504 });
  }
  if (s === "offline") return HttpResponse.error();
  if (s === "bad-request")
    return HttpResponse.json(
      { error: "Simulated invalid request" },
      { status: 400 },
    );
  if (s === "server-error" || s === `${resource}-error`)
    return HttpResponse.json(
      { error: "Harbor service unavailable" },
      { status: 503 },
    );
}
const records = () => read<Match[]>("confirmed", []);
export const handlers = [
  http.get(assetUrl("png/default/ships/ship_3.png"), () => {
    if (
      read<Scenario>("scenario", "success") === "asset-error-once" &&
      !assetFailureDelivered
    ) {
      assetFailureDelivered = true;
      return new HttpResponse(null, { status: 503 });
    }
    return passthrough();
  }),
  http.get(`${basePath}api/:resource`, async ({ request, params }) => {
    const resource = String(params.resource);
    if (!["ranking", "history"].includes(resource))
      return new HttpResponse(null, { status: 404 });
    const scenario = read<Scenario>("scenario", "success");
    const snapshot = records();
    if (scenario === "populated") {
      snapshot.push(
        ...fixtures()
          .slice(0, 12)
          .map((m) => ({
            ...m,
            id: `history-${m.id}`,
            playerId: playerId(),
            playerName: "You",
          })),
      );
    }
    const failure = await condition(resource);
    if (failure) return failure;
    const url = new URL(request.url),
      page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const empty = scenario === "empty";
    const rows = empty
      ? []
      : resource === "ranking"
        ? [...fixtures(), ...snapshot]
            .filter(
              (m) =>
                m.config.duration ===
                  Number(url.searchParams.get("duration")) &&
                m.config.spawnInterval ===
                  Number(url.searchParams.get("spawnInterval")) &&
                m.version === balance.version,
            )
            .sort(
              (a, c) =>
                c.score - a.score ||
                a.date.localeCompare(c.date) ||
                a.id.localeCompare(c.id),
            )
        : snapshot
            .filter((m) => m.playerId === url.searchParams.get("player"))
            .sort(
              (a, c) =>
                c.date.localeCompare(a.date) || a.id.localeCompare(c.id),
            );
    return HttpResponse.json({
      items: rows.slice((page - 1) * 5, page * 5),
      total: rows.length,
      page,
      pages: Math.max(1, Math.ceil(rows.length / 5)),
    });
  }),
  http.post(`${basePath}api/history`, async ({ request }) => {
    const failure = await condition("history");
    if (failure) return failure;
    const m = (await request.json()) as Match;
    if (
      !m.id ||
      !m.playerId ||
      !validOptions(m.config) ||
      !Number.isInteger(m.score) ||
      m.score < 0 ||
      !["time", "sunk"].includes(m.reason) ||
      !Number.isFinite(m.duration) ||
      m.duration < 0 ||
      m.duration > m.config.duration
    )
      return HttpResponse.json({ error: "Invalid match" }, { status: 400 });
    const rows = records(),
      existing = rows.find((r) => r.id === m.id);
    if (existing) return HttpResponse.json(existing);
    save("confirmed", [...rows, m]);
    if (read<Scenario>("scenario", "success") === "timeout-after-save")
      await delay(6000);
    return HttpResponse.json(m, { status: 201 });
  }),
];
export const worker = setupWorker(...handlers);
export function resetNetwork() {
  requestCount = 0;
  assetFailureDelivered = false;
  save("confirmed", []);
  save("scenario", "success");
}
