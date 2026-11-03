import { useEffect, useRef, useState } from "react";
import type { RunView } from "@/api/types";
import { newLines, parseEvents } from "./battleEvents";
import type { ArenaScene } from "./ArenaScene";

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The animated arena. PixiJS loads in its own chunk after the page is up, and if WebGL isn't
 * available the stage just stays out of the way: the panels below it show the whole battle.
 */
export function BattleStage({ run }: { run: RunView }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ArenaScene | null>(null);
  const shown = useRef<RunView | null>(null);
  const latest = useRef(run);
  latest.current = run;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let created: ArenaScene | null = null;
    (async () => {
      try {
        const { ArenaScene } = await import("./ArenaScene");
        if (cancelled || !host.current) return;
        created = await ArenaScene.create(host.current);
        if (cancelled) {
          created.destroy();
          return;
        }
        scene.current = created;
        created.show(latest.current);
        shown.current = latest.current;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      created?.destroy();
      scene.current = null;
      shown.current = null;
    };
  }, []);

  useEffect(() => {
    const stage = scene.current;
    const prev = shown.current;
    if (!stage || !prev || prev === run) return;
    shown.current = run;
    if (prev.id !== run.id || reducedMotion()) {
      stage.show(run);
      return;
    }
    void stage.play(parseEvents(newLines(prev.log, run.log), run.hero.name), run);
  }, [run]);

  return <div id="stage" ref={host} className="stage" aria-hidden="true" hidden={failed} />;
}
