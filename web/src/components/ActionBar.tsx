import { useEffect, useRef } from "react";
import type { BattleAction, Hero } from "@/api/types";

interface Props {
  hero: Hero;
  special: string;
  busy: boolean;
  hidden: boolean;
  onAct: (action: BattleAction) => void;
}

const keys: Record<string, BattleAction> = { "1": "Attack", "2": "Defend", "3": "Special", "4": "Potion", a: "Attack", d: "Defend", s: "Special", p: "Potion" };

export function ActionBar({ hero, special, busy, hidden, onAct }: Props) {
  const specialReady = hero.specialCooldown === 0;
  const canDrink = hero.potions > 0 && hero.hp < hero.maxHp;
  const allowed: Record<BattleAction, boolean> = { Attack: true, Defend: true, Special: specialReady, Potion: canDrink };

  // One listener for the component's lifetime that reads the latest props, so a key pressed right
  // after a turn lands isn't caught by a listener from the render before.
  const latest = useRef({ allowed, busy, hidden, onAct });
  latest.current = { allowed, busy, hidden, onAct };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const action = keys[event.key.toLowerCase()];
      const now = latest.current;
      if (!action || now.hidden || now.busy || !now.allowed[action]) return;
      event.preventDefault();
      now.onAct(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const button = (action: BattleAction, label: string, key: string, primary = false, id?: string) => (
    <button id={id} data-action={action} className={primary ? "primary" : undefined} disabled={busy || !allowed[action]} onClick={() => onAct(action)}>
      {label}
      <kbd aria-hidden="true">{key}</kbd>
    </button>
  );

  return (
    <div id="controls" className="actions" role="group" aria-label="Your move" hidden={hidden}>
      {button("Attack", "Attack", "1", true)}
      {button("Defend", "Defend", "2")}
      {button("Special", specialReady ? special : `${special} (${hero.specialCooldown})`, "3", false, "special-btn")}
      {button("Potion", `Potion (${hero.potions})`, "4", false, "potion-btn")}
    </div>
  );
}
