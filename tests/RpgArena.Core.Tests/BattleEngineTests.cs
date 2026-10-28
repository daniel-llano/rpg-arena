using FluentAssertions;

namespace RpgArena.Core.Tests;

public class BattleEngineTests
{
    private static Run Fresh(HeroClass c = HeroClass.Paladin, Weapon w = Weapon.Sword, uint seed = 42) =>
        BattleEngine.NewRun("Aria", c, w, seed);

    private static Run FightUntilDone(Run run, BattleAction action = BattleAction.Attack)
    {
        for (var i = 0; i < 200 && run.Status == RunStatus.InBattle; i++)
            run = BattleEngine.Act(run, action);
        return run;
    }

    [Theory]
    [InlineData(HeroClass.Paladin, Weapon.Sword, 120, 16)]
    [InlineData(HeroClass.Ranger, Weapon.Bow, 95, 16)]
    [InlineData(HeroClass.Mage, Weapon.Staff, 80, 11)]
    public void NewRun_AppliesClassAndWeaponStats(HeroClass c, Weapon w, int hp, int attack)
    {
        var run = Fresh(c, w);

        run.Hero.MaxHp.Should().Be(hp);
        run.Hero.Hp.Should().Be(hp);
        run.Hero.Attack.Should().Be(attack);
        run.Hero.Potions.Should().Be(Catalog.StartingPotions);
        run.Enemy.Hp.Should().BeGreaterThan(0);
        run.Status.Should().Be(RunStatus.InBattle);
    }

    [Theory]
    [InlineData("")]
    [InlineData("A")]
    [InlineData("This name is far too long to fit")]
    public void NewRun_RejectsBadNames(string name)
    {
        var act = () => BattleEngine.NewRun(name, HeroClass.Mage, Weapon.Staff);
        act.Should().Throw<GameRuleException>();
    }

    [Fact]
    public void SameSeed_PlaysOutTheSameWay()
    {
        var a = FightUntilDone(Fresh(seed: 7));
        var b = FightUntilDone(Fresh(seed: 7));

        a.Log.Should().Equal(b.Log);
        a.Status.Should().Be(b.Status);
    }

    [Fact]
    public void Attack_DamagesTheEnemy()
    {
        var run = Fresh();
        var before = run.Enemy.Hp;

        run = BattleEngine.Act(run, BattleAction.Attack);

        run.Enemy.Hp.Should().BeLessThan(before);
        run.Turn.Should().Be(1);
    }

    [Fact]
    public void Defend_RoughlyHalvesIncomingDamage()
    {
        double Taken(BattleAction action) => Enumerable.Range(1, 200)
            .Select(seed => { var r = Fresh(seed: (uint)seed); var before = r.Hero.Hp; return before - BattleEngine.Act(r, action).Hero.Hp; })
            .Average();

        Taken(BattleAction.Defend).Should().BeLessThan(Taken(BattleAction.Attack) * 0.7);
    }

    [Fact]
    public void Special_GoesOnCooldown()
    {
        var run = BattleEngine.Act(Fresh(HeroClass.Mage, Weapon.Staff), BattleAction.Special);

        run.Hero.SpecialCooldown.Should().Be(Catalog.SpecialCooldown);
        var again = () => BattleEngine.Act(run, BattleAction.Special);
        again.Should().Throw<GameRuleException>().WithMessage("*ready in*");
    }

    [Fact]
    public void Potion_HealsAndIsConsumed()
    {
        var run = Fresh();
        run.Hero.Hp = 30;

        run = BattleEngine.Act(run, BattleAction.Potion);

        run.Hero.Potions.Should().Be(Catalog.StartingPotions - 1);
        run.Log.Should().Contain(l => l.Contains("recovers 40 HP"));
    }

    [Fact]
    public void Potion_AtFullHealth_IsRefused()
    {
        var act = () => BattleEngine.Act(Fresh(), BattleAction.Potion);
        act.Should().Throw<GameRuleException>();
    }

    [Fact]
    public void Victory_GrantsRewards_AndNextBattleStartsAFreshEnemy()
    {
        var run = Fresh();
        run.Enemy.Hp = 1;

        run = BattleEngine.Act(run, BattleAction.Attack);

        run.Status.Should().Be(RunStatus.Victory);
        run.Wins.Should().Be(1);
        run.Hero.Gold.Should().BeGreaterThan(0);
        run.Hero.Xp.Should().BeGreaterThan(0);

        var act = () => BattleEngine.Act(run, BattleAction.Attack);
        act.Should().Throw<GameRuleException>();

        run = BattleEngine.NextBattle(run);
        run.Status.Should().Be(RunStatus.InBattle);
        run.Enemy.Hp.Should().Be(run.Enemy.MaxHp);
    }

    [Fact]
    public void EnoughXp_LevelsUpAndHeals()
    {
        var run = Fresh();
        run.Hero.Xp = 99;
        run.Hero.Hp = 10;
        run.Enemy.Hp = 1;

        run = BattleEngine.Act(run, BattleAction.Attack);

        run.Hero.Level.Should().Be(2);
        run.Hero.MaxHp.Should().Be(132);
        run.Hero.Hp.Should().Be(run.Hero.MaxHp);
    }

    [Fact]
    public void HeroAtZeroHp_IsDefeated_AndCantAct()
    {
        var run = Fresh();
        run.Hero.Hp = 1;
        run.Enemy.Hp = 9999;

        run = BattleEngine.Act(run, BattleAction.Attack);

        run.Status.Should().Be(RunStatus.Defeated);
        var act = () => BattleEngine.Act(run, BattleAction.Attack);
        act.Should().Throw<GameRuleException>().WithMessage("*fallen*");
    }

    [Fact]
    public void Log_IsCapped()
    {
        var run = Fresh();
        run.Enemy.Hp = 100_000;
        run.Hero.Hp = 100_000;
        run.Hero.MaxHp = 100_000;

        for (var i = 0; i < 100; i++)
            run = BattleEngine.Act(run, BattleAction.Defend);

        run.Log.Count.Should().BeLessThanOrEqualTo(BattleEngine.MaxLogLines);
    }

    [Fact]
    public void Dice_StaysInRange()
    {
        var dice = new Dice(123);
        for (var i = 0; i < 10_000; i++)
            dice.Next(2, 5).Should().BeInRange(2, 4);
    }
}
