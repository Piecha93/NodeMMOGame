import { Session } from "node:inspector";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { Collisions, Polygon } from "detect-collisions";

const usage =
    "node scripts/profile-collisions.mjs --count=0..20000 " +
    "--ticks=30..500 --warmup=0..500 --scenario=static|moving|combat " +
    "[--movement-steps=1..8] [--seed=0..4294967295] [--cpu-profile=path.cpuprofile] [--artifacts=directory]";
const allowedArguments = new Set([
    "count",
    "ticks",
    "warmup",
    "scenario",
    "movement-steps",
    "seed",
    "cpu-profile",
    "artifacts",
]);
const argumentsByName = new Map();
for (const argument of process.argv.slice(2)) {
    if (argument === "--help") {
        console.log(usage);
        process.exit(0);
    }
    const match = /^--([^=]+)=(.+)$/.exec(argument);
    if (!match || !allowedArguments.has(match[1]) || argumentsByName.has(match[1])) throw new Error(usage);
    argumentsByName.set(match[1], match[2]);
}
const count = Number(argumentsByName.get("count") ?? 2000);
const ticks = Number(argumentsByName.get("ticks") ?? 120);
const warmup = Number(argumentsByName.get("warmup") ?? 64);
const scenario = argumentsByName.get("scenario") ?? "combat";
const movementSteps = Number(argumentsByName.get("movement-steps") ?? 1);
const seed = Number(argumentsByName.get("seed") ?? 0xc0ffee);
const cpuProfilePath = argumentsByName.has("cpu-profile") ? resolve(argumentsByName.get("cpu-profile")) : null;
const validInteger = (value, minimum, maximum) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
if (
    !validInteger(count, 0, 20000) ||
    !validInteger(ticks, 30, 500) ||
    !validInteger(warmup, 0, 500) ||
    !validInteger(movementSteps, 1, 8) ||
    !validInteger(seed, 0, 0xffffffff) ||
    !["static", "moving", "combat"].includes(scenario)
) {
    throw new Error(usage);
}
const artifacts = argumentsByName.has("artifacts")
    ? resolve(argumentsByName.get("artifacts"))
    : fileURLToPath(new URL("../dist/", import.meta.url));
const artifactModule = (path) => import(pathToFileURL(resolve(artifacts, path)).href);
const [
    { GameCore },
    { Origin },
    { PerformanceController },
    { PERFORMANCE_MAX_ENEMIES },
    { GameObject },
    { Collider },
    { CollisionsSystem },
    { simulateMovement },
] = await Promise.all([
    artifactModule("shared/GameCore.js"),
    artifactModule("shared/core/Origin.js"),
    artifactModule("server/runtime/PerformanceController.js"),
    artifactModule("shared/gameplay/Performance.js"),
    artifactModule("shared/game_utils/game/objects/GameObject.js"),
    artifactModule("shared/game_utils/physics/Collider.js"),
    artifactModule("shared/game_utils/physics/CollisionsSystem.js"),
    artifactModule("shared/core/SimulateMovement.js"),
]);
if (count > PERFORMANCE_MAX_ENEMIES)
    throw new Error(`Artifact build supports at most ${PERFORMANCE_MAX_ENEMIES} enemies`);

const narrowphaseSampleEvery = 128;
const summarize = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
        mean: values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length),
        p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        p95: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
        max: sorted.at(-1) ?? 0,
    };
};
const createRandom = () => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
    };
};
const movePlayer = (player, tick) => {
    const phase = Math.floor(tick / 32) % 4;
    player.Horizontal = phase === 1 ? 1 : phase === 3 ? -1 : 0;
    player.Vertical = phase === 0 ? 1 : phase === 2 ? -1 : 0;
};
const replayMovement = (core, player) => {
    for (let index = 1; index < movementSteps; index++) {
        simulateMovement(player, core.CollisionsSystem, core.Runtime.config.fixedDeltaMs, () =>
            core.ChunksManager.rebuildOne(player),
        );
    }
};

function createWorld() {
    const core = new GameCore({
        role: Origin.SERVER,
        performanceMode: true,
        cooperative: true,
        random: createRandom(),
        clock: () => 0,
    });
    let controller;
    try {
        controller = new PerformanceController(core);
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", controller.spawnPosition());
        controller.configure({ count, distribution: "nearby", scenario });
        const loadingTicks = Math.ceil(count / 80);
        for (let index = 0; index < loadingTicks; index++) core.step();
        if (controller.EnemyCount !== count) throw new Error("Requested population did not finish loading");
        for (let index = 0; index < warmup; index++) {
            movePlayer(player, index);
            replayMovement(core, player);
            core.step();
        }
        return { core, controller, player, loadingTicks };
    } catch (error) {
        try {
            controller?.dispose();
        } finally {
            core.dispose();
        }
        throw error;
    }
}

