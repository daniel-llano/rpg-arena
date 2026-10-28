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

CI also runs `dotnet ef migrations has-pending-model-changes`.

## End to end

Needs Docker and the Playwright CLI (`npm install -g playwright`).

```bash
./scripts/e2e.sh
```

It starts the container and plays through the browser UI: a full battle that lands on the leaderboard, a second browser watching a battle live without controls, and name validation.
