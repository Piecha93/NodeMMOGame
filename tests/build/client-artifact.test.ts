import assert from "node:assert/strict";
import {readFile, stat} from "node:fs/promises";
import path from "node:path";
import {test} from "node:test";

function repositoryRoot(): string {
    const currentDirectory = process.cwd();
    return path.basename(currentDirectory) === "dist-test"
        ? path.dirname(currentDirectory)
        : currentDirectory;
}

test("build/client: current TypeScript sources produce a browser artifact", async () => {
    const root = repositoryRoot();
    const artifactPath = path.join(root, "dist", "public", "game.js");
    const sourceMapPath = `${artifactPath}.map`;

    const [artifactStats, artifact, rawSourceMap] = await Promise.all([
        stat(artifactPath),
        readFile(artifactPath, "utf8"),
        readFile(sourceMapPath, "utf8"),
    ]);

    assert.ok(artifactStats.isFile(), "dist/public/game.js must be a regular file");
    assert.ok(
        artifactStats.size > 10_000,
        "dist/public/game.js is unexpectedly small; the client may not have been bundled",
    );
    assert.match(artifact, /sourceMappingURL=game\.js\.map/);
    assert.match(
        artifact,
        /\/build\//,
        "Vite must embed the Express /build mount as its runtime base",
    );
    assert.doesNotMatch(
        artifact,
        /["'`]\/assets\//,
        "Vite must not preload generated chunks from the origin root",
    );

    const sourceMap = JSON.parse(rawSourceMap) as {
        version?: number;
        sources?: unknown;
    };
    assert.equal(sourceMap.version, 3);
    assert.ok(Array.isArray(sourceMap.sources), "client source map must list its inputs");
    assert.ok(
        sourceMap.sources.some((source) =>
            typeof source === "string" && /(?:^|\/)client\/Launcher\.ts$/.test(source.replaceAll("\\", "/")),
        ),
        "client source map must trace the bundle back to client/Launcher.ts",
    );
    assert.ok(
        sourceMap.sources.some((source) =>
            typeof source === "string" && source.replaceAll("\\", "/").includes("node_modules/pixi.js/"),
        ),
        "PixiJS must be bundled from the npm package rather than supplied as a browser global",
    );
});

test("build/client: the game view loads one generated module without legacy globals", async () => {
    const root = repositoryRoot();
    const gameView = await readFile(path.join(root, "views", "game.ejs"), "utf8");

    assert.doesNotMatch(gameView, /\/javascripts\/bundle\.js/);
    assert.doesNotMatch(gameView, /\/javascripts\/pixi(?:\.min)?\.js/);
    assert.match(
        gameView,
        /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\/build\/game\.js["'])[^>]*>/,
    );

    await assert.rejects(
        stat(path.join(root, "public", "javascripts", "pixi.min.js")),
        (error: NodeJS.ErrnoException) => error.code === "ENOENT",
        "the checked-in PixiJS 4 compatibility build must not return",
    );
});

test("build/client: PixiJS 8 is an application dependency with built-in types", async () => {
    const packageJson = JSON.parse(
        await readFile(path.join(repositoryRoot(), "package.json"), "utf8"),
    ) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };

    assert.match(
        packageJson.dependencies?.["pixi.js"] ?? "",
        /^\^?8\.19\.0$/,
        "package.json must stay on the reviewed PixiJS 8.19 line",
    );
    assert.equal(packageJson.devDependencies?.["@types/pixi.js"], undefined);
});
