using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using RpgArena.Api.Runs;
using RpgArena.Core;

namespace RpgArena.Api.Tests;

public sealed class ArenaFactory : WebApplicationFactory<Program>
{
    private readonly string _db = Path.Combine(Path.GetTempPath(), $"arena-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Arena", $"Data Source={_db};Pooling=False");
        builder.UseSetting("RateLimiting:StartsPerMinute", "10000");
        builder.UseSetting("RateLimiting:ActionsPerMinute", "100000");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try { File.Delete(_db); } catch (IOException) { }
    }
}

public class RunTests(ArenaFactory factory) : IClassFixture<ArenaFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    private readonly HttpClient _client = factory.CreateClient();

    private async Task<StartRunResponse> StartAsync(string name = "Aria", HeroClass c = HeroClass.Paladin, Weapon w = Weapon.Sword)
    {
        var resp = await _client.PostAsJsonAsync("/api/runs", new StartRunRequest(name, c, w), Json);
        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await resp.Content.ReadFromJsonAsync<StartRunResponse>(Json))!;
    }

    private Task<HttpResponseMessage> ActAsync(Guid id, string? token, BattleAction action)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"/api/runs/{id}/actions") { Content = JsonContent.Create(new ActionRequest(action), options: Json) };
        if (token is not null) req.Headers.Add("X-Run-Token", token);
        return _client.SendAsync(req);
    }

    [Fact]
    public async Task Catalog_ListsClassesAndWeapons()
    {
        var catalog = await _client.GetFromJsonAsync<CatalogView>("/api/catalog", Json);

        catalog!.Classes.Select(c => c.Class).Should().Equal(HeroClass.Paladin, HeroClass.Ranger, HeroClass.Mage);
        catalog.Weapons.Should().HaveCount(3);
    }

    [Fact]
    public async Task Start_ReturnsRunAndToken()
    {
        var started = await StartAsync("Brom", HeroClass.Ranger, Weapon.Bow);

        started.Token.Should().HaveLength(32);
        started.Run.Hero.Name.Should().Be("Brom");
        started.Run.Status.Should().Be(RunStatus.InBattle);
        started.Run.Log.Should().ContainSingle(l => l.Contains("appears"));
    }

    [Fact]
    public async Task Start_InvalidName_Returns400()
    {
        var resp = await _client.PostAsJsonAsync("/api/runs", new StartRunRequest("X", HeroClass.Mage, Weapon.Staff), Json);
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Act_WithToken_AdvancesTheBattle()
    {
        var started = await StartAsync();

        var resp = await ActAsync(started.Run.Id, started.Token, BattleAction.Attack);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var run = await resp.Content.ReadFromJsonAsync<RunView>(Json);
        run!.Turn.Should().Be(1);
        run.Enemy.Hp.Should().BeLessThan(started.Run.Enemy.Hp);
    }

    [Fact]
    public async Task Act_WithoutTheToken_Returns403()
    {
        var started = await StartAsync();

        (await ActAsync(started.Run.Id, null, BattleAction.Attack)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ActAsync(started.Run.Id, "deadbeef", BattleAction.Attack)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Act_BreakingAGameRule_Returns422()
    {
        var started = await StartAsync();

        var resp = await ActAsync(started.Run.Id, started.Token, BattleAction.Potion);

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Next_BeforeWinning_Returns422()
    {
        var started = await StartAsync();
        var req = new HttpRequestMessage(HttpMethod.Post, $"/api/runs/{started.Run.Id}/next") { Headers = { { "X-Run-Token", started.Token } } };

        (await _client.SendAsync(req)).StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task FullBattle_EndsAndShowsOnLeaderboard()
    {
        var name = "Hero" + Guid.NewGuid().ToString("N")[..6];
        var started = await StartAsync(name);
        RunView run = started.Run;
        for (var i = 0; i < 100 && run.Status == RunStatus.InBattle; i++)
        {
            var action = run.Hero.Hp < 40 && run.Hero.Potions > 0 ? BattleAction.Potion : BattleAction.Attack;
            run = (await (await ActAsync(run.Id, started.Token, action)).Content.ReadFromJsonAsync<RunView>(Json))!;
        }

        run.Status.Should().BeOneOf(RunStatus.Victory, RunStatus.Defeated);
        var board = await _client.GetFromJsonAsync<List<LeaderboardEntry>>("/api/leaderboard?top=50", Json);
        board.Should().Contain(e => e.HeroName == name && e.Wins == run.Wins);
    }

    [Fact]
    public async Task Spectators_ReceiveEveryNewState()
    {
        var started = await StartAsync();
        var server = factory.Server;
        await using var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(server.BaseAddress, "/hubs/battle"), o => o.HttpMessageHandlerFactory = _ => server.CreateHandler())
            .AddJsonProtocol(o => o.PayloadSerializerOptions = Json)
            .Build();
        var received = new TaskCompletionSource<RunView>();
        connection.On<RunView>("state", view => received.TrySetResult(view));
        await connection.StartAsync();
        await connection.InvokeAsync("Watch", started.Run.Id);

        await ActAsync(started.Run.Id, started.Token, BattleAction.Defend);

        var pushed = await received.Task.WaitAsync(TimeSpan.FromSeconds(5));
        pushed.Id.Should().Be(started.Run.Id);
        pushed.Turn.Should().Be(1);
    }

    [Fact]
    public async Task UnknownRun_Returns404()
    {
        (await _client.GetAsync($"/api/runs/{Guid.NewGuid()}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData("/health/live")]
    [InlineData("/health/ready")]
    public async Task Health_Returns200(string path)
    {
        (await _client.GetAsync(path)).StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
