import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/browser",
    testMatch: "**/*.spec.ts",
    outputDir: "./test-results/browser",
    timeout: 60_000,
    fullyParallel: false,
    retries: 0,
    use: {
        baseURL: "http://127.0.0.1:4174",
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        headless: true,
        trace: "retain-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: {
                browserName: "chromium",
                launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
            },
        },
    ],
    webServer: {
        command: "npm run test:browser:serve",
        url: "http://127.0.0.1:4174/tests/browser/fixture.html",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
});
