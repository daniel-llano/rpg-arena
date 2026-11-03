import { useCallback, useEffect, useState } from "react";
import { ApiError, readToken, writeToken } from "@/api/client";
import { act, getCatalog, getLeaderboard, getRun, nextBattle, startRun } from "@/api/endpoints";
import type { BattleAction, Catalog, HeroClass, LeaderboardEntry, RunView, Weapon } from "@/api/types";
import { ActionBar } from "@/components/ActionBar";
import { BattleLog } from "@/components/BattleLog";
import { FighterCard } from "@/components/FighterCard";
import { Leaderboard } from "@/components/Leaderboard";
import { SetupForm } from "@/components/SetupForm";
import { BattleStage } from "@/game/BattleStage";
import { useBattleFeed, type FeedStatus } from "@/live/useBattleFeed";

// SQLite-backed views used to come without a zone. They are UTC, so read them that way.
const timeOf = (iso: string) => Date.parse(/(Z|[+-]\d\d:\d\d)$/.test(iso) ? iso : `${iso}Z`);

const message = (error: unknown) => (error instanceof ApiError || error instanceof Error ? error.message : String(error));

const feedText: Record<FeedStatus, string> = {
  connecting: "Connecting to the live feed…",
  live: "You're watching this battle live.",
  reconnecting: "Reconnecting…",
  offline: "Live updates aren't available. Reload to see the latest turn.",
};

function outcomeText(run: RunView) {
  if (run.status === "Victory") return `Victory! ${run.hero.name} stands over the ${run.enemy.name}.`;
  if (run.status === "Defeated") return `${run.hero.name} has fallen after ${run.wins} win(s).`;
  return "";
}

export function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshBoard = useCallback(async () => {
    try {
      setBoard(await getLeaderboard(10));
    } catch {
      setBoard((rows) => rows ?? []);
    }
  }, []);

  // Keep the newest state: a hub message can arrive before or after the HTTP response for the same turn.
  const accept = useCallback((next: RunView) => {
    setRun((current) => (current && current.id === next.id && timeOf(next.updatedAt) < timeOf(current.updatedAt) ? current : next));
  }, []);

  const feed = useBattleFeed(run?.id ?? null, (next) => {
    accept(next);
    void refreshBoard();
  });

  useEffect(() => {
    (async () => {
      try {
        setCatalog(await getCatalog());
      } catch (error) {
        setLoadError(message(error));
        return;
      }
      void refreshBoard();
      const params = new URLSearchParams(location.search);
      const id = params.get("run") ?? params.get("watch");
      if (!id) return;
      try {
        const opened = await getRun(id);
        setToken(readToken(opened.id));
        setRun(opened);
      } catch {
        setStartError("That battle doesn't exist. Start a new hero.");
      }
    })();
  }, [refreshBoard]);

  const onStart = async (name: string, heroClass: HeroClass, weapon: Weapon) => {
    setStartError(null);
    setBusy(true);
    try {
      const started = await startRun(name, heroClass, weapon);
      writeToken(started.run.id, started.token);
      history.replaceState(null, "", `?run=${started.run.id}`);
      setToken(started.token);
      setRun(started.run);
      void refreshBoard();
    } catch (error) {
      setStartError(message(error));
    } finally {
      setBusy(false);
    }
  };

  const perform = async (change: () => Promise<RunView>) => {
    setActionError(null);
    setBusy(true);
    try {
      const next = await change();
      accept(next);
      if (next.status !== "InBattle") void refreshBoard();
    } catch (error) {
      setActionError(message(error));
    } finally {
      setBusy(false);
    }
  };

  const onAct = (action: BattleAction) => run && token && perform(() => act(run.id, action, token));
  const onNext = () => run && token && perform(() => nextBattle(run.id, token));

  const mine = Boolean(token);
  const fighting = run?.status === "InBattle";
  const special = run && catalog ? (catalog.classes.find((c) => c.class === run.hero.class)?.special ?? "Special") : "Special";
  const watchUrl = run ? `${location.origin}${location.pathname}?watch=${run.id}` : "";

  return (
    <main>
      <header className="top">
        <h1>
          <a href="./">RPG Arena</a>
        </h1>
        <p className="muted">Pick a hero and fight one battle after another until you fall.</p>
      </header>

      {loadError && (
        <p className="error" role="alert">
          {loadError}
        </p>
      )}

      {catalog && !run && <SetupForm catalog={catalog} error={startError} busy={busy} onStart={onStart} />}

      {run && (
        <section id="battle" aria-label="Battle">
          <BattleStage run={run} />

          <div className="fighters">
            <FighterCard
              side="hero"
              title={run.hero.name}
              subtitle={`Level ${run.hero.level} ${run.hero.class}`}
              hp={run.hero.hp}
              maxHp={run.hero.maxHp}
              stats={`HP ${run.hero.hp}/${run.hero.maxHp} · XP ${run.hero.xp}/${run.hero.xpToNextLevel} · ${run.hero.gold} gold · ${run.hero.potions} potion(s) · ${run.wins} win(s)`}
            />
            <div className="vs" aria-hidden="true">
              vs
            </div>
            <FighterCard
              side="enemy"
              title={run.enemy.name}
              hp={run.enemy.hp}
              maxHp={run.enemy.maxHp}
              stats={`HP ${run.enemy.hp}/${run.enemy.maxHp} · attack ${run.enemy.attack} · defense ${run.enemy.defense}`}
            />
          </div>

          <ActionBar hero={run.hero} special={special} busy={busy} hidden={!mine || !fighting} onAct={(a) => void onAct(a)} />
          {mine && fighting && <p className="muted small hint">Keys: 1 Attack · 2 Defend · 3 Special · 4 Potion</p>}

          {mine && !fighting && (
            <div id="after" className="actions">
              <p id="outcome" className={`outcome ${run.status === "Victory" ? "win" : "loss"}`}>
                {outcomeText(run)}
              </p>
              {run.status === "Victory" && (
                <button id="next-btn" className="primary" disabled={busy} onClick={() => void onNext()}>
                  Next battle
                </button>
              )}
              <button id="new-btn" onClick={() => (location.href = location.pathname)}>
                New hero
              </button>
            </div>
          )}

          {!mine && (
            <p id="spectating" className="muted small">
              {feedText[feed]}
            </p>
          )}
          {!mine && !fighting && <p className="outcome">{outcomeText(run)}</p>}
          {actionError && (
            <p id="action-error" className="error" role="alert">
              {actionError}
            </p>
          )}

          <BattleLog lines={run.log} />
          <p className="muted small">
            Share to let others watch: <a id="watch-link" href={watchUrl}>{watchUrl}</a>
          </p>
        </section>
      )}

      <Leaderboard rows={board} currentRunId={run?.id ?? null} />
    </main>
  );
}
