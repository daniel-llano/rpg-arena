using Microsoft.EntityFrameworkCore;
using RpgArena.Core;

namespace RpgArena.Api.Data;

/// <summary>A run is stored as JSON, with the leaderboard fields copied into columns so they can be indexed.</summary>
public class RunRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TokenHash { get; set; } = "";
    public string HeroName { get; set; } = "";
    public HeroClass HeroClass { get; set; }
    public int Level { get; set; }
    public int Wins { get; set; }
    public int Gold { get; set; }
    public RunStatus Status { get; set; }
    public string State { get; set; } = "";
    public int Version { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class ArenaDbContext(DbContextOptions<ArenaDbContext> options) : DbContext(options)
{
    public DbSet<RunRecord> Runs => Set<RunRecord>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<RunRecord>(e =>
        {
            e.ToTable("Runs");
            e.Property(r => r.TokenHash).HasMaxLength(64).IsRequired();
            e.Property(r => r.HeroName).HasMaxLength(24).IsRequired();
            e.Property(r => r.HeroClass).HasConversion<string>().HasMaxLength(16);
            e.Property(r => r.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(r => r.State).IsRequired();
            e.Property(r => r.Version).IsConcurrencyToken();
            e.HasIndex(r => new { r.Level, r.Wins, r.Gold });
        });
    }
}
