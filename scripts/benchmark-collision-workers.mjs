import { Worker } from "node:worker_threads";
import { availableParallelism, cpus } from "node:os";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Circle, Polygon } from "detect-collisions";
import { createCollisionReplayKernel, INPUT_STRIDE, OUTPUT_STRIDE } from "./collision-replay-kernel.mjs";

const usage =
    "node scripts/benchmark-collision-workers.mjs --count=0..20000 --samples=30..100 " +
    "--warmup=0..500 --scenario=static|moving|combat [--seed=0..4294967295] [--artifacts=directory]";
const allowed = new Set(["count", "samples", "warmup", "scenario", "seed", "artifacts"]);
const options = new Map();
for (const argument of process.argv.slice(2)) {
    if (argument === "--help") {
        console.log(usage);
        process.exit(0);
    }
    const match = /^--([^=]+)=(.+)$/.exec(argument);
    if (!match || !allowed.has(match[1]) || options.has(match[1])) throw new Error(usage);
    options.set(match[1], match[2]);
}
const count = Number(options.get("count") ?? 2000);
const samples = Number(options.get("samples") ?? 60);
const warmup = Number(options.get("warmup") ?? 64);
const scenario = options.get("scenario") ?? "combat";
const seed = Number(options.get("seed") ?? 0xc0ffee);
const integerInRange = (value, minimum, maximum) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
if (
    !integerInRange(count, 0, 20000) ||
    !integerInRange(samples, 30, 100) ||
    !integerInRange(warmup, 0, 500) ||
    !integerInRange(seed, 0, 0xffffffff) ||
    !["static", "moving", "combat"].includes(scenario)
)
    throw new Error(usage);
const artifacts = options.has("artifacts")
    ? resolve(options.get("artifacts"))
    : fileURLToPath(new URL("../dist/", import.meta.url));
const artifactModule = (path) => import(pathToFileURL(resolve(artifacts, path)).href);
const [{ GameCore }, { Origin }, { PerformanceController }, { Collider }] = await Promise.all([
    artifactModule("shared/GameCore.js"),
    artifactModule("shared/core/Origin.js"),
    artifactModule("server/runtime/PerformanceController.js"),
    artifactModule("shared/game_utils/physics/Collider.js"),
]);
const maximumQueries = 200000;
const maximumCaptureBytes = 128 * 1024 * 1024;
const randomGenerator = () => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
    };
};
const summarize = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
        mean: values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length),
        p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        p95: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
        max: sorted.at(-1) ?? 0,
    };
};

