export type HeroClass = "Paladin" | "Ranger" | "Mage";
export type Weapon = "Sword" | "Bow" | "Staff";
export type BattleAction = "Attack" | "Defend" | "Special" | "Potion";
export type RunStatus = "InBattle" | "Victory" | "Defeated";

export interface Hero {
  name: string;
  class: HeroClass;
  weapon: Weapon;
  level: number;
  xp: number;
  gold: number;
  potions: number;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  specialCooldown: number;
  defending: boolean;
  xpToNextLevel: number;
}

export interface Enemy {
  name: string;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  xp: number;
  gold: number;
}

export interface RunView {
  id: string;
  status: RunStatus;
  wins: number;
  turn: number;
  hero: Hero;
  enemy: Enemy;
  log: string[];
  updatedAt: string;
}

export interface StartRunResponse {
  run: RunView;
  token: string;
}

export interface LeaderboardEntry {
  id: string;
  heroName: string;
  heroClass: HeroClass;
  level: number;
  wins: number;
  gold: number;
  status: RunStatus;
}

export interface ClassInfo {
  class: HeroClass;
  description: string;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  special: string;
  specialDescription: string;
}

export interface WeaponInfo {
  weapon: Weapon;
  description: string;
  attackBonus: number;
  speedBonus: number;
  specialMultiplier: number;
}

export interface Catalog {
  classes: ClassInfo[];
  weapons: WeaponInfo[];
}
