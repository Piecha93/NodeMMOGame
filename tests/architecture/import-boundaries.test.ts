import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

interface Violation {
    file: string;
    line: number;
    message: string;
}

const repository = path.basename(process.cwd()) === "dist-test" ? path.dirname(process.cwd()) : process.cwd();
async function check(root: string): Promise<Violation[]> {
    const checker = (await import(pathToFileURL(path.join(repository, "scripts/check-boundaries.mjs")).href)) as {
        checkProject(root: string): Violation[];
    };
    return checker.checkProject(root);
}

async function fixture(files: Record<string, string>): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), "nodemmo-boundaries-"));
    await writeFile(
        path.join(root, "tsconfig.json"),
        JSON.stringify({
            compilerOptions: {
                target: "ES2022",
                module: "NodeNext",
                moduleResolution: "NodeNext",
                lib: ["ES2022", "DOM"],
                types: [],
            },
            include: ["shared/**/*.ts", "client/**/*.ts", "server/**/*.ts"],
        }),
    );
    for (const [name, source] of Object.entries(files)) {
        const destination = path.join(root, name);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, source);
    }
    return root;
}

test("architecture: repository imports respect client, server, core and protocol boundaries", async () => {
    assert.deepEqual(await check(repository), []);
});

test("architecture: platform imports, protocol-to-entity coupling and DOM references are rejected", async () => {
    const root = await fixture({
        "shared/core/Bad.ts": 'import {Socket} from "socket.io"; export const width = window.innerWidth;',
        "shared/protocol/Bad.ts":
            'import {Entity} from "../Entity"; export const root = document.body; export const alias = globalThis["window"];',
        "shared/Entity.ts": "export class Entity {}",
        "client/Bad.ts": 'import {Secret} from "../server/Secret";',
        "server/Secret.ts": "export class Secret {}",
    });
    try {
        const violations = await check(root);
        assert.ok(violations.some(({ message }) => message.includes("socket.io")));
        assert.ok(violations.some(({ message }) => message.includes("protocol must depend only")));
        assert.ok(violations.some(({ message }) => message.includes("DOM global 'window'")));
        assert.equal(
            violations.filter(({ message }) => message.includes("DOM global 'window'")).length,
            2,
            "globalThis bracket access must not bypass the DOM boundary",
        );
        assert.ok(violations.some(({ message }) => message.includes("DOM global 'document'")));
        assert.ok(violations.some(({ message }) => message.includes("client cannot import server")));
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("architecture: comments, strings and locally bound DOM-like names are not global references", async () => {
    const root = await fixture({
        "shared/core/Good.ts": `
        // import {Socket} from "socket.io"; document.body;
        const text = "window.localStorage and import('pixi.js')";
        export function measure(window: {width: number}, document: {title: string}) {
            return {window: window.width, title: document.title, text};
        }
        export function locallyBound(globalThis: {window: number}, require: (name: string) => string) {
            return [globalThis["window"], require("socket.io")];
        }
    `,
    });
    try {
        assert.deepEqual(await check(root), []);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
