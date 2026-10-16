import assert from "node:assert/strict";
import test from "node:test";
import { LoopSchedule } from "../../server/runtime/LoopSchedule";

test("loop schedule: callback work does not accumulate into the fixed period", () => {
    const interval = 1000 / 64;
    const loop = new LoopSchedule(interval);
    loop.reset(100);
    let startedAt = 100;
    for (let tick = 0; tick < 128; tick++) {
        const work = 5 + (tick % 4);
        const finishedAt = startedAt + work;
        startedAt = finishedAt + loop.nextDelay(finishedAt);
        assert.equal(startedAt, 100 + (tick + 1) * interval);
    }
    assert.equal(startedAt - 100, 2000);
});

test("loop schedule: long stalls yield once and do not queue historical deadlines", () => {
    const loop = new LoopSchedule(40);
    loop.reset(0);
    assert.equal(loop.nextDelay(4), 36);
    assert.equal(loop.nextDelay(5000), 0);
    assert.equal(loop.nextDelay(5003), 37);
    assert.equal(loop.nextDelay(5045), 35);
});

test("loop schedule: restart begins a fresh deadline", () => {
    const loop = new LoopSchedule(40);
    loop.reset(100);
    assert.equal(loop.nextDelay(120), 20);
    loop.reset(2000);
    assert.equal(loop.nextDelay(2005), 35);
    assert.throws(() => new LoopSchedule(0), RangeError);
});
