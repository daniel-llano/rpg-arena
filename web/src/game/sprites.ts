import { Container, Graphics } from "pixi.js";
import type { HeroClass, Weapon } from "@/api/types";

// Everything is drawn with vector shapes, so there are no image assets to load or license.
// Sprites stand on (0, 0) with their feet on the floor; heroes face right, enemies face left.

const skin = 0xf0c9a0;
const outline = { width: 2, color: 0x120f0c, alpha: 0.55 };

const classColors: Record<HeroClass, { body: number; trim: number }> = {
  Paladin: { body: 0x9fb4d0, trim: 0xd9b45a },
  Ranger: { body: 0x4f8a4b, trim: 0x8a6a3f },
  Mage: { body: 0x6b4fa0, trim: 0x46c0d8 },
};

function weaponArt(weapon: Weapon): Graphics {
  const g = new Graphics();
  switch (weapon) {
    case "Sword":
      g.moveTo(0, 0).lineTo(30, -34).stroke({ width: 5, color: 0xdfe6ee, cap: "round" });
      g.moveTo(-6, -6).lineTo(6, 6).stroke({ width: 4, color: 0xd9b45a, cap: "round" });
      g.moveTo(0, 0).lineTo(-5, 6).stroke({ width: 4, color: 0x5a3d24, cap: "round" });
      break;
    case "Bow":
      g.arc(0, 0, 28, -Math.PI / 2.2, Math.PI / 2.2).stroke({ width: 4, color: 0x8a5a2b, cap: "round" });
      g.moveTo(Math.cos(-Math.PI / 2.2) * 28, Math.sin(-Math.PI / 2.2) * 28)
        .lineTo(Math.cos(Math.PI / 2.2) * 28, Math.sin(Math.PI / 2.2) * 28)
        .stroke({ width: 1.5, color: 0xf4efe6 });
      break;
    case "Staff":
      g.moveTo(0, 30).lineTo(6, -48).stroke({ width: 5, color: 0x6e4a2a, cap: "round" });
      g.circle(6, -54, 9).fill({ color: 0x46c0d8, alpha: 0.35 });
      g.circle(6, -54, 5).fill(0x9ff2ff);
      break;
  }
  return g;
}

export function heroSprite(heroClass: HeroClass, weapon: Weapon): Container {
  const { body, trim } = classColors[heroClass];
  const root = new Container();
  const g = new Graphics();

  // Legs and boots.
  g.roundRect(-14, -34, 10, 34, 4).fill(0x3b3128);
  g.roundRect(4, -34, 10, 34, 4).fill(0x3b3128);

  if (heroClass === "Mage") {
    g.poly([-24, -6, 24, -6, 14, -78, -14, -78]).fill(body).stroke(outline);
    g.rect(-24, -14, 48, 6).fill(trim);
  } else {
    g.roundRect(-20, -82, 40, 52, 10).fill(body).stroke(outline);
    g.rect(-20, -42, 40, 6).fill(trim);
    if (heroClass === "Paladin") g.poly([0, -76, 7, -64, 0, -52, -7, -64]).fill(trim);
  }

  // Head and headgear.
  g.circle(0, -96, 15).fill(skin).stroke(outline);
  g.circle(6, -98, 2.2).fill(0x1d1712);
  if (heroClass === "Paladin") {
    g.roundRect(-17, -116, 34, 18, 7).fill(0xc9d4e2).stroke(outline);
    g.rect(2, -104, 14, 3).fill(0x1d1712);
  } else if (heroClass === "Ranger") {
    g.poly([-18, -92, -12, -116, 6, -114, 16, -102, 10, -108, -6, -106]).fill(body).stroke(outline);
  } else {
    g.poly([-22, -106, 22, -106, 4, -146]).fill(body).stroke(outline);
    g.rect(-22, -108, 44, 5).fill(trim);
  }
  root.addChild(g);

  const held = weaponArt(weapon);
  held.position.set(weapon === "Bow" ? 26 : 22, weapon === "Staff" ? -56 : -52);
  root.addChild(held);
  return root;
}

interface Humanoid {
  body: number;
  head: number;
  eyes: number;
  width: number;
  height: number;
}

function humanoid(g: Graphics, h: Humanoid) {
  const w = h.width;
  const top = -h.height;
  g.roundRect(-w / 2 + 4, -h.height * 0.36, w * 0.26, h.height * 0.36, 5).fill(0x2f2a24);
  g.roundRect(w / 2 - 4 - w * 0.26, -h.height * 0.36, w * 0.26, h.height * 0.36, 5).fill(0x2f2a24);
  g.roundRect(-w / 2, top + h.height * 0.3, w, h.height * 0.42, 12).fill(h.body).stroke(outline);
  g.circle(0, top + h.height * 0.17, h.height * 0.17).fill(h.head).stroke(outline);
  g.circle(-h.height * 0.07, top + h.height * 0.15, 3).fill(h.eyes);
  g.circle(-h.height * 0.15, top + h.height * 0.15, 3).fill(h.eyes);
}

export interface EnemyArt {
  root: Container;
  floats: boolean;
}

