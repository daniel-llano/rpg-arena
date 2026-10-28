using RpgArena.Core;

Console.WriteLine("RPG Arena. Fight until your hero falls.\n");

var name = Ask("Hero name", s => s.Trim().Length is >= 2 and <= 24, "Pick 2 to 24 characters.");
var heroClass = Choose("Class", Catalog.Classes.Select(c => ($"{c.Class}: {c.Description} Special: {c.Special}, {c.SpecialDescription}", c.Class)).ToList());
var weapon = Choose("Weapon", Catalog.Weapons.Select(w => ($"{w.Weapon}: {w.Description}", w.Weapon)).ToList());

var run = BattleEngine.NewRun(name, heroClass, weapon);
var printed = 0;

while (true)
{
    for (; printed < run.Log.Count; printed++)
        Console.WriteLine($"  {run.Log[printed]}");

    var h = run.Hero;
    var e = run.Enemy;

    if (run.Status == RunStatus.Defeated)
    {
        Console.WriteLine($"\nGame over. {h.Name} reached level {h.Level} with {run.Wins} win(s) and {h.Gold} gold.");
        break;
    }

    if (run.Status == RunStatus.Victory)
    {
        Console.Write("\nNext battle? [Y/n] ");
        if ((Console.ReadLine() ?? "").Trim().StartsWith('n')) break;
        run = BattleEngine.NextBattle(run);
        printed = run.Log.Count - 1;
        continue;
    }

    Console.WriteLine($"\n{h.Name} L{h.Level}  HP {h.Hp}/{h.MaxHp}  Potions {h.Potions}   vs   {e.Name}  HP {e.Hp}/{e.MaxHp}");
    var special = h.SpecialCooldown == 0 ? "3) Special" : $"3) Special (ready in {h.SpecialCooldown})";
    Console.Write($"1) Attack  2) Defend  {special}  4) Potion  > ");

    var action = Console.ReadLine()?.Trim() switch
    {
        "1" => BattleAction.Attack,
        "2" => BattleAction.Defend,
        "3" => BattleAction.Special,
        "4" => BattleAction.Potion,
        _ => (BattleAction?)null
    };
    if (action is null)
    {
        Console.WriteLine("Type 1, 2, 3, or 4.");
        continue;
    }

    try
    {
        run = BattleEngine.Act(run, action.Value);
    }
    catch (GameRuleException ex)
    {
        Console.WriteLine(ex.Message);
    }
}

static string Ask(string prompt, Func<string, bool> valid, string error)
{
    while (true)
    {
        Console.Write($"{prompt}: ");
        var value = Console.ReadLine() ?? "";
        if (valid(value)) return value.Trim();
        Console.WriteLine(error);
    }
}

static T Choose<T>(string prompt, List<(string Label, T Value)> options)
{
    Console.WriteLine($"\n{prompt}:");
    for (var i = 0; i < options.Count; i++)
        Console.WriteLine($"  {i + 1}) {options[i].Label}");
    var pick = Ask("Choose", s => int.TryParse(s, out var n) && n >= 1 && n <= options.Count, $"Type a number from 1 to {options.Count}.");
    return options[int.Parse(pick) - 1].Value;
}