function fingerprint(core) {
    const hash = createHash("sha256");
    for (const object of core.ObjectsManager.ObjectsById.values()) {
        hash.update(
            JSON.stringify([
                object.ID,
                object.constructor.name,
                object.Transform.X,
                object.Transform.Y,
                object.Transform.Rotation,
                "HP" in object ? object.HP : null,
            ]),
        );
    }
    return hash.digest("hex");
}

function instrumentPhases() {
    const phases = {};
    const restorations = [];
    const wrap = (prototype, method, name, sampleEvery = 1, inspectResult) => {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
        if (!descriptor || typeof descriptor.value !== "function") throw new Error(`Cannot profile ${name}`);
        const original = descriptor.value;
        const metric = { calls: 0, timedCalls: 0, timedMs: 0 };
        phases[name] = metric;
        Object.defineProperty(prototype, method, {
            ...descriptor,
            value: function (...args) {
                const timed = metric.calls++ % sampleEvery === 0;
                const started = timed ? performance.now() : 0;
                try {
                    const result = Reflect.apply(original, this, args);
                    inspectResult?.(result, metric);
                    return result;
                } finally {
                    if (timed) {
                        metric.timedCalls++;
                        metric.timedMs += performance.now() - started;
                    }
                }
            },
        });
        restorations.push(() => Object.defineProperty(prototype, method, descriptor));
    };
    try {
        wrap(GameObject.prototype, "update", "GameObject.update");
        wrap(GameObject.prototype, "updateColliders", "GameObject.updateColliders");
        wrap(CollisionsSystem.prototype, "update", "CollisionsSystem.update");
        wrap(Collisions.prototype, "update", "BVH.update");
        if (typeof CollisionsSystem.prototype.updateGeometry === "function")
            wrap(CollisionsSystem.prototype, "updateGeometry", "CollisionsSystem.updateGeometry");
        if (typeof CollisionsSystem.prototype.refreshSolidCandidates === "function")
            wrap(CollisionsSystem.prototype, "refreshSolidCandidates", "CollisionPolicy.refresh");
        wrap(CollisionsSystem.prototype, "updateCollisions", "CollisionsSystem.updateCollisions");
        wrap(CollisionsSystem.prototype, "removeObject", "CollisionsSystem.removeObject");
        // Body is declared in the package types but is not exported at runtime.
        wrap(Object.getPrototypeOf(Polygon.prototype), "potentials", "Body.potentials", 1, (result, metric) => {
            metric.candidates = (metric.candidates ?? 0) + result.length;
            metric.maxCandidatesPerCall = Math.max(metric.maxCandidatesPerCall ?? 0, result.length);
        });
        wrap(Collider.prototype, "collides", "Collider.collides", narrowphaseSampleEvery);
        return {
            phases,
            restore: () => {
                for (const restore of restorations.reverse()) restore();
            },
        };
    } catch (error) {
        for (const restore of restorations.reverse()) restore();
        throw error;
    }
}

const inspectorPost = (session, method, params = {}) =>
    new Promise((fulfill, reject) =>
        session.post(method, params, (error, result) => (error ? reject(error) : fulfill(result))),
    );

async function runPass(kind) {
    const world = createWorld();
    let instrumentation;
    let inspector;
    let profile;
    try {
        if (kind === "phases") instrumentation = instrumentPhases();
        if (kind === "inspector") {
            inspector = new Session();
            inspector.connect();
            await inspectorPost(inspector, "Profiler.enable");
            await inspectorPost(inspector, "Profiler.setSamplingInterval", { interval: 1000 });
            await inspectorPost(inspector, "Profiler.start");
        }
        const tickMs = [];
        let minimumEnemies = count;
        let maximumEnemies = count;
        const started = performance.now();
        for (let index = 0; index < ticks; index++) {
            movePlayer(world.player, warmup + index);
            const tickStarted = performance.now();
            replayMovement(world.core, world.player);
            world.core.step();
            tickMs.push(performance.now() - tickStarted);
            minimumEnemies = Math.min(minimumEnemies, world.controller.EnemyCount);
            maximumEnemies = Math.max(maximumEnemies, world.controller.EnemyCount);
        }
        const elapsedMs = performance.now() - started;
        if (inspector) profile = (await inspectorPost(inspector, "Profiler.stop")).profile;
        const result = {
            tickMs: summarize(tickMs),
            elapsedMs,
            ticks,
            minimumEnemies,
            maximumEnemies,
            finalObjects: world.core.ObjectsManager.ObjectsById.size,
            finalFingerprint: fingerprint(world.core),
        };
        if (instrumentation) {
            result.phases = Object.fromEntries(
                Object.entries(instrumentation.phases).map(([name, metric]) => [
                    name,
                    {
                        ...metric,
                        measuredMsPerTick: metric.timedMs / ticks,
                        ...(name === "Collider.collides"
                            ? {
                                  sampleEvery: narrowphaseSampleEvery,
                                  estimatedTotalMs:
                                      metric.timedCalls === 0 ? 0 : (metric.timedMs / metric.timedCalls) * metric.calls,
                                  estimatedMsPerTick:
                                      metric.timedCalls === 0
                                          ? 0
                                          : ((metric.timedMs / metric.timedCalls) * metric.calls) / ticks,
                              }
                            : {}),
                    },
                ]),
            );
        }
        return { result, profile };
    } finally {
        instrumentation?.restore();
        inspector?.disconnect();
        try {
            world.controller.dispose();
        } finally {
            world.core.dispose();
        }
    }
}

