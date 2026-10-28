namespace RpgArena.Core;

public class GameRuleException(string message) : Exception(message);

/// <summary>All the game rules. Every random roll comes from the run's own dice, so results are reproducible.</summary>
public static class BattleEngine
{
    public const int MaxLogLines = 60;

    public static Run NewRun(string heroName, HeroClass heroClass, Weapon weapon, uint? seed = null)
    {
        var name = heroName.Trim();
        if (name.Length is < 2 or > 24)
            throw new GameRuleException("Hero names are 2 to 24 characters.");

        var c = Catalog.For(heroClass);
        var w = Catalog.For(weapon);
        var dice = seed is { } s ? new Dice(s) : Dice.FromRandomSeed();
        var run = new Run
        {
            Hero = new Hero
            {
                Name = name,
                Class = heroClass,
                Weapon = weapon,
                MaxHp = c.MaxHp,
                Hp = c.MaxHp,
                Attack = c.Attack + w.AttackBonus,
                Defense = c.Defense,
                Speed = c.Speed + w.SpeedBonus
            }
        };
        StartEncounter(run, dice);
        run.DiceState = dice.State;
        return run;
    }

    public static Run Act(Run run, BattleAction action)
    {
        if (run.Status != RunStatus.InBattle)
            throw new GameRuleException(run.Status == RunStatus.Defeated ? "This hero has fallen. Start a new run." : "The battle is won. Move on to the next one.");

        var dice = new Dice(run.DiceState);
        var hero = run.Hero;
        var enemy = run.Enemy;
        run.Turn++;
        hero.Defending = false;

        switch (action)
        {
            case BattleAction.Attack:
                Hit(run, dice, hero.Name, enemy, Roll(dice, hero.Attack), hero.Speed, enemy.Defense);
                break;
            case BattleAction.Defend:
                hero.Defending = true;
                Add(run, $"{hero.Name} raises a guard.");
                break;
            case BattleAction.Special:
                if (hero.SpecialCooldown > 0)
                    throw new GameRuleException($"Your special is ready in {hero.SpecialCooldown} turn(s).");
                UseSpecial(run, dice);
                hero.SpecialCooldown = Catalog.SpecialCooldown + 1;
                break;
            case BattleAction.Potion:
                if (hero.Potions == 0) throw new GameRuleException("You're out of potions.");
                if (hero.Hp == hero.MaxHp) throw new GameRuleException("You're already at full health.");
                hero.Potions--;
                var healed = Heal(hero, Catalog.PotionHeal);
                Add(run, $"{hero.Name} drinks a potion and recovers {healed} HP.");
                break;
            default:
                throw new GameRuleException("Unknown action.");
        }

        if (hero.SpecialCooldown > 0) hero.SpecialCooldown--;

        if (enemy.Hp <= 0)
            Win(run, dice);
        else
            EnemyTurn(run, dice);

        run.DiceState = dice.State;
        return run;
    }

    /// <summary>After a victory, heads into the next fight. The hero keeps HP, potions, and progress.</summary>
    public static Run NextBattle(Run run)
    {
        if (run.Status != RunStatus.Victory)
            throw new GameRuleException("Finish the current battle first.");
        var dice = new Dice(run.DiceState);
        StartEncounter(run, dice);
        run.DiceState = dice.State;
        return run;
    }

    private static void StartEncounter(Run run, Dice dice)
    {
        var level = run.Hero.Level;
        var maxTier = Math.Min(4, 1 + (level - 1) / 2 + (run.Wins >= 3 ? 1 : 0));
        var pool = Catalog.Enemies.Where(e => e.Tier <= maxTier && e.Tier >= Math.Max(1, maxTier - 1)).ToList();
        var pick = pool[dice.Next(0, pool.Count)];
        var scale = 1 + 0.08 * (level - 1);

        run.Enemy = new Enemy
        {
            Name = pick.Name,
            MaxHp = (int)(pick.MaxHp * scale),
            Hp = (int)(pick.MaxHp * scale),
            Attack = (int)(pick.Attack * scale),
            Defense = pick.Defense + (level - 1) / 3,
            Speed = pick.Speed,
            Xp = (int)(pick.Xp * scale),
            Gold = (int)(pick.Gold * scale)
        };
        run.Status = RunStatus.InBattle;
        run.Turn = 0;
        run.Hero.SpecialCooldown = 0;
        run.Hero.Defending = false;
        Add(run, $"A {run.Enemy.Name} appears with {run.Enemy.Hp} HP.");
    }

