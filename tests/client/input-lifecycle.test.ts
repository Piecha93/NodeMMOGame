import assert from "node:assert/strict";
import { test } from "node:test";
import { InputHandler } from "../../client/input/InputHandler";
import { Cursor } from "../../client/input/Cursor";
import { Transform } from "../../shared/game_utils/physics/Transform";
import { InputSnapshot } from "../../shared/input/InputSnapshot";

class WindowProbe extends EventTarget {
    readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
    override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
        if (listener) {
            let listeners = this.listeners.get(type);
            if (!listeners) this.listeners.set(type, (listeners = new Set()));
            listeners.add(listener);
        }
        super.addEventListener(type, listener);
    }
    override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
        if (listener) this.listeners.get(type)?.delete(listener);
        super.removeEventListener(type, listener);
    }
}

test("input lifecycle: blur cancels held mouse repeats and dispose removes exact listeners", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const browser = new WindowProbe();
    const names = ["window", "HTMLInputElement", "HTMLTextAreaElement", "HTMLElement"] as const;
    const previous = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
    Object.defineProperty(globalThis, "window", { value: browser, configurable: true });
    for (const name of names.slice(1)) Object.defineProperty(globalThis, name, { value: class {}, configurable: true });
    t.after(() => {
        for (const [name, descriptor] of previous) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
    });
    const input = new InputHandler(new Cursor(new Transform([100, 100])));
    const snapshots: InputSnapshot[] = [];
    input.addSnapshotCallback((snapshot) => snapshots.push(snapshot));
    const mouse = new Event("mousedown");
    Object.defineProperty(mouse, "button", { value: 0 });
    browser.dispatchEvent(mouse);
    assert.equal(snapshots.length, 1);
    browser.dispatchEvent(new Event("blur"));
    t.mock.timers.tick(1000);
    assert.equal(snapshots.length, 1, "a mouse-only blur must stop repeated actions");
    browser.dispatchEvent(mouse);
    assert.equal(snapshots.length, 2);
    input.dispose();
    input.dispose();
    t.mock.timers.tick(1000);
    assert.equal(snapshots.length, 2);
    assert.equal(
        [...browser.listeners.values()].reduce((count, listeners) => count + listeners.size, 0),
        0,
    );
});

test("input lifecycle: clicking a button or its descendants cannot fire a game action", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const browser = new WindowProbe();
    class HtmlProbe {
        closest() {
            return this;
        }
    }
    const names = ["window", "HTMLInputElement", "HTMLTextAreaElement", "HTMLElement"] as const;
    const previous = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
    Object.defineProperty(globalThis, "window", { value: browser, configurable: true });
    Object.defineProperty(globalThis, "HTMLElement", { value: HtmlProbe, configurable: true });
    for (const name of ["HTMLInputElement", "HTMLTextAreaElement"])
        Object.defineProperty(globalThis, name, { value: class {}, configurable: true });
    t.after(() => {
        for (const [name, descriptor] of previous) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
    });
    const input = new InputHandler(new Cursor(new Transform([100, 100])));
    const snapshots: InputSnapshot[] = [];
    input.addSnapshotCallback((snapshot) => snapshots.push(snapshot));
    const mouse = new Event("mousedown");
    Object.defineProperty(mouse, "button", { value: 0 });
    Object.defineProperty(mouse, "target", { value: new HtmlProbe() });
    browser.dispatchEvent(mouse);
    t.mock.timers.tick(500);
    assert.equal(snapshots.length, 0);
    input.dispose();
});
