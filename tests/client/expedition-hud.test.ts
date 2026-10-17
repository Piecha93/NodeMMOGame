import assert from "node:assert/strict";
import { test } from "node:test";
import { ExpeditionHud, expeditionTime, expeditionView } from "../../client/graphic/ExpeditionHud";
import { canvasPointerPosition } from "../../client/graphic/Camera";
import { ExpeditionState } from "../../shared/gameplay/Expedition";

function state(overrides: Partial<ExpeditionState> = {}): ExpeditionState {
    return {
        round: 1,
        phase: "active",
        remainingMs: 480_000,
        collected: 0,
        total: 6,
        kills: 0,
        wave: 1,
        waveStage: "combat",
        enemiesRemaining: 4,
        stageRemainingMs: 0,
        home: { x: 640, y: 640, radius: 110 },
        camps: [],
        party: [{ id: "A0", name: "Zwiadowca", hp: 80, maxHp: 100, respawnInMs: 0 }],
        ...overrides,
    };
}

class ElementProbe extends EventTarget {
    readonly dataset: Record<string, string> = {};
    readonly attributes = new Map<string, string>();
    textContent = "";
    className = "";
    hidden = false;
    disabled = false;
    children: ElementProbe[] = [];
    min = 0;
    max = 0;
    value = 0;
    readonly elements = new Map<string, ElementProbe>();
    readonly ownerDocument = {
        createElement: (_tag: string) => new ElementProbe(),
        getElementById: (_id: string) => this.debug,
    };
    debug: ElementProbe | null = null;
    querySelector(selector: string): ElementProbe | null {
        return this.elements.get(selector) ?? null;
    }
    setAttribute(key: string, value: string): void {
        this.attributes.set(key, value);
    }
    append(...elements: ElementProbe[]): void {
        this.children.push(...elements);
    }
    replaceChildren(...elements: ElementProbe[]): void {
        this.children = elements;
    }
    field(name: string): ElementProbe {
        const element = new ElementProbe();
        this.elements.set(`[data-expedition='${name}']`, element);
        return element;
    }
}

function dom() {
    const root = new ElementProbe();
    const names = [
        "restart",
        "debug",
        "progress",
        "kills",
        "round",
        "party",
        "camps",
        "result",
        "result-title",
        "result-copy",
        "result-label",
        "leave",
        "timer",
        "objective",
        "guidance",
        "bearing",
        "distance",
        "respawn",
        "respawn-time",
    ];
    const fields = new Map(names.map((name) => [name, root.field(name)]));
    const field = (name: string) => {
        const element = fields.get(name);
        assert.ok(element, `Missing test DOM field ${name}`);
        return element;
    };
    return { root, field };
}

test("expedition HUD: invalid transport data leaves progress unchanged and names stay text", () => {
    const { root, field } = dom();
    const hud = new ExpeditionHud(
        root as unknown as HTMLElement,
        () => {},
        () => 0,
    );
    hud.setLocalPlayer("A0");
    assert.equal(
        hud.receive(
            state({ party: [{ id: "A0", name: "<img src=x onerror=alert(1)>", hp: 80, maxHp: 100, respawnInMs: 0 }] }),
        ),
        true,
    );
    assert.equal(field("progress").textContent, "0 / 6");
    assert.equal(field("party").children[0].children[0].textContent, "<img src=x onerror=alert(1)> · Ty");
    assert.equal(field("party").children[0].children[1].value, 80);
    assert.equal(hud.receive({ ...state(), collected: 7 }), false);
    assert.equal(hud.receive({ ...state(), remainingMs: Number.NaN }), false);
    assert.equal(hud.receive({ ...state(), waveStage: "fortress" }), false);
    assert.equal(field("progress").textContent, "0 / 6");
    hud.dispose();
});

test("expedition HUD: restart is allowed once for a finished round and listeners are released", () => {
    const { root, field } = dom();
    let requests = 0;
    const hud = new ExpeditionHud(
        root as unknown as HTMLElement,
        () => requests++,
        () => 0,
    );
    const click = () => field("restart").dispatchEvent(new Event("click"));
    hud.receive(state());
    click();
    assert.equal(requests, 0);
    hud.receive(state({ phase: "won", collected: 6, wave: 6, waveStage: "complete", enemiesRemaining: 0 }));
    assert.equal(field("result").hidden, false);
    click();
    click();
    hud.receive(state({ phase: "won", collected: 6, wave: 6, waveStage: "complete", enemiesRemaining: 0 }));
    click();
    assert.equal(requests, 1, "a repeated server state must not re-enable a pending restart");
    assert.equal(field("restart").disabled, true);
    hud.receive(state({ round: 2 }));
    assert.equal(field("result").hidden, true);
    hud.receive(state({ round: 2, phase: "lost" }));
    click();
    assert.equal(requests, 2);
    hud.dispose();
    hud.dispose();
    click();
    assert.equal(requests, 2);
    assert.equal(hud.receive(state()), false);
});

