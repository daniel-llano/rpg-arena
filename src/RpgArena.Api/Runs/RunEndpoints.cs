using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RpgArena.Api.Data;
using RpgArena.Core;

namespace RpgArena.Api.Runs;

public record StartRunRequest([property: Required, StringLength(24, MinimumLength = 2)] string HeroName, HeroClass HeroClass, Weapon Weapon);

public record ActionRequest(BattleAction Action);

public record RunView(Guid Id, RunStatus Status, int Wins, int Turn, Hero Hero, Enemy Enemy, IReadOnlyList<string> Log, DateTime UpdatedAt);

public record StartRunResponse(RunView Run, string Token);

public record LeaderboardEntry(Guid Id, string HeroName, HeroClass HeroClass, int Level, int Wins, int Gold, RunStatus Status);

public record CatalogView(IReadOnlyList<ClassInfo> Classes, IReadOnlyList<WeaponInfo> Weapons);

public class BattleHub : Hub
{
    /// <summary>Spectators join a run's group to get every new state.</summary>
    public Task Watch(Guid runId) => Groups.AddToGroupAsync(Context.ConnectionId, runId.ToString());
}

public static class RunEndpoints
{
    public static readonly JsonSerializerOptions StateJson = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    public static void MapRuns(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/catalog", () => new CatalogView(Catalog.Classes, Catalog.Weapons)).WithTags("Game");
        app.MapGet("/api/leaderboard", LeaderboardAsync).WithTags("Game");

        var g = app.MapGroup("/api/runs").WithTags("Runs");
        g.MapPost("/", StartAsync).RequireRateLimiting("start");
        g.MapGet("/{id:guid}", GetAsync);
        g.MapPost("/{id:guid}/actions", ActAsync).RequireRateLimiting("actions");
        g.MapPost("/{id:guid}/next", NextAsync).RequireRateLimiting("actions");
    }

    private static async Task<Created<StartRunResponse>> StartAsync(
        StartRunRequest req, ArenaDbContext db, IHubContext<BattleHub> hub, CancellationToken ct)
    {
        var run = BattleEngine.NewRun(req.HeroName, req.HeroClass, req.Weapon);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var record = new RunRecord { TokenHash = Hash(token), HeroClass = run.Hero.Class };
        Apply(record, run);
        db.Runs.Add(record);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/api/runs/{record.Id}", new StartRunResponse(View(record, run), token));
    }

    private static async Task<Results<Ok<RunView>, NotFound>> GetAsync(Guid id, ArenaDbContext db, CancellationToken ct)
    {
        var record = await db.Runs.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct);
        return record is null ? TypedResults.NotFound() : TypedResults.Ok(View(record, Load(record)));
    }

    private static Task<Results<Ok<RunView>, NotFound, ProblemHttpResult>> ActAsync(
        Guid id, ActionRequest req, HttpContext http, ArenaDbContext db, IHubContext<BattleHub> hub, CancellationToken ct) =>
        MutateAsync(id, http, db, hub, run => BattleEngine.Act(run, req.Action), ct);

    private static Task<Results<Ok<RunView>, NotFound, ProblemHttpResult>> NextAsync(
        Guid id, HttpContext http, ArenaDbContext db, IHubContext<BattleHub> hub, CancellationToken ct) =>
        MutateAsync(id, http, db, hub, BattleEngine.NextBattle, ct);

    private static async Task<Results<Ok<RunView>, NotFound, ProblemHttpResult>> MutateAsync(
        Guid id, HttpContext http, ArenaDbContext db, IHubContext<BattleHub> hub, Func<Run, Run> change, CancellationToken ct)
    {
        var record = await db.Runs.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (record is null) return TypedResults.NotFound();

        var token = http.Request.Headers["X-Run-Token"].FirstOrDefault() ?? "";
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Hash(token)), Encoding.ASCII.GetBytes(record.TokenHash)))
            return TypedResults.Problem("Only the player who started this run can act in it.", statusCode: 403, title: "Wrong run token");

        Run run;
        try
        {
            run = change(Load(record));
        }
        catch (GameRuleException ex)
        {
            return TypedResults.Problem(ex.Message, statusCode: 422, title: "Can't do that right now");
        }

        Apply(record, run);
        record.Version++;
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return TypedResults.Problem("Another action landed first. Reload the battle.", statusCode: 409, title: "Out of date");
        }

        var view = View(record, run);
        await hub.Clients.Group(id.ToString()).SendAsync("state", view, ct);
        return TypedResults.Ok(view);
    }

    private static async Task<Ok<List<LeaderboardEntry>>> LeaderboardAsync(ArenaDbContext db, int top = 10, CancellationToken ct = default)
    {
        var list = await db.Runs.AsNoTracking()
            .OrderByDescending(r => r.Level).ThenByDescending(r => r.Wins).ThenByDescending(r => r.Gold).ThenBy(r => r.CreatedAt)
            .Take(Math.Clamp(top, 1, 50))
            .Select(r => new LeaderboardEntry(r.Id, r.HeroName, r.HeroClass, r.Level, r.Wins, r.Gold, r.Status))
            .ToListAsync(ct);
        return TypedResults.Ok(list);
    }

    private static Run Load(RunRecord record) => JsonSerializer.Deserialize<Run>(record.State, StateJson)!;

    private static void Apply(RunRecord record, Run run)
    {
        record.HeroName = run.Hero.Name;
        record.Level = run.Hero.Level;
        record.Wins = run.Wins;
        record.Gold = run.Hero.Gold;
        record.Status = run.Status;
        record.State = JsonSerializer.Serialize(run, StateJson);
        record.UpdatedAt = DateTime.UtcNow;
    }

    private static RunView View(RunRecord record, Run run) =>
        new(record.Id, run.Status, run.Wins, run.Turn, run.Hero, run.Enemy, run.Log, record.UpdatedAt);

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
