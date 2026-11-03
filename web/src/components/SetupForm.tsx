import { useState, type FormEvent } from "react";
import type { Catalog, HeroClass, Weapon } from "@/api/types";

interface Props {
  catalog: Catalog;
  error: string | null;
  busy: boolean;
  onStart: (name: string, heroClass: HeroClass, weapon: Weapon) => void;
}

export function SetupForm({ catalog, error, busy, onStart }: Props) {
  const [name, setName] = useState("");
  const [heroClass, setHeroClass] = useState<HeroClass>(catalog.classes[0]?.class ?? "Paladin");
  const [weapon, setWeapon] = useState<Weapon>(catalog.weapons[0]?.weapon ?? "Sword");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart(name.trim(), heroClass, weapon);
  };

  return (
    <section id="setup" className="panel" aria-labelledby="setup-title">
      <h2 id="setup-title">New hero</h2>
      <form id="start-form" onSubmit={submit}>
        <label htmlFor="hero-name">Name</label>
        <input
          id="hero-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={24}
          placeholder="Aria"
          autoComplete="off"
        />
        <fieldset>
          <legend>Class</legend>
          <div id="classes" className="choices">
            {catalog.classes.map((c) => (
              <label key={c.class} className="choice">
                <input type="radio" name="class" value={c.class} checked={heroClass === c.class} onChange={() => setHeroClass(c.class)} />
                <span>
                  <strong>{c.class}</strong>
                  <small>
                    {c.description} Special: {c.special}, {c.specialDescription.toLowerCase()}
                  </small>
                  <span className="stats small muted">
                    HP {c.maxHp} · ATK {c.attack} · DEF {c.defense} · SPD {c.speed}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Weapon</legend>
          <div id="weapons" className="choices">
            {catalog.weapons.map((w) => (
              <label key={w.weapon} className="choice">
                <input type="radio" name="weapon" value={w.weapon} checked={weapon === w.weapon} onChange={() => setWeapon(w.weapon)} />
                <span>
                  <strong>{w.weapon}</strong>
                  <small>{w.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p id="start-error" className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={busy}>
          Enter the arena
        </button>
      </form>
    </section>
  );
}
