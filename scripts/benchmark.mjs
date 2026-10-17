import { performance } from "node:perf_hooks";
import { GameCore } from "../dist/shared/GameCore.js";
import { Origin } from "../dist/shared/core/Origin.js";
import { PerformanceController } from "../dist/server/runtime/PerformanceController.js";
import { PERFORMANCE_MAX_ENEMIES } from "../dist/shared/gameplay/Performance.js";
import { ReplicationSession, VIEWPORT_INTEREST } from "../dist/shared/replication/ReplicationSession.js";
import { applySnapshot } from "../dist/shared/replication/EntityAdapter.js";
import { encodeSnapshot, encodeSnapshotV3, decodeSnapshotV3 } from "../dist/shared/protocol/index.js";

const argumentsByName = new Map(process.argv.slice(2).map((argument) => argument.replace(/^--/, "").split("=")));
const count = Number(argumentsByName.get("count") ?? 2000);
const samples = Number(argumentsByName.get("samples") ?? 120);
const scenario = argumentsByName.get("scenario") ?? "moving";
if (
    !Number.isInteger(count) ||
    count < 0 ||
    count > PERFORMANCE_MAX_ENEMIES ||
    !Number.isInteger(samples) ||
    samples < 30 ||
    samples > 500 ||
    !["static", "moving", "combat"].includes(scenario)
) {
    throw new Error(`Use --count=0..${PERFORMANCE_MAX_ENEMIES} --samples=30..500 --scenario=static|moving|combat`);
}

const core = new GameCore({ role: Origin.SERVER, performanceMode: true, cooperative: true, random: () => 0.5 });
const replica = new GameCore({ role: Origin.CLIENT, performanceMode: true, random: () => 0.5 });
// Offline fixtures load exactly 80 enemies per tick so their initial positions
// and simulated ages stay deterministic. Tick CPU telemetry still uses real time.
const controller = new PerformanceController(core, { clock: () => 0 });
const all = new ReplicationSession();
const viewport = new ReplicationSession(VIEWPORT_INTEREST);
const measurements = {
    tick: [],
    v2Prepare: [],
    v2Encode: [],
    v3EncodeSameRecords: [],
    viewportPrepare: [],
    viewportEncode: [],
    clientDecodeApply: [],
};
const byteSamples = { v2: [], v3SameRecords: [], v3Viewport: [] };
const bytes = (frames) => frames.reduce((total, frame) => total + frame.byteLength, 0);
const measure = (name, callback, collect) => {
    const started = performance.now();
    const result = callback();
    if (collect) measurements[name].push(performance.now() - started);
    return result;
};
const summarize = (values) => {
    const sorted = [...values].sort((left, right) => left - right);
    return {
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
        mean: values.reduce((total, value) => total + value, 0) / values.length,
    };
};

try {
    const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", controller.spawnPosition());
    controller.configure({ count, distribution: "nearby", scenario });
    for (let index = 0; index < Math.ceil(count / 80); index++) core.step();
    const firstAll = all.prepare(core, player, null);
    const firstViewport = viewport.prepare(core, player, null);
    const initialBytes = {
        v2: bytes(encodeSnapshot(firstAll.snapshot)),
        v3SameRecords: bytes(encodeSnapshotV3(firstAll.snapshot)),
        v3Viewport: bytes(encodeSnapshotV3(firstViewport.snapshot)),
    };
    applySnapshot(replica, decodeSnapshotV3(encodeSnapshotV3(firstViewport.snapshot)));
    firstAll.commit();
    firstViewport.commit();
    let maximumKnown = replica.ObjectsManager.ObjectsById.size;
    for (let sample = 0; sample < samples + 20; sample++) {
        const collect = sample >= 20;
        for (let step = 0; step < 3; step++) {
            // Repeatable movement around the dense population, without drifting off the test map.
            const phase = Math.floor((sample * 3 + step) / 32) % 4;
            player.Horizontal = phase === 1 ? 1 : phase === 3 ? -1 : 0;
            player.Vertical = phase === 0 ? 1 : phase === 2 ? -1 : 0;
            measure("tick", () => core.step(), collect);
        }
        const full = measure("v2Prepare", () => all.prepare(core, player, null), collect);
        const v2 = measure("v2Encode", () => encodeSnapshot(full.snapshot), collect);
        const v3 = measure("v3EncodeSameRecords", () => encodeSnapshotV3(full.snapshot), collect);
        const view = measure("viewportPrepare", () => viewport.prepare(core, player, null), collect);
        const compact = measure("viewportEncode", () => encodeSnapshotV3(view.snapshot), collect);
        measure("clientDecodeApply", () => applySnapshot(replica, decodeSnapshotV3(compact)), collect);
        if (collect) {
            byteSamples.v2.push(bytes(v2));
            byteSamples.v3SameRecords.push(bytes(v3));
            byteSamples.v3Viewport.push(bytes(compact));
        }
        maximumKnown = Math.max(maximumKnown, replica.ObjectsManager.ObjectsById.size);
        full.commit();
        view.commit();
    }
    console.log(
        JSON.stringify(
            {
                environment: { node: process.version, platform: process.platform, arch: process.arch },
                workload: { count, scenario, samples, warmupSnapshots: 20, ticksPerSnapshot: 3, movingPlayer: true },
                initialBytes,
                bytesPerSnapshot: Object.fromEntries(
                    Object.entries(byteSamples).map(([name, values]) => [name, summarize(values)]),
                ),
                estimatedKiBPerSecondAt25Hz: Object.fromEntries(
                    Object.entries(byteSamples).map(([name, values]) => [name, (summarize(values).mean * 25) / 1024]),
                ),
                cpuMilliseconds: Object.fromEntries(
                    Object.entries(measurements).map(([name, values]) => [name, summarize(values)]),
                ),
                maximumClientObjects: maximumKnown,
                note: "Headless deterministic CPU/wire benchmark. The 25 Hz bandwidth estimate is not measured network throughput; browser rendering, RTT and transport headers are excluded.",
            },
            null,
            2,
        ),
    );
} finally {
    controller.dispose();
    core.dispose();
    replica.dispose();
}