function captureQueries() {
    const core = new GameCore({
        role: Origin.SERVER,
        performanceMode: true,
        cooperative: true,
        random: randomGenerator(),
        clock: () => 0,
    });
    let controller;
    let originalDescriptor;
    const definitions = [];
    const geometryBySignature = new Map();
    const cachedDefinition = new WeakMap();
    let queryCount = 0;
    let captureBytes = 0;
    let batch;
    let expected;
    const batches = [];
    const geometryId = (shape) => {
        // Shape definitions are pinned library internals, used only by this experiment.
        const version = shape instanceof Circle ? shape.radius : shape._points;
        const cached = cachedDefinition.get(shape);
        if (cached?.version === version) return cached.id;
        let definition;
        if (shape instanceof Circle) definition = { type: "circle", radius: shape.radius };
        else if (shape instanceof Polygon) {
            const points = [];
            for (let index = 0; index < shape._points.length; index += 2)
                points.push([shape._points[index], shape._points[index + 1]]);
            definition = { type: "polygon", points };
        } else throw new Error("Unsupported captured collision geometry");
        const signature = JSON.stringify(definition);
        let id = geometryBySignature.get(signature);
        if (id === undefined) {
            if (definitions.length >= 4096) throw new Error("Captured geometry cache limit exceeded");
            captureBytes += signature.length * 2;
            id = definitions.length;
            definitions.push(definition);
            geometryBySignature.set(signature, id);
        }
        cachedDefinition.set(shape, { version, id });
        return id;
    };
    const appendShape = (shape) => {
        const id = geometryId(shape);
        batch.push(
            id,
            shape.x,
            shape.y,
            shape instanceof Circle ? 0 : shape.angle,
            shape instanceof Circle ? shape.scale : shape.scale_x,
            shape instanceof Circle ? 1 : shape.scale_y,
        );
    };
    try {
        // Offline fixtures keep the original 80-enemy batches and simulated ages;
        // the injected loading clock does not replace real tick CPU measurements.
        controller = new PerformanceController(core, { clock: () => 0 });
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", controller.spawnPosition());
        controller.configure({ count, scenario, distribution: "nearby" });
        for (let index = 0; index < Math.ceil(count / 80); index++) core.step();
        if (controller.EnemyCount !== count) throw new Error("Population failed to load");
        const move = (tick) => {
            const phase = Math.floor(tick / 32) % 4;
            player.Horizontal = phase === 1 ? 1 : phase === 3 ? -1 : 0;
            player.Vertical = phase === 0 ? 1 : phase === 2 ? -1 : 0;
        };
        for (let tick = 0; tick < warmup; tick++) {
            move(tick);
            core.step();
        }
        originalDescriptor = Object.getOwnPropertyDescriptor(Collider.prototype, "collides");
        if (!originalDescriptor || typeof originalDescriptor.value !== "function")
            throw new Error("Cannot capture Collider.collides");
        const original = originalDescriptor.value;
        Object.defineProperty(Collider.prototype, "collides", {
            ...originalDescriptor,
            value: function (other, result) {
                if (++queryCount > maximumQueries)
                    throw new Error("Replay query cap exceeded; reduce samples or count");
                captureBytes += (INPUT_STRIDE + OUTPUT_STRIDE) * Float64Array.BYTES_PER_ELEMENT;
                if (captureBytes > maximumCaptureBytes) throw new Error("Replay capture memory cap exceeded");
                batch.push(Number(result !== undefined));
                appendShape(this.Body);
                appendShape(other.Body);
                const collision = Reflect.apply(original, this, [other, result]);
                expected.push(
                    Number(collision),
                    collision && result ? Number(result.a_in_b) : 0,
                    collision && result ? Number(result.b_in_a) : 0,
                    collision && result ? result.overlap : 0,
                    collision && result ? result.overlap_x : 0,
                    collision && result ? result.overlap_y : 0,
                );
                return collision;
            },
        });
        const started = performance.now();
        for (let tick = 0; tick < samples; tick++) {
            batch = [];
            expected = [];
            move(warmup + tick);
            core.step();
            batches.push({ input: Float64Array.from(batch), expected: Float64Array.from(expected) });
        }
        return {
            definitions,
            batches,
            queryCount,
            captureBytes,
            captureMs: performance.now() - started,
            finalEnemies: controller.EnemyCount,
        };
    } finally {
        if (originalDescriptor) Object.defineProperty(Collider.prototype, "collides", originalDescriptor);
        try {
            controller?.dispose();
        } finally {
            core.dispose();
        }
    }
}

function assertMatches(actual, expected, label) {
    if (actual.length !== expected.length) throw new Error(`${label}: output size changed`);
    for (let index = 0; index < actual.length; index++) {
        if (!Number.isFinite(actual[index]) || Math.abs(actual[index] - expected[index]) > 1e-8)
            throw new Error(`${label}: mismatch at value ${index}: ${actual[index]} vs ${expected[index]}`);
    }
}

class ReplayWorker {
    constructor(definitions) {
        this.pending = new Map();
        this.nextId = 0;
        this.failure = null;
        this.worker = new Worker(new URL("./collision-replay-worker.mjs", import.meta.url), {
            workerData: { definitions },
        });
        this.ready = new Promise((fulfill, reject) => {
            this.rejectReady = reject;
            this.readyTimer = setTimeout(() => this.fail(new Error("Replay worker startup timed out")), 15000);
            this.worker.on("message", (message) => {
                if (message.type === "ready") {
                    clearTimeout(this.readyTimer);
                    fulfill();
                    return;
                }
                const pending = this.pending.get(message.id);
                if (!pending) return this.fail(new Error("Unexpected replay worker response"));
                this.pending.delete(message.id);
                clearTimeout(pending.timer);
                pending.fulfill(message.output);
            });
        });
        this.worker.on("error", (error) => this.fail(error));
        this.worker.on("exit", (code) => {
            if (!this.closing) this.fail(new Error(`Replay worker exited: ${code}`));
        });
    }

    fail(error) {
        this.failure ??= error;
        clearTimeout(this.readyTimer);
        this.rejectReady(error);
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.pending.clear();
    }

    run(input) {
        if (this.failure) return Promise.reject(this.failure);
        const id = this.nextId++;
        return new Promise((fulfill, reject) => {
            const timer = setTimeout(() => this.fail(new Error("Replay worker job timed out")), 15000);
            this.pending.set(id, { fulfill, reject, timer });
            try {
                this.worker.postMessage({ type: "run", id, input }, [input.buffer]);
            } catch (error) {
                this.fail(error);
            }
        });
    }

    async close() {
        this.closing = true;
        this.fail(new Error("Replay worker closed"));
        await this.worker.terminate();
    }
}