    private static void UseSpecial(Run run, Dice dice)
    {
        var hero = run.Hero;
        var boost = Catalog.For(hero.Weapon).SpecialMultiplier;
        switch (hero.Class)
        {
            case HeroClass.Paladin:
                var healed = Heal(hero, (int)(hero.MaxHp * 0.35 * boost));
                Add(run, $"{hero.Name} calls down Holy Light and recovers {healed} HP.");
                break;
            case HeroClass.Ranger:
                Add(run, $"{hero.Name} looses a Volley.");
                for (var i = 0; i < 2 && run.Enemy.Hp > 0; i++)
                    Hit(run, dice, hero.Name, run.Enemy, Roll(dice, hero.Attack * 0.8 * boost), hero.Speed, run.Enemy.Defense);
                break;
            case HeroClass.Mage:
                var damage = Math.Max(1, (int)Math.Round(Roll(dice, hero.Attack * 2.2 * boost)));
                run.Enemy.Hp = Math.Max(0, run.Enemy.Hp - damage);
                Add(run, $"{hero.Name} hurls a Fireball for {damage} damage.");
                break;
        }
    }

    private static void EnemyTurn(Run run, Dice dice)
    {
        var hero = run.Hero;
        var enemy = run.Enemy;
        var raw = Roll(dice, enemy.Attack);
        if (hero.Defending) raw /= 2;
        Hit(run, dice, enemy.Name, null, raw, enemy.Speed, hero.Defense);

        if (hero.Hp <= 0)
        {
            run.Status = RunStatus.Defeated;
            Add(run, $"{hero.Name} has fallen after {run.Wins} win(s).");
        }
    }

    private static void Win(Run run, Dice dice)
    {
        var hero = run.Hero;
        var enemy = run.Enemy;
        run.Wins++;
        run.Status = RunStatus.Victory;
        hero.Gold += enemy.Gold;
        hero.Xp += enemy.Xp;
        Add(run, $"The {enemy.Name} is defeated. +{enemy.Xp} XP, +{enemy.Gold} gold.");

        if (dice.Chance(0.35))
        {
            hero.Potions++;
            Add(run, "You find a potion.");
        }

        while (hero.Xp >= hero.XpToNextLevel)
        {
            hero.Xp -= hero.XpToNextLevel;
            hero.Level++;
            hero.MaxHp += 12;
            hero.Attack += 2;
            hero.Defense += 1;
            hero.Hp = hero.MaxHp;
            Add(run, $"Level up! {hero.Name} is now level {hero.Level} and fully healed.");
        }
    }

    // Damage lands for the rolled amount minus half the target's defense. Speed adds crit chance.
    private static void Hit(Run run, Dice dice, string attacker, Enemy? target, double raw, int speed, int defense)
    {
        var crit = dice.Chance(0.05 + speed / 100.0);
        var damage = Math.Max(1, (int)Math.Round((crit ? raw * 1.6 : raw) - defense / 2.0));
        if (target is null)
        {
            run.Hero.Hp = Math.Max(0, run.Hero.Hp - damage);
            Add(run, $"The {attacker} hits {run.Hero.Name} for {damage}{(crit ? " (critical)" : "")}.");
        }
        else
        {
            target.Hp = Math.Max(0, target.Hp - damage);
            Add(run, $"{attacker} hits the {target.Name} for {damage}{(crit ? " (critical)" : "")}.");
        }
    }

    private static double Roll(Dice dice, double baseDamage) => baseDamage * (0.85 + dice.NextDouble() * 0.3);

    private static int Heal(Hero hero, int amount)
    {
        var before = hero.Hp;
        hero.Hp = Math.Min(hero.MaxHp, hero.Hp + amount);
        return hero.Hp - before;
    }

    private static void Add(Run run, string line)
    {
        run.Log.Add(line);
        if (run.Log.Count > MaxLogLines)
            run.Log.RemoveRange(0, run.Log.Count - MaxLogLines);
    }
}
