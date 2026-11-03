import { request } from "./client";
import type { BattleAction, Catalog, HeroClass, LeaderboardEntry, RunView, StartRunResponse, Weapon } from "./types";

// Paths are relative so the app also works when it's hosted under a sub-path.
export const getCatalog = () => request<Catalog>("api/catalog");

export const getLeaderboard = (top = 10) => request<LeaderboardEntry[]>(`api/leaderboard?top=${top}`);

export const getRun = (id: string) => request<RunView>(`api/runs/${encodeURIComponent(id)}`);

export const startRun = (heroName: string, heroClass: HeroClass, weapon: Weapon) =>
  request<StartRunResponse>("api/runs", { method: "POST", body: JSON.stringify({ heroName, heroClass, weapon }) });

export const act = (id: string, action: BattleAction, token: string) =>
  request<RunView>(`api/runs/${encodeURIComponent(id)}/actions`, { method: "POST", body: JSON.stringify({ action }) }, token);

export const nextBattle = (id: string, token: string) =>
  request<RunView>(`api/runs/${encodeURIComponent(id)}/next`, { method: "POST" }, token);
