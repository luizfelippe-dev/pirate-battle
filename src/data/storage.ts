import { defaults, validOptions, type Options } from "../game/config";
import type { EndReason } from "../game/simulation";
export interface Match {
  id: string;
  playerId: string;
  playerName: string;
  date: string;
  score: number;
  duration: number;
  reason: EndReason;
  config: Options;
  version: number;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`pirate:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  localStorage.setItem(`pirate:${key}`, JSON.stringify(value));
}
export function loadOptions() {
  const o = read<unknown>("options", defaults);
  return validOptions(o) ? o : defaults;
}
export function playerId() {
  let id = read("player", "");
  if (!id) {
    id = crypto.randomUUID();
    save("player", id);
  }
  return id;
}
export function pending() {
  return read<Match[]>("pending", []);
}
export function enqueue(match: Match) {
  save("last", match);
  save("pending", [...pending().filter((m) => m.id !== match.id), match]);
}
export function acknowledge(id: string) {
  save(
    "pending",
    pending().filter((m) => m.id !== id),
  );
}