function summarizeProfile(profile) {
    const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
    const byFunction = new Map();
    let totalSampledUs = 0;
    for (let index = 0; index < (profile.samples?.length ?? 0); index++) {
        const node = nodes.get(profile.samples[index]);
        if (!node) continue;
        const sampledUs = profile.timeDeltas?.[index] ?? 1000;
        totalSampledUs += sampledUs;
        const frame = node.callFrame;
        const key = JSON.stringify([frame.functionName, frame.url, frame.lineNumber, frame.columnNumber]);
        let row = byFunction.get(key);
        if (!row) {
            row = {
                function: frame.functionName || "(anonymous)",
                url: frame.url,
                line: frame.lineNumber + 1,
                selfSamples: 0,
                selfMs: 0,
            };
            byFunction.set(key, row);
        }
        row.selfSamples++;
        row.selfMs += sampledUs / 1000;
    }
    return {
        samplingIntervalUs: 1000,
        totalSamples: profile.samples?.length ?? 0,
        totalSampledMs: totalSampledUs / 1000,
        hotspots: [...byFunction.values()]
            .sort((a, b) => b.selfMs - a.selfMs)
            .slice(0, 25)
            .map((row) => ({ ...row, selfPercent: totalSampledUs === 0 ? 0 : (row.selfMs * 100000) / totalSampledUs })),
    };
}

const baseline = (await runPass("baseline")).result;
const phases = (await runPass("phases")).result;
const inspector = await runPass("inspector");
if (new Set([baseline.finalFingerprint, phases.finalFingerprint, inspector.result.finalFingerprint]).size !== 1) {
    throw new Error("Profiling changed the final world state; these measurements cannot be compared");
}
if (cpuProfilePath) {
    await mkdir(dirname(cpuProfilePath), { recursive: true });
    await writeFile(cpuProfilePath, JSON.stringify(inspector.profile), { flag: "wx" });
}
console.log(
    JSON.stringify(
        {
            environment: { node: process.version, platform: process.platform, arch: process.arch, artifacts },
            workload: {
                count,
                scenario,
                ticks,
                warmup,
                movementSteps,
                loadingTicks: Math.ceil(count / 80),
                distribution: "nearby",
                seed,
                fixedDeltaMs: 1000 / 64,
                movingPlayer: "Square; direction changes every 32 ticks; player does not shoot",
            },
            baseline,
            instrumented: phases,
            inspector: { ...inspector.result, ...summarizeProfile(inspector.profile), cpuProfilePath },
            observedInstrumentationOverhead: {
                phasesMeanMsPerTick: phases.tickMs.mean - baseline.tickMs.mean,
                phasesMeanRatio: baseline.tickMs.mean === 0 ? 0 : phases.tickMs.mean / baseline.tickMs.mean,
                inspectorMeanMsPerTick: inspector.result.tickMs.mean - baseline.tickMs.mean,
                inspectorMeanRatio:
                    baseline.tickMs.mean === 0 ? 0 : inspector.result.tickMs.mean / baseline.tickMs.mean,
                note: "Sequential independent passes also include JIT, garbage collection and machine noise; this is not a calibrated subtraction. Negative overhead can occur.",
            },
            interpretation: [
                "Headless deterministic simulation only; no network, snapshot encoding, client rendering or real-time scheduling.",
                "Each pass starts a fresh identically seeded world, fully loads enemies, then runs the requested warmup before measurement. Final world fingerprints must agree.",
                "movementSteps above 1 adds queued-input replay before every warmup and measured world tick using simulateMovement and rebuildOne(player), matching the server path; all replay costs are included in tick timing.",
                "Phase durations are inclusive and nested: GameObject.update includes collider updates; updateCollisions includes potentials, collides, callbacks and nested removals. Do not sum phase totals.",
                "Body.potentials candidate totals count returned directed broadphase candidates before gameplay filtering; Collider.collides calls count the surviving narrowphase tests.",
                "Collider.collides estimates extrapolate every 128th call; other listed phase durations time every call. Tiny functions are sensitive to timer and wrapper overhead.",
                "CPU sampling runs in a separate pass with no method wrappers; hotspots show sampled self time, including GC. Profiling does not wrap collision hooks or solidity checks.",
            ],
        },
        null,
        2,
    ),
);
