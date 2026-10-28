namespace RpgArena.Core;

/// <summary>
/// xorshift32. The whole state is one uint saved with the run, so a battle replays the same way from the same seed.
/// </summary>
public sealed class Dice(uint state)
{
    public uint State { get; private set; } = state == 0 ? 0x9E3779B9u : state;

    public static Dice FromRandomSeed() => new((uint)Random.Shared.Next(1, int.MaxValue));

    public uint NextUInt()
    {
        var x = State;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        State = x;
        return x;
    }

    /// <summary>Uniform double in [0, 1).</summary>
    public double NextDouble() => NextUInt() / 4294967296.0;

    /// <summary>Uniform int in [min, max).</summary>
    public int Next(int min, int max) => min + (int)(NextDouble() * (max - min));

    public bool Chance(double probability) => NextDouble() < probability;
}