test("expedition HUD: countdown is presentation only and death waits for authoritative respawn", () => {
    const { root, field } = dom();
    let now = 0;
    const hud = new ExpeditionHud(
        root as unknown as HTMLElement,
        () => {},
        () => now,
    );
    hud.setLocalPlayer("A0");
    hud.receive(state({ remainingMs: 5000, party: [{ id: "A0", name: "A", hp: 0, maxHp: 100, respawnInMs: 3000 }] }));
    now = 2100;
    hud.update([640, 640]);
    assert.equal(field("timer").textContent, "0:03");
    assert.equal(field("respawn-time").textContent, "1");
    assert.equal(field("respawn").hidden, false);
    now = 20_000;
    hud.update([640, 640]);
    assert.equal(field("timer").textContent, "0:00");
    assert.equal(field("respawn").hidden, false, "a local clock cannot revive the player");
    assert.equal(field("result").hidden, true, "a local clock cannot end the round");
    hud.receive(state());
    assert.equal(field("respawn").hidden, true);
    hud.dispose();
});

test("expedition HUD: connection errors retain bounded text, prevent restart and offer the exit", () => {
    const { root, field } = dom();
    let restarts = 0;
    const hud = new ExpeditionHud(
        root as unknown as HTMLElement,
        () => restarts++,
        () => 0,
    );
    hud.receive(state({ phase: "won", collected: 6, wave: 6, waveStage: "complete", enemiesRemaining: 0 }));
    const message = "<script>" + "x".repeat(300);
    hud.showConnectionError(message);
    hud.showConnectionError("Generic disconnect");
    assert.equal(field("result").hidden, false);
    assert.equal(field("result-copy").textContent, message.slice(0, 256));
    assert.equal(field("restart").hidden, true);
    assert.equal(field("leave").hidden, false);
    field("restart").dispatchEvent(new Event("click"));
    assert.equal(restarts, 0);
    assert.equal(hud.receive(state()), false, "late gameplay updates cannot hide an admission error");
    hud.dispose();
    assert.equal(field("result-copy").textContent, message.slice(0, 256), "cleanup retains the actionable error panel");
});

test("village HUD: combat counts the actual survivors and preparation/rest only display server countdowns", () => {
    const combat = expeditionView(state());
    assert.equal(combat.objective, "Fala 1 / 6");
    assert.equal(combat.bearing, "4");
    assert.equal(combat.distance, "przeciwników");
    const preparation = expeditionView(
        state({ wave: 0, waveStage: "preparing", stageRemainingMs: 15_000, enemiesRemaining: 0 }),
        1100,
    );
    assert.equal(preparation.bearing, "14 s");
    assert.match(preparation.guidance, /Pierwsza fala/);
    const rest = expeditionView(
        state({ waveStage: "rest", stageRemainingMs: 20_000, enemiesRemaining: 0, collected: 1 }),
        2300,
    );
    assert.equal(rest.bearing, "18 s");
    assert.equal(rest.distance, "do fali 2");
    assert.match(rest.guidance, /30 zdrowia/);
    assert.equal(
        expeditionView(state({ waveStage: "rest", stageRemainingMs: 20_000 }), 50_000).bearing,
        "0 s",
        "the presentation cannot start the next wave",
    );
    const victory = expeditionView(
        state({ phase: "won", collected: 6, wave: 6, waveStage: "complete", enemiesRemaining: 0 }),
    );
    assert.equal(victory.objective, "Polana obroniona!");
    assert.equal(victory.distance, "6 / 6 fal");
    assert.equal(expeditionTime(480_000), "8:00");
    assert.equal(expeditionTime(-1), "0:00");
});

test("canvas aim: CSS shrinking preserves aim coordinates and clamps UI pointer positions", () => {
    const rect = { left: 100, top: 50, width: 512, height: 288 };
    assert.deepEqual(canvasPointerPosition(356, 194, rect, 1024, 576), [512, 288]);
    assert.deepEqual(canvasPointerPosition(612, 338, rect, 1024, 576), [1024, 576]);
    assert.deepEqual(canvasPointerPosition(0, 0, rect, 1024, 576), [0, 0]);
    assert.deepEqual(canvasPointerPosition(100, 50, { ...rect, width: 0 }, 1024, 576), [512, 288]);
});
