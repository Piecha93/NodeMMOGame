import assert from "node:assert/strict";
import { test } from "node:test";
import { PerformanceMetrics } from "../../server/runtime/PerformanceMetrics";

test("performance metrics: report actual update rate after a full wallclock window", () => {
    const metrics = new PerformanceMetrics(0, 0);
    assert.deepEqual(metrics.read(), { simulationHz: 0, snapshotHz: 0, snapshotP95Ms: 0 });
    for (let snapshot = 1; snapshot <= 65; snapshot++) {
        metrics.recordSnapshot(3, (snapshot * 1000) / 65, Math.floor((snapshot * 64) / 65));
        if (snapshot < 65) {
            assert.equal(metrics.read().simulationHz, 0, "partial windows must not imply a stable rate");
            assert.equal(metrics.read().snapshotHz, 0);
        }
    }
    assert.deepEqual(metrics.read(), { simulationHz: 64, snapshotHz: 65, snapshotP95Ms: 3 });

    // A stalled loop still has cheap individual ticks, but neither rate can stay
    // at the configured target when only 32 ticks and 10 updates take 1.6 s.
    for (let snapshot = 1; snapshot <= 10; snapshot++) {
        metrics.recordSnapshot(1, 1000 + snapshot * 160, 64 + Math.floor((snapshot * 32) / 10));
    }
    // The window closes at 1.12 s: seven updates and 22 simulation steps.
    assert.equal(metrics.read().simulationHz, (22 * 1000) / 1120);
    assert.equal(metrics.read().snapshotHz, (7 * 1000) / 1120);
});

test("performance metrics: uint32 tick wrap and reset do not inflate simulation rate", () => {
    const metrics = new PerformanceMetrics(500, 0xfffffff0);
    metrics.recordSnapshot(4, 1500, 48);
    assert.deepEqual(metrics.read(), { simulationHz: 64, snapshotHz: 1, snapshotP95Ms: 4 });
    metrics.reset(1500, 48);
    assert.deepEqual(metrics.read(), { simulationHz: 0, snapshotHz: 0, snapshotP95Ms: 0 });
    metrics.recordSnapshot(2, 2499, 112);
    assert.equal(metrics.read().simulationHz, 0);
    metrics.recordSnapshot(2, 2500, 112);
    assert.deepEqual(metrics.read(), { simulationHz: 64, snapshotHz: 2, snapshotP95Ms: 2 });
});

test("performance metrics: CPU p95 uses a bounded recent window and rejects invalid samples", () => {
    const metrics = new PerformanceMetrics(0, 0);
    for (let index = 0; index < 128; index++) metrics.recordSnapshot(1000, index, index);
    for (let duration = 1; duration <= 128; duration++) metrics.recordSnapshot(duration, 128 + duration, duration);
    assert.equal(metrics.read().snapshotP95Ms, 122, "old slow snapshots must leave the 128-sample window");
    const before = metrics.read();
    metrics.recordSnapshot(Number.NaN, 300, 200);
    metrics.recordSnapshot(-1, 300, 200);
    metrics.recordSnapshot(9999, Number.POSITIVE_INFINITY, 200);
    metrics.recordSnapshot(9999, 300, -1);
    metrics.recordSnapshot(9999, 300, 0x100000000);
    assert.deepEqual(metrics.read(), before);
});
