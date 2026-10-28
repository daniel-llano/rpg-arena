namespace RpgArena.Core;

public enum RunStatus
{
    InBattle,
    Victory,
    Defeated
}

public class Hero
{
    public string Name { get; set; } = "";
    public HeroClass Class { get; set; }
    public Weapon Weapon { get; set; }
    public int Level { get; set; } = 1;
    public int Xp { get; set; }
    public int Gold { get; set; }
    public int Potions { get; set; } = Catalog.StartingPotions;
    public int MaxHp { get; set; }
    public int Hp { get; set; }
    public int Attack { get; set; }
    public int Defense { get; set; }
    public int Speed { get; set; }
    public int SpecialCooldown { get; set; }
    public bool Defending { get; set; }

    public int XpToNextLevel => Level * 100;
}

public class Enemy
{
    public string Name { get; set; } = "";
    public int MaxHp { get; set; }
    public int Hp { get; set; }
    public int Attack { get; set; }
    public int Defense { get; set; }
    public int Speed { get; set; }
    public int Xp { get; set; }
    public int Gold { get; set; }
}

/// <summary>One hero's adventure: a chain of battles until the hero falls.</summary>
public class Run
{
    public Hero Hero { get; set; } = new();
    public Enemy Enemy { get; set; } = new();
    public RunStatus Status { get; set; } = RunStatus.InBattle;
    public int Wins { get; set; }
    public int Turn { get; set; }
    public uint DiceState { get; set; }
    public List<string> Log { get; set; } = [];
}