export function enemySprite(name: string): EnemyArt {
  const root = new Container();
  const g = new Graphics();
  let floats = false;

  switch (name) {
    case "Goblin":
      humanoid(g, { body: 0x6f9e3c, head: 0x7fb04a, eyes: 0xff4b3a, width: 34, height: 90 });
      g.poly([-14, -82, -34, -92, -12, -72]).fill(0x7fb04a);
      g.poly([12, -82, 30, -94, 14, -72]).fill(0x7fb04a);
      g.moveTo(-18, -40).lineTo(-40, -58).stroke({ width: 4, color: 0x9aa3ad, cap: "round" });
      break;
    case "Wolf":
      g.ellipse(6, -44, 44, 20).fill(0x7d7f86).stroke(outline);
      for (const x of [-26, -12, 18, 34]) g.roundRect(x, -32, 8, 32, 3).fill(0x5f6168);
      g.circle(-40, -62, 18).fill(0x8a8c93).stroke(outline);
      g.poly([-56, -60, -74, -54, -56, -48]).fill(0x8a8c93);
      g.poly([-46, -78, -40, -96, -32, -76]).fill(0x5f6168);
      g.circle(-46, -66, 3).fill(0xffd34a);
      g.moveTo(48, -50).quadraticCurveTo(70, -60, 72, -80).stroke({ width: 7, color: 0x7d7f86, cap: "round" });
      break;
    case "Orc":
      humanoid(g, { body: 0x4f7a3a, head: 0x5d8a45, eyes: 0xffd34a, width: 52, height: 124 });
      g.poly([-14, -94, -10, -86, -6, -94]).fill(0xf4efe6);
      g.poly([-26, -94, -22, -86, -18, -94]).fill(0xf4efe6);
      g.moveTo(-28, -50).lineTo(-56, -92).stroke({ width: 5, color: 0x6e4a2a, cap: "round" });
      g.poly([-56, -92, -76, -100, -70, -76]).fill(0xb9c2cc);
      break;
    case "Skeleton Knight":
      humanoid(g, { body: 0x4a4f58, head: 0xe8e2d0, eyes: 0x46c0d8, width: 42, height: 118 });
      for (let i = 0; i < 3; i++) g.rect(-14, -70 + i * 10, 28, 3).fill(0xe8e2d0);
      g.roundRect(-30, -108, 40, 14, 5).fill(0x6c727c);
      g.ellipse(-30, -56, 14, 22).fill(0x6c727c).stroke(outline);
      g.moveTo(20, -50).lineTo(44, -100).stroke({ width: 5, color: 0xdfe6ee, cap: "round" });
      break;
    case "Troll":
      humanoid(g, { body: 0x6f7f63, head: 0x7f8f72, eyes: 0xff6a3a, width: 74, height: 150 });
      g.moveTo(-36, -60).lineTo(-70, -120).stroke({ width: 12, color: 0x6e4a2a, cap: "round" });
      g.circle(-72, -124, 14).fill(0x5a3d24);
      break;
    case "Wraith":
      floats = true;
      g.poly([-30, -20, -36, -110, 0, -140, 30, -110, 26, -20, 14, -34, 4, -16, -8, -34, -18, -16]).fill({ color: 0x8a6fc0, alpha: 0.82 });
      g.ellipse(-4, -106, 18, 20).fill({ color: 0x2a1d3d, alpha: 0.9 });
      g.circle(-12, -108, 4).fill(0x9ff2ff);
      g.circle(2, -108, 4).fill(0x9ff2ff);
      break;
    case "Dragon":
      g.poly([10, -90, 60, -170, 90, -100, 70, -96]).fill(0x8a2a1f).stroke(outline);
      g.ellipse(18, -66, 62, 36).fill(0xb33a2a).stroke(outline);
      for (const x of [-26, -4, 30, 52]) g.roundRect(x, -40, 14, 40, 5).fill(0x8a2a1f);
      g.moveTo(-26, -86).quadraticCurveTo(-46, -130, -66, -132).stroke({ width: 20, color: 0xb33a2a, cap: "round" });
      g.ellipse(-80, -132, 26, 16).fill(0xc44a36).stroke(outline);
      g.poly([-70, -146, -60, -170, -56, -144]).fill(0xe8e2d0);
      g.circle(-88, -136, 4).fill(0xffd34a);
      g.moveTo(78, -60).quadraticCurveTo(120, -40, 132, -86).stroke({ width: 12, color: 0xb33a2a, cap: "round" });
      break;
    default:
      g.ellipse(0, -40, 36, 40).fill(0x8a7f6a).stroke(outline);
      g.circle(-12, -50, 4).fill(0xff4b3a);
      g.circle(6, -50, 4).fill(0xff4b3a);
  }
  root.addChild(g);
  return { root, floats };
}

export function shieldArt(): Graphics {
  return new Graphics()
    .ellipse(0, -70, 52, 84)
    .fill({ color: 0x5fa8ff, alpha: 0.12 })
    .ellipse(0, -70, 52, 84)
    .stroke({ width: 3, color: 0x8cc4ff, alpha: 0.8 });
}
