import axios from "axios";
import { QueryClient } from "@tanstack/react-query";
import type { Options } from "../game/config";
import { playerId, type Match, type Page } from "./storage";
import { basePath } from "../paths";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 0, refetchOnWindowFocus: true },
    mutations: { retry: 1, retryDelay: 500 },
  },
});
const http = axios.create({ baseURL: `${basePath}api`, timeout: 3500 });
export async function getPage(
  kind: "ranking" | "history",
  page: number,
  config: Options,
  signal: AbortSignal,
) {
  return (
    await http.get<Page<Match>>(`/${kind}`, {
      params: { page, ...config, player: playerId() },
      signal,
    })
  ).data;
}
export async function postMatch(match: Match) {
  return (
    await http.post<Match>("/history", match, {
      headers: { "Idempotency-Key": match.id },
    })
  ).data;
}
