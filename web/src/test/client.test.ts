import { ApiError, readToken, request, writeToken } from "@/api/client";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("request", () => {
  it("sends the run token and a JSON body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(200, { ok: true }));

    await request("api/runs/1/actions", { method: "POST", body: JSON.stringify({ action: "Attack" }) }, "secret");

    const headers = fetchMock.mock.calls[0][1]!.headers as Headers;
    expect(headers.get("X-Run-Token")).toBe("secret");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("uses validation messages from a problem body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(400, { title: "Bad", errors: { HeroName: ["Too short."] } }));

    await expect(request("api/runs")).rejects.toEqual(new ApiError(400, "Too short."));
  });

  it("uses the detail of a game rule error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json(422, { title: "Can't do that right now", detail: "You're out of potions." }));

    await expect(request("api/runs/1/actions")).rejects.toThrow("You're out of potions.");
  });

  it("asks the player to slow down on 429", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 429 }));

    await expect(request("api/runs")).rejects.toThrow("Slow down a little and try again.");
  });

  it("explains a network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(request("api/catalog")).rejects.toMatchObject({ status: 0 });
  });
});

describe("run tokens", () => {
  it("are stored per run", () => {
    writeToken("a", "token-a");
    expect(readToken("a")).toBe("token-a");
    expect(readToken("b")).toBeNull();
  });
});
