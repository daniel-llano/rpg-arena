namespace RpgArena.Core;

public enum HeroClass
{
    Paladin,
    Ranger,
    Mage
}

public enum Weapon
{
    Sword,
    Bow,
    Staff
}

public enum BattleAction
{
    Attack,
    Defend,
    Special,
    Potion
}

public record ClassInfo(HeroClass Class, string Description, int MaxHp, int Attack, int Defense, int Speed, string Special, string SpecialDescription);

public record WeaponInfo(Weapon Weapon, string Description, int AttackBonus, int SpeedBonus, double SpecialMultiplier);

public record EnemyInfo(string Name, int Tier, int MaxHp, int Attack, int Defense, int Speed, int Xp, int Gold);

public static class Catalog
{
    public const int SpecialCooldown = 3;
    public const int PotionHeal = 40;
    public const int StartingPotions = 2;

    public static readonly IReadOnlyList<ClassInfo> Classes =
    [
        new(HeroClass.Paladin, "Heavy armor and a healing prayer. Hard to kill.", 120, 12, 8, 4,
            "Holy Light", "Heal 35% of your max HP."),
        new(HeroClass.Ranger, "Fast and precise. Lands more critical hits.", 95, 14, 5, 8,
            "Volley", "Shoot twice at 80% damage."),
        new(HeroClass.Mage, "Fragile, but the special hits harder than anything else.", 80, 10, 3, 6,
            "Fireball", "Deal 2.2x damage that ignores armor.")
    ];

    public static readonly IReadOnlyList<WeaponInfo> Weapons =
    [
        new(Weapon.Sword, "+4 attack.", 4, 0, 1.0),
        new(Weapon.Bow, "+2 attack, +3 speed.", 2, 3, 1.0),
        new(Weapon.Staff, "+1 attack, specials are 30% stronger.", 1, 0, 1.3)
    ];

    public static readonly IReadOnlyList<EnemyInfo> Enemies =
    [
        new("Goblin", 1, 45, 9, 2, 5, 30, 10),
        new("Wolf", 1, 55, 10, 3, 9, 35, 12),
        new("Orc", 2, 80, 13, 5, 4, 60, 20),
        new("Skeleton Knight", 2, 70, 14, 7, 5, 65, 22),
        new("Troll", 3, 125, 16, 7, 3, 95, 35),
        new("Wraith", 3, 95, 18, 4, 10, 100, 40),
        new("Dragon", 4, 210, 22, 10, 6, 220, 120)
    ];

    public static ClassInfo For(HeroClass c) => Classes.First(x => x.Class == c);
    public static WeaponInfo For(Weapon w) => Weapons.First(x => x.Weapon == w);
}
