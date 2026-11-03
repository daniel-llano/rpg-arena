# Testing RPG Arena

## Unit and integration

```bash
./scripts/test.sh
```

```powershell
.\scripts\test.ps1
```

- `tests/RpgArena.Core.Tests`: class and weapon stats, seeded replays, damage, Defend over 200 seeds, special cooldowns, potions, victory rewards, level ups, defeat, and the log cap.
- `tests/RpgArena.Api.Tests`: the API on a temporary SQLite file. Covers starting runs, the run token, game-rule errors, a full battle that ends up on the leaderboard, and a SignalR client that watches a run and receives the next state.

- `web/src/test`: turning battle log lines into animation events (including a log the server trimmed), the API client's error messages and run tokens, and the page: starting a run, a failed start, a turn played from the keyboard, spectating without controls, the next battle after a win, and an unknown run.

`./scripts/test.sh` also runs `npm run typecheck` and `npm run build` for the web app.

CI also runs `dotnet ef migrations has-pending-model-changes`.

## End to end

Needs Docker and the Playwright CLI (`npm install -g playwright`).

```bash
./scripts/e2e.sh
```

It starts the container and plays through the browser UI: a full battle that lands on the leaderboard, a second browser watching a battle live without controls, the PixiJS stage and the number keys, and name validation. CI runs the same suite after the unit tests.
