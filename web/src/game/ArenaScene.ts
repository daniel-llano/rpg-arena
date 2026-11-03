import { Application, Container, Graphics, Text } from "pixi.js";
import type { RunView } from "@/api/types";
import type { BattleEvent } from "./battleEvents";
import { enemySprite, heroSprite, shieldArt } from "./sprites";

// The arena is drawn for a 900x320 stage and scaled to fit, so positions below are in stage units.
const W = 900;
const H = 320;
const FLOOR = 262;
const HERO_X = 230;
const ENEMY_X = 670;

interface Actor {
  root: Container;
  body: Container;
  baseX: number;
  dx: number;
  dy: number;
  floats: boolean;
  phase: number;
}

interface Tween {
  elapsed: number;
  duration: number;
  step: (t: number) => void;
  done: () => void;
}

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  ttl: number;
}

const ease = (t: number) => 1 - (1 - t) * (1 - t);
const there = (t: number) => (t < 0.5 ? ease(t * 2) : ease((1 - t) * 2));

/** The battle view drawn with PixiJS. It only animates: every number the player needs is in the page. */
export class ArenaScene {
  private readonly app: Application;
  private readonly world = new Container();
  private readonly fx = new Container();
  private readonly torches: Graphics[] = [];
  private hero: Actor | null = null;
  private enemy: Actor | null = null;
  private enemyName = "";
  private heroKey = "";
  private shield: Graphics | null = null;
  private tweens = new Set<Tween>();
  private particles: Particle[] = [];
  private queue: Promise<void> = Promise.resolve();
  private pending = 0;
  private speed = 1;
  private time = 0;
  private fitted = { w: 0, h: 0 };
  private destroyed = false;

  private constructor(app: Application) {
    this.app = app;
  }

