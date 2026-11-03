import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/App";
import type { Catalog, RunView } from "@/api/types";

vi.mock("@/game/BattleStage", () => ({ BattleStage: () => null }));
vi.mock("@/live/useBattleFeed", () => ({ useBattleFeed: () => "live" }));

const catalog: Catalog = {
  classes: [
    { class: "Paladin", description: "Hard to kill.", maxHp: 120, attack: 12, defense: 8, speed: 4, special: "Holy Light", specialDescription: "Heal 35% of your max HP." },
    { class: "Ranger", description: "Fast and precise.", maxHp: 95, attack: 14, defense: 5, speed: 8, special: "Volley", specialDescription: "Shoot twice at 80% damage." },
  ],
  weapons: [
    { weapon: "Sword", description: "+4 attack.", attackBonus: 4, speedBonus: 0, specialMultiplier: 1 },
    { weapon: "Bow", description: "+2 attack, +3 speed.", attackBonus: 2, speedBonus: 3, specialMultiplier: 1 },
  ],
};

function makeRun(overrides: Partial<RunView> = {}): RunView {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    status: "InBattle",
    wins: 0,
    turn: 0,
    hero: { name: "Aria", class: "Ranger", weapon: "Bow", level: 1, xp: 0, gold: 0, potions: 2, maxHp: 98, hp: 98, attack: 16, defense: 5, speed: 11, specialCooldown: 0, defending: false, xpToNextLevel: 100 },
    enemy: { name: "Wolf", maxHp: 55, hp: 55, attack: 10, defense: 3, speed: 9, xp: 35, gold: 12 },
    log: ["A Wolf appears with 55 HP."],
    updatedAt: "2026-11-03T12:00:00Z",
    ...overrides,
  };
}

type Handler = (init?: RequestInit) => unknown;

function serve(routes: Record<string, Handler>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input);
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    if (!key) return new Response("not found", { status: 404 });
    const body = routes[key](init);
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

beforeEach(() => history.replaceState(null, "", "/"));

describe("App", () => {
  it("starts a run and shows the battle", async () => {
    const fetchMock = serve({
      "api/catalog": () => catalog,
      "api/leaderboard": () => [],
      "api/runs": () => ({ run: makeRun(), token: "tok" }),
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Name"), "Aria");
    await user.click(screen.getByText("Ranger", { exact: true }));
    await user.click(screen.getByText("Bow", { exact: true }));
    await user.click(screen.getByRole("button", { name: "Enter the arena" }));

    expect(await screen.findByText("Level 1 Ranger")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volley" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Potion (2)" })).toBeDisabled();
    const startCall = fetchMock.mock.calls.find(([p]) => String(p) === "api/runs")!;
    expect(JSON.parse(String(startCall[1]!.body))).toEqual({ heroName: "Aria", heroClass: "Ranger", weapon: "Bow" });
    expect(localStorage.getItem(`rpg-arena.token.${makeRun().id}`)).toBe("tok");
  });

  it("shows the server's reason when a start fails", async () => {
    serve({
      "api/catalog": () => catalog,
      "api/leaderboard": () => [],
      "api/runs": () => new Response(JSON.stringify({ errors: { HeroName: ["Pick a different name."] } }), { status: 400 }),
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Name"), "Aria");
    await user.click(screen.getByRole("button", { name: "Enter the arena" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Pick a different name.");
  });

  it("plays a turn from the keyboard", async () => {
    const run = makeRun();
    localStorage.setItem(`rpg-arena.token.${run.id}`, "tok");
    history.replaceState(null, "", `/?run=${run.id}`);
    const acted = makeRun({ turn: 1, hero: { ...run.hero, defending: true }, log: [...run.log, "Aria raises a guard."], updatedAt: "2026-11-03T12:00:01Z" });
    const fetchMock = serve({
      "api/catalog": () => catalog,
      "api/leaderboard": () => [],
      [`api/runs/${run.id}/actions`]: () => acted,
      [`api/runs/${run.id}`]: () => run,
    });
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("button", { name: "Defend" });
    await user.keyboard("2");

    expect(await screen.findByText("Aria raises a guard.")).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([p]) => String(p).endsWith("/actions"))!;
    expect(JSON.parse(String(call[1]!.body))).toEqual({ action: "Defend" });
    expect((call[1]!.headers as Headers).get("X-Run-Token")).toBe("tok");
  });

  it("lets spectators watch without controls", async () => {
    const run = makeRun();
    history.replaceState(null, "", `/?watch=${run.id}`);
    serve({ "api/catalog": () => catalog, "api/leaderboard": () => [], [`api/runs/${run.id}`]: () => run });
    render(<App />);

    expect(await screen.findByText("You're watching this battle live.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Your move" })).not.toBeInTheDocument();
  });

  it("offers the next battle after a win", async () => {
    const run = makeRun({ status: "Victory", wins: 1, enemy: { ...makeRun().enemy, hp: 0 } });
    localStorage.setItem(`rpg-arena.token.${run.id}`, "tok");
    history.replaceState(null, "", `/?run=${run.id}`);
    serve({ "api/catalog": () => catalog, "api/leaderboard": () => [], [`api/runs/${run.id}`]: () => run });
    render(<App />);

    expect(await screen.findByText("Victory! Aria stands over the Wolf.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next battle" })).toBeEnabled();
  });

  it("falls back to the setup form for an unknown run", async () => {
    history.replaceState(null, "", "/?run=missing");
    serve({ "api/catalog": () => catalog, "api/leaderboard": () => [] });
    render(<App />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That battle doesn't exist."));
    expect(screen.getByRole("button", { name: "Enter the arena" })).toBeInTheDocument();
  });
});
