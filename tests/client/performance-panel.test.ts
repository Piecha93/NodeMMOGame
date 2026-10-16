import assert from "node:assert/strict";
import { test } from "node:test";
import { PerformancePanel } from "../../client/graphic/PerformancePanel";
import { PERFORMANCE_MAX_ENEMIES, PerformanceEvents, PerformanceState } from "../../shared/gameplay/Performance";

class ElementProbe extends EventTarget {
    textContent = "";
    value = "";
    disabled = false;
    readonly elements = new Map<string, ElementProbe>();
    readonly controls: ElementProbe[] = [];
    querySelector(selector: string): ElementProbe | null {
        return this.elements.get(selector) ?? null;
    }
    querySelectorAll(_selector: string): ElementProbe[] {
        return this.controls;
    }
    add(selector: string, value = ""): ElementProbe {
        const element = new ElementProbe();
        element.value = value;
        this.elements.set(selector, element);
        return element;
    }
}

function fixture() {
    const root = new ElementProbe();
    const form = root.add("[data-performance-form]");
    const clear = root.add("[data-performance-clear]");
    const count = root.add("[name=count]", "500");
    const distribution = root.add("[name=distribution]", "world");
    const scenario = root.add("[name=scenario]", "moving");
    root.controls.push(clear, count, distribution, scenario, new ElementProbe());
    form.controls.push(...root.controls);
    const fields = new Map(
        [
            "status",
            "fps",
            "correction",
            "rendered",
            "known",
            "enemies",
            "objects",
            "chunks",
            "tick",
            "budget",
            "dropped",
            "traffic",
            "simulation-hz",
            "snapshot-hz",
            "snapshot-cpu",
        ].map((key) => [key, root.add(`[data-performance="${key}"]`)]),
    );
    const field = (key: string): ElementProbe => {
        const element = fields.get(key);
        assert.ok(element);
        return element;
    };
    const handlers = new Map<string, (value: unknown) => void>();
    const requests: Array<{ event: string; value: unknown }> = [];
    const socket = {
        emit(event: string, value: unknown) {
            requests.push({ event, value });
        },
        on(event: string, handler: (value: unknown) => void) {
            handlers.set(event, handler);
        },
        off(event: string, handler: (value: unknown) => void) {
            if (handlers.get(event) === handler) handlers.delete(event);
        },
    };
    let now = 0;
    const panel = new PerformancePanel(socket, root as unknown as HTMLElement, () => now);
    const advance = (milliseconds: number) => {
        now += milliseconds;
    };
    return { root, form, clear, count, handlers, requests, field, panel, advance };
}

const state: PerformanceState = {
    count: 2000,
    distribution: "world",
    scenario: "moving",
    enemies: 2000,
    pending: 0,
    objects: 2001,
    activeChunks: 25,
    totalChunks: 25,
    serverTick: 100,
    tickP50Ms: 2,
    tickP95Ms: 4,
    tickSamples: 256,
    tickBudgetMs: 15.625,
    droppedTimeMs: 0,
    snapshotBytesPerSecond: 1024,
    simulationHz: 63.5,
    snapshotHz: 25,
    snapshotP95Ms: 17.123,
};

test("performance panel: submit/clear are throttled and disposal removes command listeners", () => {
    const { root, form, clear, handlers, requests, panel, advance } = fixture();
    const submit = () => form.dispatchEvent(new Event("submit", { cancelable: true }));
    assert.equal(submit(), false, "the form must not navigate away from the game");
    clear.dispatchEvent(new Event("click"));
    submit();
    assert.deepEqual(requests, [
        { event: PerformanceEvents.CONFIGURE, value: { count: 500, distribution: "world", scenario: "moving" } },
    ]);
    assert.ok(
        root.controls.every((control) => control.disabled),
        "all setup controls wait for the throttle",
    );
    advance(1000);
    panel.updateFrame(250, 0, 0);
    assert.ok(root.controls.every((control) => !control.disabled));
    clear.dispatchEvent(new Event("click"));
    assert.deepEqual(requests.at(-1)?.value, { count: 0, distribution: "world", scenario: "moving" });
    panel.dispose();
    panel.dispose();
    advance(1000);
    submit();
    clear.dispatchEvent(new Event("click"));
    assert.equal(requests.length, 2);
    assert.equal(handlers.size, 0);
    assert.ok(
        root.controls.every((control) => control.disabled),
        "disposed controls cannot create commands",
    );
});

