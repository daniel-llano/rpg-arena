// Turns battle log lines into events the stage can animate. The engine writes the log in a fixed
// format (see BattleEngine.cs), so a line we don't recognise is shown in the log but not animated.

export type BattleEvent =
  | { kind: "appear"; enemy: string }
  | { kind: "heroHit"; damage: number; crit: boolean }
  | { kind: "enemyHit"; damage: number; crit: boolean }
  | { kind: "guard" }
  | { kind: "potion"; heal: number }
  | { kind: "holyLight"; heal: number }
  | { kind: "volley" }
  | { kind: "fireball"; damage: number }
  | { kind: "enemyDefeated" }
  | { kind: "potionFound" }
  | { kind: "levelUp"; level: number }
  | { kind: "heroFallen" };

/**
 * The lines in `next` that weren't in `prev`. The server keeps only the last 60 lines, so the old
 * log can have lost lines at the front: find the longest tail of `prev` that starts `next`.
 */
export function newLines(prev: readonly string[], next: readonly string[]): string[] {
  for (let start = 0; start < prev.length; start++) {
    const tail = prev.length - start;
    if (tail > next.length) continue;
    let matches = true;
    for (let i = 0; i < tail; i++) {
      if (prev[start + i] !== next[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return next.slice(tail);
  }
  return [...next];
}

const hit = /^hits the .+ for (\d+)( \(critical\))?\.$/;
const enemyHit = /^The .+ hits (.+) for (\d+)( \(critical\))?\.$/;

export function parseEvent(line: string, heroName: string): BattleEvent | null {
  let m = /^A (.+) appears with \d+ HP\.$/.exec(line);
  if (m) return { kind: "appear", enemy: m[1] };

  m = enemyHit.exec(line);
  if (m && m[1] === heroName) return { kind: "enemyHit", damage: Number(m[2]), crit: Boolean(m[3]) };

  if (/^The .+ is defeated\./.test(line)) return { kind: "enemyDefeated" };
  if (line === "You find a potion.") return { kind: "potionFound" };

  m = /^Level up! (.+) is now level (\d+) and fully healed\.$/.exec(line);
  if (m && m[1] === heroName) return { kind: "levelUp", level: Number(m[2]) };

  if (!line.startsWith(`${heroName} `)) return null;
  const rest = line.slice(heroName.length + 1);

  m = hit.exec(rest);
  if (m) return { kind: "heroHit", damage: Number(m[1]), crit: Boolean(m[2]) };
  if (rest === "raises a guard.") return { kind: "guard" };
  if (rest === "looses a Volley.") return { kind: "volley" };
  if (rest.startsWith("has fallen after ")) return { kind: "heroFallen" };

  m = /^drinks a potion and recovers (\d+) HP\.$/.exec(rest);
  if (m) return { kind: "potion", heal: Number(m[1]) };
  m = /^calls down Holy Light and recovers (\d+) HP\.$/.exec(rest);
  if (m) return { kind: "holyLight", heal: Number(m[1]) };
  m = /^hurls a Fireball for (\d+) damage\.$/.exec(rest);
  if (m) return { kind: "fireball", damage: Number(m[1]) };

  return null;
}

export function parseEvents(lines: readonly string[], heroName: string): BattleEvent[] {
  return lines.map((line) => parseEvent(line, heroName)).filter((e): e is BattleEvent => e !== null);
}
