import assert from "node:assert/strict";
import {readFile, stat} from "node:fs/promises";
import path from "node:path";
import {test} from "node:test";

import {
    getAnimationFrameGroup,
    RESOURCE_MANIFEST,
    ResourceType,
    validateResourceManifest,
} from "../../client/graphic/ResourceManifest";

function repositoryRoot(): string {
    const currentDirectory = process.cwd();
    return path.basename(currentDirectory) === "dist-test"
        ? path.dirname(currentDirectory)
        : currentDirectory;
}

test("client/assets: manifest aliases are valid and every source file exists", async () => {
    assert.doesNotThrow(() => validateResourceManifest(RESOURCE_MANIFEST));
    assert.deepEqual(
        RESOURCE_MANIFEST.map(({name}) => name).sort(),
        [
            "bluebolt",
            "bullet",
            "bunny",
            "doors_closed",
            "doors_open",
            "dyzma",
            "fireball",
            "flame",
            "hp_potion",
            "kamis",
            "michau",
            "none",
            "panda",
            "portal",
            "template_idle",
            "template_run",
            "terrain",
            "wall",
            "white",
        ],
        "renderer resources must not disappear silently during loader changes",
    );

    const publicRoot = path.join(repositoryRoot(), "public");
    await Promise.all(RESOURCE_MANIFEST.map(async (definition) => {
        const relativePath = definition.path.replace(/^\/+/, "");
        const resourceStats = await stat(path.join(publicRoot, relativePath));

        assert.ok(resourceStats.isFile(), `${definition.name} must resolve to a regular file`);
    }));
});

test("client/assets: manifest validation rejects aliases that would overwrite a resource", () => {
    const first = RESOURCE_MANIFEST[0];

    assert.throws(
        () => validateResourceManifest([...RESOURCE_MANIFEST, {...first}]),
        /Duplicate resource name: none/,
    );
    assert.throws(
        () => validateResourceManifest([
            {name: "relative", path: "resources/images/none.png", type: ResourceType.SPRITE},
        ]),
        /absolute \/resources\//,
    );
});

test("client/assets: checked-in animation sheets classify every frame deterministically", async () => {
    const expectedDirectionCounts = new Map([
        ["U", 8],
        ["UR", 8],
        ["R", 8],
        ["DR", 8],
        ["D", 8],
        ["DL", 8],
        ["L", 8],
        ["UL", 8],
    ]);
    const animationDefinitions = RESOURCE_MANIFEST.filter(
        (definition) => definition.type !== ResourceType.SPRITE,
    );

    for (const definition of animationDefinitions) {
        const resourcePath = path.join(
            repositoryRoot(),
            "public",
            definition.path.replace(/^\/+/, ""),
        );
        const sheet = JSON.parse(await readFile(resourcePath, "utf8")) as {
            frames?: Record<string, unknown>;
        };

        assert.ok(sheet.frames, `${definition.name} must contain a frames object`);

        const groupCounts = new Map<string, number>();
        for (const frameName of Object.keys(sheet.frames)) {
            const group = getAnimationFrameGroup(definition.type, definition.name, frameName);

            assert.notEqual(group, null, `${definition.name}/${frameName} must have a known group`);
            groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
        }

        if (definition.type === ResourceType.ANIMATION) {
            assert.deepEqual(groupCounts, new Map([[definition.name, 4]]));
        } else {
            assert.deepEqual(groupCounts, expectedDirectionCounts);
        }
    }
});

test("client/assets: frame grouping does not invent directions for malformed names", () => {
    assert.equal(
        getAnimationFrameGroup(ResourceType.OCTAGONAL_ANIMATION, "template_idle", "Idle_U_0"),
        "U",
    );
    assert.equal(
        getAnimationFrameGroup(ResourceType.OCTAGONAL_ANIMATION, "template_idle", "Idle_SIDE_0"),
        null,
    );
    assert.equal(getAnimationFrameGroup(ResourceType.SPRITE, "wall", "wall"), null);
    assert.equal(getAnimationFrameGroup(ResourceType.ANIMATION, "flame", "flame_0.png"), "flame");
});
