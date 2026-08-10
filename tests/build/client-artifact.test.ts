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
});

test("build/client: the game view loads the generated module, not the legacy bundle", async () => {
    const gameView = await readFile(path.join(repositoryRoot(), "views", "game.ejs"), "utf8");

    assert.doesNotMatch(gameView, /\/javascripts\/bundle\.js/);
    assert.match(
        gameView,
        /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']\/build\/game\.js["'])[^>]*>/,
    );
    assert.match(
        gameView,
        /<script\b[^>]*\bsrc=["']\/javascripts\/pixi\.min\.js["'][^>]*>/,
        "PixiJS 4 remains an explicit compatibility dependency until its separate migration",
    );
});
