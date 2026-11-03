import { newLines, parseEvent, parseEvents } from "@/game/battleEvents";

describe("newLines", () => {
  it("returns only the appended lines", () => {
    expect(newLines(["a", "b"], ["a", "b", "c", "d"])).toEqual(["c", "d"]);
  });

  it("handles a log the server trimmed at the front", () => {
    expect(newLines(["a", "b", "c"], ["b", "c", "d"])).toEqual(["d"]);
  });

  it("returns nothing when the log didn't change", () => {
    expect(newLines(["a", "b"], ["a", "b"])).toEqual([]);
  });

  it("uses the longest overlap when lines repeat", () => {
    expect(newLines(["x", "hit", "hit"], ["x", "hit", "hit", "hit"])).toEqual(["hit"]);
  });

  it("treats an unrelated log as all new", () => {
    expect(newLines(["a"], ["b", "c"])).toEqual(["b", "c"]);
  });
});

describe("parseEvent", () => {
  const hero = "Aria";

  it.each([
    ["A Wolf appears with 55 HP.", { kind: "appear", enemy: "Wolf" }],
    ["Aria hits the Wolf for 9.", { kind: "heroHit", damage: 9, crit: false }],
    ["Aria hits the Skeleton Knight for 21 (critical).", { kind: "heroHit", damage: 21, crit: true }],
    ["The Wolf hits Aria for 10.", { kind: "enemyHit", damage: 10, crit: false }],
    ["The Orc hits Aria for 18 (critical).", { kind: "enemyHit", damage: 18, crit: true }],
    ["Aria raises a guard.", { kind: "guard" }],
    ["Aria drinks a potion and recovers 40 HP.", { kind: "potion", heal: 40 }],
    ["Aria calls down Holy Light and recovers 42 HP.", { kind: "holyLight", heal: 42 }],
    ["Aria looses a Volley.", { kind: "volley" }],
    ["Aria hurls a Fireball for 35 damage.", { kind: "fireball", damage: 35 }],
    ["The Wolf is defeated. +35 XP, +12 gold.", { kind: "enemyDefeated" }],
    ["You find a potion.", { kind: "potionFound" }],
    ["Level up! Aria is now level 2 and fully healed.", { kind: "levelUp", level: 2 }],
    ["Aria has fallen after 3 win(s).", { kind: "heroFallen" }],
  ])("reads %s", (line, event) => {
    expect(parseEvent(line, hero)).toEqual(event);
  });

  it("ignores lines it doesn't know and hits on someone else", () => {
    expect(parseEvent("Something odd happens.", hero)).toBeNull();
    expect(parseEvent("The Wolf hits Brom for 10.", hero)).toBeNull();
  });

  it("copes with names that look like patterns", () => {
    expect(parseEvent("A.B (x) hits the Orc for 7.", "A.B (x)")).toEqual({ kind: "heroHit", damage: 7, crit: false });
  });

  it("keeps the order of a whole turn", () => {
    const kinds = parseEvents(["Aria looses a Volley.", "Aria hits the Wolf for 8.", "Aria hits the Wolf for 7.", "The Wolf hits Aria for 9."], hero).map((e) => e.kind);
    expect(kinds).toEqual(["volley", "heroHit", "heroHit", "enemyHit"]);
  });
});
