import { expect, test } from "@playwright/test";

interface Metrics {
    width: number;
    height: number;
    colors: number;
    opaqueSamples: number;
    objects: number;
    name: string;
    hp: number;
}

test("deterministic real renderer produces the same nonblank pixels after dispose and remount", async ({
    page,
}, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/tests/browser/fixture.html");
    const status = page.locator("#status");
    await expect(status).toHaveText("ready");
    await expect(status).toHaveAttribute("data-mount", "1");
    const firstMetrics = JSON.parse(await page.locator("#metrics").innerText()) as Metrics;
    expect(firstMetrics).toMatchObject({ width: 1024, height: 576, objects: 7, name: "Fixture", hp: 155 });
    expect(firstMetrics.colors).toBeGreaterThan(16);
    expect(firstMetrics.opaqueSamples).toBeGreaterThan(1000);
    const first = await page.locator("#game-canvas").screenshot({ animations: "disabled" });
    await info.attach("first-render.png", { body: first, contentType: "image/png" });
    await page.getByRole("button", { name: "Remount renderer" }).click();
    await expect(status).toHaveText("ready");
    await expect(status).toHaveAttribute("data-mount", "2");
    const second = await page.locator("#game-canvas").screenshot({ animations: "disabled" });
    await info.attach("remounted-render.png", { body: second, contentType: "image/png" });
    const secondMetrics = JSON.parse(await page.locator("#metrics").innerText()) as Metrics;
    await info.attach("pixel-metrics.json", {
        body: JSON.stringify({ first: firstMetrics, second: secondMetrics }, null, 2),
        contentType: "application/json",
    });
    expect(secondMetrics).toEqual(firstMetrics);
    expect(second.equals(first), "remounting the same scene must reproduce its pixels within the pinned browser").toBe(
        true,
    );
    expect(errors).toEqual([]);
});