async function measureRunner(capture, workerCount) {
    const workers = [];
    const startupStarted = performance.now();
    let run;
    try {
        if (workerCount === 0) {
            const replay = createCollisionReplayKernel(capture.definitions);
            run = (input) => replay(input.slice());
        } else {
            for (let index = 0; index < workerCount; index++) workers.push(new ReplayWorker(capture.definitions));
            await Promise.all(workers.map((worker) => worker.ready));
            run = async (input) => {
                const queries = input.length / INPUT_STRIDE;
                const output = new Float64Array(queries * OUTPUT_STRIDE);
                await Promise.all(
                    workers.map(async (worker, index) => {
                        const start = Math.floor((queries * index) / workerCount);
                        const end = Math.floor((queries * (index + 1)) / workerCount);
                        if (start === end) return;
                        const part = input.slice(start * INPUT_STRIDE, end * INPUT_STRIDE);
                        const result = await worker.run(part);
                        output.set(result, start * OUTPUT_STRIDE);
                    }),
                );
                return output;
            };
        }
        const startupMs = performance.now() - startupStarted;
        const warmupBatches = Math.min(5, capture.batches.length);
        for (let index = 0; index < warmupBatches; index++) {
            const batch = capture.batches[index];
            assertMatches(await run(batch.input), batch.expected, "Warmup SAT vs captured Collider");
        }
        const batchMs = [];
        let collisions = 0;
        for (let index = 0; index < capture.batches.length; index++) {
            const batch = capture.batches[index];
            const started = performance.now();
            const output = await run(batch.input);
            batchMs.push(performance.now() - started);
            assertMatches(output, batch.expected, `${workerCount || "Serial"} workers, batch ${index}`);
            for (let query = 0; query < output.length; query += OUTPUT_STRIDE) collisions += output[query];
        }
        return {
            workerCount,
            startupMs,
            warmupBatches,
            batchMs: summarize(batchMs),
            totalMeasuredMs: batchMs.reduce((sum, value) => sum + value, 0),
            verifiedQueries: capture.queryCount,
            collisions,
        };
    } finally {
        await Promise.allSettled(workers.map((worker) => worker.close()));
    }
}

const capture = captureQueries();
const serial = await measureRunner(capture, 0);
const workers2 = await measureRunner(capture, 2);
const workers4 = await measureRunner(capture, 4);
console.log(
    JSON.stringify(
        {
            experiment:
                "Isolated SAT replay of real narrowphase queries; this is not production Collider fastpath or game Hz",
            environment: {
                node: process.version,
                platform: process.platform,
                arch: process.arch,
                availableParallelism: availableParallelism(),
                cpu: cpus()[0]?.model,
                artifacts,
            },
            workload: { count, scenario, samples, warmup, seed, distribution: "nearby", movingPlayer: true },
            capture: {
                queries: capture.queryCount,
                queriesPerBatch: summarize(capture.batches.map((batch) => batch.input.length / INPUT_STRIDE)),
                geometryTemplates: capture.definitions.length,
                captureBytes: capture.captureBytes,
                captureMs: capture.captureMs,
                finalEnemies: capture.finalEnemies,
                maximumQueries,
                maximumCaptureBytes,
            },
            serial,
            workers2: {
                ...workers2,
                speedupOverSerial:
                    workers2.totalMeasuredMs === 0 ? 0 : serial.totalMeasuredMs / workers2.totalMeasuredMs,
            },
            workers4: {
                ...workers4,
                speedupOverSerial:
                    workers4.totalMeasuredMs === 0 ? 0 : serial.totalMeasuredMs / workers4.totalMeasuredMs,
            },
            interpretation: [
                "Original game callbacks run normally during capture. Replay only reads immutable call-time geometry and never changes the world.",
                "Every measured batch contains exactly one captured tick of real Collider.collides queries. Work is not duplicated or inflated within batches. Each runner replays the same capture once, after five warmup batches.",
                "Pure SAT omits the production Collider rectangle shortcut. These are isolated geometry tasks, not a full parallel collision phase; a speedup here does not imply a speedup for the game.",
                "Each runner owns persistent cached shapes. Measured batch time includes typed input packing/copy, real worker messages and transferable buffers, geometry transform updates, SAT, output allocation and collection. Startup, game capture and correctness comparison are excluded.",
                "Every query boolean and successful requested overlap/containment value must match the captured production Collider result within 1e-8. No callback ordering or parallel mutation scheme is being tested.",
                "Broadphase, contact filters, callback/lifecycle work and ordinary simulation stay outside the replay. These results cannot be interpreted as game simulation Hz or end-to-end parallel collision performance.",
            ],
        },
        null,
        2,
    ),
);