test("performance panel: arbitrary integer counts and the maximum are sent without rounding", () => {
    const { form, count, requests, panel, advance } = fixture();
    for (const value of [0, 1, 137, 12_345, PERFORMANCE_MAX_ENEMIES]) {
        count.value = String(value);
        form.dispatchEvent(new Event("submit", { cancelable: true }));
        assert.deepEqual(requests.at(-1)?.value, { count: value, distribution: "world", scenario: "moving" });
        advance(1000);
    }
    panel.dispose();
});

test("performance panel: invalid typed counts do not throw, emit or throttle a corrected request", () => {
    const { form, clear, count, requests, field, panel } = fixture();
    for (const value of ["", " ", "-1", "1.5", "NaN", "Infinity", String(PERFORMANCE_MAX_ENEMIES + 1)]) {
        count.value = value;
        assert.doesNotThrow(() => form.dispatchEvent(new Event("submit", { cancelable: true })));
        assert.equal(requests.length, 0);
        assert.match(field("status").textContent, /całkowitą liczbę/);
    }
    // Clearing remains available even when the number field is invalid.
    clear.dispatchEvent(new Event("click"));
    assert.deepEqual(requests[0]?.value, { count: 0, distribution: "world", scenario: "moving" });
    panel.dispose();
});

test("performance panel: server/client counts stay distinct and a connection failure survives late state/frame updates", () => {
    const { root, form, handlers, requests, field, panel, advance } = fixture();
    const receive = handlers.get(PerformanceEvents.STATE);
    assert.ok(receive);
    receive(state);
    for (let frame = 0; frame < 15; frame++) panel.updateFrame(1000 / 60, 90, 340);
    panel.updateFrame(1000 / 60, 90, 340);
    assert.equal(field("enemies").textContent, "2000 / 2000");
    assert.equal(field("rendered").textContent, "90");
    assert.equal(field("known").textContent, "340");
    assert.equal(field("fps").textContent, "60");
    assert.equal(field("tick").textContent, "2.00 / 4.00 ms");
    assert.equal(field("traffic").textContent, "1.0 KiB/s");
    assert.equal(field("simulation-hz").textContent, "63.5 Hz");
    assert.equal(field("snapshot-hz").textContent, "25.0 Hz");
    assert.equal(field("snapshot-cpu").textContent, "17.12 ms");
    receive({ ...state, enemies: Number.NaN });
    assert.equal(field("enemies").textContent, "2000 / 2000");
    for (const key of ["simulationHz", "snapshotHz", "snapshotP95Ms"]) {
        receive({ ...state, [key]: Number.NaN, enemies: 100 });
        receive({ ...state, [key]: -1, enemies: 100 });
    }
    assert.equal(field("enemies").textContent, "2000 / 2000", "invalid telemetry must not replace the state");
    panel.showConnectionError("Poligon rozłączony");
    advance(2000);
    receive(state);
    panel.updateFrame(500, 0, 0);
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    assert.equal(requests.length, 0);
    assert.equal(field("status").textContent, "Poligon rozłączony");
    assert.ok(root.controls.every((control) => control.disabled));
    panel.dispose();
    assert.equal(field("status").textContent, "Poligon rozłączony");
});

test("performance panel: correction keeps the last distance and a one-second peak without frame-by-frame DOM writes", () => {
    const { field, panel, advance } = fixture();
    panel.updateCorrection(8);
    assert.equal(field("correction").textContent, "");
    advance(250);
    panel.updateFrame(250, 0, 0);
    assert.equal(field("correction").textContent, "8.0 / 8.0 px");
    panel.updateCorrection(0);
    panel.updateCorrection(-1);
    panel.updateCorrection(Number.NaN);
    panel.updateCorrection(Number.POSITIVE_INFINITY);
    assert.equal(field("correction").textContent, "8.0 / 8.0 px");
    advance(250);
    panel.updateFrame(250, 0, 0);
    assert.equal(field("correction").textContent, "0.0 / 8.0 px");
    advance(500);
    panel.updateFrame(500, 0, 0);
    assert.equal(field("correction").textContent, "0.0 / 0.0 px");
    panel.updateCorrection(0.125);
    advance(250);
    panel.updateFrame(250, 0, 0);
    assert.equal(field("correction").textContent, "0.1 / 0.1 px");
    panel.dispose();
    panel.updateCorrection(99);
    panel.updateFrame(250, 0, 0);
    assert.equal(field("correction").textContent, "0.1 / 0.1 px");
});
