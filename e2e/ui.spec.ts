import { test, expect } from "playwright/test";

test.describe("RPG Arena", () => {
  test("a hero fights a battle to the end and lands on the leaderboard", async ({ page }) => {
    const name = `Aria${Date.now() % 100000}`;
    await page.goto("/");
    await page.getByLabel("Name").fill(name);
    await page.locator("#classes").getByText("Ranger", { exact: true }).click();
    await page.locator("#weapons").getByText("Bow", { exact: true }).click();
    await page.getByRole("button", { name: "Enter the arena" }).click();

    await expect(page.locator("#hero-title")).toHaveText(name);
    await expect(page.locator("#hero-sub")).toHaveText("Level 1 Ranger");
    await expect(page.getByRole("button", { name: "Volley" })).toBeVisible();

    await page.getByRole("button", { name: "Volley" }).click();
    await expect(page.getByRole("button", { name: /Volley \(\d\)/ })).toBeDisabled();

    for (let i = 0; i < 60 && (await page.locator("#controls").isVisible()); i++) {
      await page.getByRole("button", { name: "Attack" }).click();
      await page.waitForFunction(() => !(document.querySelector('[data-action="Attack"]') as HTMLButtonElement).disabled);
    }
    await expect(page.locator("#outcome")).toHaveText(/Victory!|has fallen/);

    const board = page.getByRole("row", { name: new RegExp(name) });
    await expect(board).toBeVisible();
  });

  test("spectators see the battle without controls", async ({ page, browser }) => {
    await page.goto("/");
    await page.getByLabel("Name").fill("Watched");
    await page.getByRole("button", { name: "Enter the arena" }).click();
    await expect(page.locator("#watch-link")).toHaveText(/\?watch=/);
    const watchUrl = (await page.locator("#watch-link").textContent())!;

    const spectator = await (await browser.newContext()).newPage();
    await spectator.goto(watchUrl);
    await expect(spectator.getByText("You're watching this battle live.")).toBeVisible();
    await expect(spectator.locator("#controls")).toBeHidden();

    await page.getByRole("button", { name: "Defend" }).click();
    await expect(spectator.locator("#log")).toContainText("raises a guard");
  });

  test("names are validated", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Name").fill("X");
    await page.getByRole("button", { name: "Enter the arena" }).click();
    await expect(page.locator("#setup")).toBeVisible();
    await expect(page.locator("#battle")).toBeHidden();
  });
});
