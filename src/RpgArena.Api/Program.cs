using System.Net;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using RpgArena.Api.Data;
using RpgArena.Api.Runs;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

builder.Services.AddDbContext<ArenaDbContext>(o => o.UseSqlite(config.GetConnectionString("Arena") ?? "Data Source=arena.db"));
builder.Services.AddSignalR().AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddValidation();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks().AddDbContextCheck<ArenaDbContext>("database", HealthStatus.Unhealthy, ["ready"]);

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    RateLimitPartition<string> PerIp(HttpContext http, int permits) => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { Window = TimeSpan.FromMinutes(1), PermitLimit = permits });
    o.AddPolicy("start", http => PerIp(http, config.GetValue("RateLimiting:StartsPerMinute", 20)));
    o.AddPolicy("actions", http => PerIp(http, config.GetValue("RateLimiting:ActionsPerMinute", 240)));
});

// X-Forwarded-* is applied only for requests from the proxies in ForwardedHeaders:KnownProxies/KnownNetworks.
// With none listed only loopback is trusted, so a client can't spoof its IP (and dodge the per-IP rate limits) itself.
var knownProxies = (config.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? []).Select(IPAddress.Parse).ToArray();
var knownNetworks = (config.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>() ?? []).Select(System.Net.IPNetwork.Parse).ToArray();
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    foreach (var proxy in knownProxies) o.KnownProxies.Add(proxy);
    foreach (var network in knownNetworks) o.KnownIPNetworks.Add(network);
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
    await scope.ServiceProvider.GetRequiredService<ArenaDbContext>().Database.MigrateAsync();

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseRateLimiter();

if (app.Environment.IsDevelopment() || config.GetValue<bool>("EnableApiDocs"))
{
    app.MapOpenApi();
    app.MapScalarApiReference("/docs");
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.MapRuns();
app.MapHub<BattleHub>("/hubs/battle");
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") });

app.Run();

public partial class Program;