  static async create(host: HTMLElement): Promise<ArenaScene> {
    const app = new Application();
    await app.init({ resizeTo: host, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
    host.appendChild(app.canvas);
    const scene = new ArenaScene(app);
    scene.build();
    return scene;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const t of this.tweens) t.done();
    this.tweens.clear();
    this.app.destroy({ removeView: true }, { children: true });
  }

  /** Puts the fighters in their resting pose for this state, with no animation. */
  show(run: RunView) {
    this.ensureHero(run);
    this.ensureEnemy(run.enemy.name);
    this.pose(run);
  }

  /** Plays the events in order, then settles on the state. Calls queue up behind each other. */
  play(events: BattleEvent[], run: RunView): Promise<void> {
    this.pending++;
    this.queue = this.queue.then(async () => {
      this.speed = this.pending > 1 ? 2.5 : 1;
      try {
        this.ensureHero(run);
        for (const event of events) {
          if (this.destroyed) return;
          await this.animate(event, run);
        }
        if (!this.destroyed) this.pose(run);
      } finally {
        this.pending--;
      }
    });
    return this.queue;
  }

  private build() {
    this.app.stage.addChild(this.world);
    this.drawArena();
    this.world.addChild(this.fx);
    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS));
  }

  private fit() {
    const { width, height } = this.app.screen;
    if (width === this.fitted.w && height === this.fitted.h) return;
    this.fitted = { w: width, h: height };
    const scale = Math.min(width / W, height / H);
    this.world.scale.set(scale);
    this.world.position.set((width - W * scale) / 2, height - H * scale);
  }

  private drawArena() {
    const bg = new Graphics();
    bg.roundRect(0, 0, W, H, 18).fill(0x1d1813);
    // Stone wall with a crowd ledge on top.
    bg.rect(0, 70, W, 150).fill(0x2a231b);
    for (let row = 0; row < 5; row++) {
      const y = 70 + row * 30;
      bg.moveTo(0, y).lineTo(W, y).stroke({ width: 2, color: 0x1a1510 });
      for (let x = (row % 2) * 45; x < W; x += 90) bg.moveTo(x, y).lineTo(x, y + 30).stroke({ width: 2, color: 0x1a1510 });
    }
    bg.rect(0, 52, W, 18).fill(0x3a3026);
    for (let x = 16; x < W; x += 26) {
      const tall = (x * 7) % 5;
      bg.circle(x, 42 - tall, 9).fill(0x15110d);
      bg.roundRect(x - 10, 44 - tall, 20, 12, 6).fill(0x15110d);
    }
    // Sand floor.
    bg.rect(0, 212, W, H - 212).fill(0x8a6f4a);
    bg.ellipse(W / 2, FLOOR, 400, 40).fill({ color: 0xa3865c, alpha: 0.7 });
    bg.rect(0, 212, W, 6).fill({ color: 0x000000, alpha: 0.25 });
    this.world.addChild(bg);

    for (const x of [70, W - 70]) {
      const post = new Graphics().rect(x - 5, 118, 10, 60).fill(0x3b2c1e).rect(x - 12, 112, 24, 8).fill(0x5a4632);
      const flame = new Graphics();
      flame.position.set(x, 108);
      this.world.addChild(post, flame);
      this.torches.push(flame);
    }
  }

  private ensureHero(run: RunView) {
    const key = `${run.hero.class}/${run.hero.weapon}`;
    if (this.hero && this.heroKey === key) return;
    if (this.hero) this.hero.root.destroy({ children: true });
    const body = heroSprite(run.hero.class, run.hero.weapon);
    this.hero = this.addActor(body, HERO_X, false);
    this.heroKey = key;
  }

  private ensureEnemy(name: string) {
    if (this.enemy && this.enemyName === name) return;
    if (this.enemy) this.enemy.root.destroy({ children: true });
    const art = enemySprite(name);
    this.enemy = this.addActor(art.root, ENEMY_X, art.floats);
    this.enemyName = name;
  }

  private addActor(body: Container, x: number, floats: boolean): Actor {
    const root = new Container();
    const shadow = new Graphics().ellipse(0, 0, 46, 9).fill({ color: 0x000000, alpha: 0.3 });
    root.addChild(shadow, body);
    root.position.set(x, FLOOR);
    this.world.addChildAt(root, this.world.getChildIndex(this.fx));
    return { root, body, baseX: x, dx: 0, dy: 0, floats, phase: Math.random() * Math.PI * 2 };
  }

  private pose(run: RunView) {
    const { hero, enemy } = this;
    if (!hero || !enemy) return;
    hero.body.rotation = run.status === "Defeated" ? -Math.PI / 2 : 0;
    hero.body.tint = run.status === "Defeated" ? 0x777777 : 0xffffff;
    hero.body.alpha = run.status === "Defeated" ? 0.75 : 1;
    enemy.root.alpha = run.status === "Victory" ? 0 : 1;
    enemy.body.rotation = 0;
    enemy.dx = 0;
    enemy.dy = 0;
    this.setShield(run.status === "InBattle" && run.hero.defending);
  }

  private setShield(on: boolean) {
    if (on && !this.shield && this.hero) {
      this.shield = shieldArt();
      this.hero.root.addChild(this.shield);
    } else if (!on && this.shield) {
      this.shield.destroy();
      this.shield = null;
    }
  }

  private async animate(event: BattleEvent, run: RunView) {
    const hero = this.hero;
    if (!hero) return;
    switch (event.kind) {
      case "appear": {
        this.ensureEnemy(event.enemy);
        const enemy = this.enemy;
        if (!enemy) return;
        enemy.body.rotation = 0;
        enemy.dy = 0;
        enemy.root.alpha = 0;
        enemy.dx = 260;
        await this.tween(550, (t) => {
          enemy.dx = 260 * (1 - ease(t));
          enemy.root.alpha = t;
        });
        break;
      }
      case "heroHit":
        if (run.hero.weapon === "Sword") await this.lunge(hero, 1);
        else await this.projectile(run.hero.weapon === "Bow" ? "arrow" : "bolt");
        this.struck(this.enemy, event.damage, event.crit);
        await this.wait(160);
        break;
      case "volley":
        await this.tween(220, (t) => (hero.dx = -10 * there(t)));
        break;
      case "fireball":
        await this.projectile("fireball");
        this.burst(ENEMY_X, FLOOR - 70, 0xff8a3a, 26);
        this.struck(this.enemy, event.damage, false);
        await this.wait(200);
        break;
      case "enemyHit":
        if (this.enemy) await this.lunge(this.enemy, -1);
        this.struck(hero, event.damage, event.crit);
        await this.wait(160);
        break;
      case "guard":
        this.setShield(true);
        if (this.shield) {
          const shield = this.shield;
          await this.tween(260, (t) => shield.scale.set(0.6 + 0.4 * ease(t)));
        }
        break;
      case "potion":
        this.bubbles(HERO_X, 0x6fe08a);
        this.float(HERO_X, FLOOR - 150, `+${event.heal}`, 0x6fe08a, 30);
        await this.wait(450);
        break;
      case "holyLight": {
        const beam = new Graphics().rect(-34, -H, 68, H).fill({ color: 0xffe9a3, alpha: 0.5 });
        beam.position.set(HERO_X, FLOOR);
        this.fx.addChild(beam);
        this.float(HERO_X, FLOOR - 150, `+${event.heal}`, 0x6fe08a, 30);
        await this.tween(600, (t) => (beam.alpha = there(t)));
        beam.destroy();
        break;
      }
      case "enemyDefeated": {
        const enemy = this.enemy;
        if (!enemy) return;
        await this.tween(650, (t) => {
          enemy.body.rotation = 0.9 * ease(t);
          enemy.dy = 20 * t;
          enemy.root.alpha = 1 - t;
        });
        break;
      }
      case "potionFound":
        this.float(HERO_X, FLOOR - 160, "+1 potion", 0x9ff2ff, 22);
        await this.wait(350);
        break;
      case "levelUp":
        this.burst(HERO_X, FLOOR - 60, 0xffd34a, 30);
        this.float(HERO_X, FLOOR - 175, `Level ${event.level}!`, 0xffd34a, 30);
        await this.wait(600);
        break;
      case "heroFallen":
        await this.tween(700, (t) => {
          hero.body.rotation = (-Math.PI / 2) * ease(t);
          hero.body.alpha = 1 - 0.25 * t;
        });
        break;
    }
  }

  private lunge(actor: Actor, direction: 1 | -1) {
    return this.tween(300, (t) => (actor.dx = 120 * direction * there(t)));
  }

  private async projectile(kind: "arrow" | "bolt" | "fireball") {
    const g = new Graphics();
    if (kind === "arrow") {
      g.moveTo(-22, 0).lineTo(10, 0).stroke({ width: 3, color: 0xd8c39a }).poly([10, -5, 20, 0, 10, 5]).fill(0xdfe6ee);
    } else {
      const color = kind === "fireball" ? 0xff8a3a : 0x46c0d8;
      const size = kind === "fireball" ? 16 : 9;
      g.circle(0, 0, size * 1.7).fill({ color, alpha: 0.3 }).circle(0, 0, size).fill(color).circle(0, 0, size * 0.45).fill(0xfff3c4);
    }
    const startX = HERO_X + 40;
    const endX = ENEMY_X - 30;
    const y = FLOOR - 70;
    g.position.set(startX, y);
    this.fx.addChild(g);
    await this.tween(kind === "arrow" ? 240 : 380, (t) => {
      g.x = startX + (endX - startX) * t;
      g.y = y - Math.sin(t * Math.PI) * (kind === "arrow" ? 18 : 30);
      if (kind !== "arrow" && Math.random() < 0.6) this.spark(g.x, g.y, kind === "fireball" ? 0xffb36a : 0x9ff2ff);
    });
    g.destroy();
  }

  private struck(actor: Actor | null, damage: number, crit: boolean) {
    if (!actor) return;
    const body = actor.body;
    body.tint = 0xff7a6a;
    void this.tween(260, (t) => {
      actor.dx = Math.sin(t * Math.PI * 6) * 8 * (1 - t);
      if (t >= 1) body.tint = 0xffffff;
    });
    this.burst(actor.baseX, FLOOR - 70, crit ? 0xffd34a : 0xffffff, crit ? 16 : 8);
    this.float(actor.baseX, FLOOR - 150, crit ? `${damage}!` : `${damage}`, crit ? 0xffd34a : 0xff8a7a, crit ? 40 : 30);
  }

  private float(x: number, y: number, text: string, color: number, size: number) {
    const label = new Text({
      text,
      style: { fontFamily: "system-ui, Segoe UI, sans-serif", fontSize: size, fontWeight: "800", fill: color, stroke: { color: 0x120f0c, width: 5 } },
    });
    label.anchor.set(0.5);
    label.position.set(x, y);
    this.fx.addChild(label);
    void this.tween(900, (t) => {
      label.y = y - 46 * ease(t);
      label.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      if (t >= 1) label.destroy();
    });
  }

  private burst(x: number, y: number, color: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.08 + Math.random() * 0.22;
      this.addParticle(x, y, color, Math.cos(angle) * speed, Math.sin(angle) * speed - 0.08, 0.0004, 500 + Math.random() * 300);
    }
  }

  private bubbles(x: number, color: number) {
    for (let i = 0; i < 14; i++) {
      this.addParticle(x - 30 + Math.random() * 60, FLOOR - 20 - Math.random() * 60, color, 0, -0.05 - Math.random() * 0.08, 0, 700 + Math.random() * 400);
    }
  }

  private spark(x: number, y: number, color: number) {
    this.addParticle(x, y, color, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, 0, 260);
  }

  private addParticle(x: number, y: number, color: number, vx: number, vy: number, gravity: number, ttl: number) {
    const g = new Graphics().circle(0, 0, 2 + Math.random() * 3).fill(color);
    g.position.set(x, y);
    this.fx.addChild(g);
    this.particles.push({ g, vx, vy, gravity, life: 0, ttl });
  }

  private wait(ms: number) {
    return this.tween(ms, () => {});
  }

  private tween(duration: number, step: (t: number) => void): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    return new Promise((resolve) => {
      this.tweens.add({ elapsed: 0, duration, step, done: resolve });
    });
  }

  private tick(deltaMs: number) {
    const dt = Math.min(deltaMs, 50);
    this.time += dt;
    this.fit();

    for (const t of [...this.tweens]) {
      t.elapsed += dt * this.speed;
      const p = Math.min(1, t.elapsed / t.duration);
      t.step(p);
      if (p >= 1) {
        this.tweens.delete(t);
        t.done();
      }
    }

    this.particles = this.particles.filter((p) => {
      p.life += dt;
      p.vy += p.gravity * dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.g.alpha = 1 - p.life / p.ttl;
      if (p.life < p.ttl) return true;
      p.g.destroy();
      return false;
    });

    for (const actor of [this.hero, this.enemy]) {
      if (!actor) continue;
      const bob = actor.floats ? Math.sin(this.time / 420 + actor.phase) * 8 - 16 : Math.sin(this.time / 380 + actor.phase) * 1.5;
      actor.root.position.set(actor.baseX + actor.dx, FLOOR + actor.dy);
      actor.body.y = bob;
    }

    for (const [i, flame] of this.torches.entries()) {
      const flicker = 1 + Math.sin(this.time / 90 + i * 2) * 0.12 + Math.sin(this.time / 37 + i) * 0.06;
      flame.clear().ellipse(0, 0, 8 * flicker, 14 * flicker).fill({ color: 0xff8a3a, alpha: 0.9 }).ellipse(0, 3, 4, 7 * flicker).fill(0xffe0a0);
    }
  }
}
