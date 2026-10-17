import assert from "node:assert/strict";
import { test } from "node:test";
import { AdventureHud } from "../../client/graphic/AdventureHud";
import {
    AdventurePlayerState,
    AdventureState,
    PurchaseId,
    UpgradeId,
    UPGRADES,
    WeaponId,
    WEAPONS,
} from "../../shared/gameplay/Adventure";

class ElementProbe extends EventTarget {
    readonly dataset: Record<string, string> = {};
    readonly attributes = new Map<string, string>();
    readonly elements = new Map<string, ElementProbe>();
    textContent = "";
    disabled = false;
    hidden = false;
    title = "";
    value = 0;
    max = 0;
    querySelector(selector: string): ElementProbe | null {
        return this.elements.get(selector) ?? null;
    }
    setAttribute(key: string, value: string): void {
        this.attributes.set(key, value);
    }
    add(selector: string): ElementProbe {
        const element = new ElementProbe();
        this.elements.set(selector, element);
        return element;
    }
    click(): void {
        this.dispatchEvent(new Event("click"));
    }
}

function player(overrides: Partial<AdventurePlayerState> = {}): AdventurePlayerState {
    return {
        id: "A0",
        level: 3,
        xp: 12,
        xpToNext: 50,
        points: 2,
        coins: 18,
        weapon: "ember",
        upgrades: { power: 0, haste: 0, vitality: 0, stride: 0 },
        ...overrides,
    };
}

function state(overrides: Partial<AdventureState> = {}): AdventureState {
    return {
        round: 1,
        wave: 2,
        stage: "combat",
        remainingEnemies: 4,
        nextWaveInMs: 0,
        players: [player()],
        ...overrides,
    };
}

function fixture() {
    const root = new ElementProbe();
    const fields = new Map(
        ["level", "xp", "xp-bar", "coins", "points", "wave", "wave-time", "notice", "shop"].map((name) => [
            name,
            root.add(`[data-adventure='${name}']`),
        ]),
    );
    const weapons = new Map(
        WEAPONS.map(({ id }) => {
            const element = root.add(`[data-adventure-weapon='${id}']`);
            element.add("[data-weapon-detail]");
            return [id, element];
        }),
    );
    const upgrades = new Map(
        UPGRADES.map(({ id }) => {
            const element = root.add(`[data-adventure-upgrade='${id}']`);
            element.add("[data-upgrade-rank]");
            return [id, element];
        }),
    );
    const purchases = new Map<PurchaseId, ElementProbe>(
        ["heal", "training"].map((id) => [id as PurchaseId, root.add(`[data-adventure-purchase='${id}']`)]),
    );
    const requests: Array<UpgradeId | WeaponId | PurchaseId> = [];
    const hud = new AdventureHud(
        root as unknown as HTMLElement,
        (id) => requests.push(id),
        (id) => requests.push(id),
        (id) => requests.push(id),
    );
    const field = (name: string): ElementProbe => {
        const result = fields.get(name);
        assert.ok(result);
        return result;
    };
    const weapon = (id: WeaponId): ElementProbe => {
        const result = weapons.get(id);
        assert.ok(result);
        return result;
    };
    const upgrade = (id: UpgradeId): ElementProbe => {
        const result = upgrades.get(id);
        assert.ok(result);
        return result;
    };
    const purchase = (id: PurchaseId): ElementProbe => {
        const result = purchases.get(id);
        assert.ok(result);
        return result;
    };
    return { root, hud, field, weapon, upgrade, purchase, requests };
}

test("adventure HUD: a late local ID selects the player's authoritative progression, invalid states do not render", () => {
    const { hud, field, upgrade, requests } = fixture();
    assert.equal(hud.update(state()), true);
    upgrade("power").click();
    assert.deepEqual(requests, []);
    hud.setLocalPlayerId("A0");
    assert.equal(field("level").textContent, "3");
    assert.equal(field("xp").textContent, "12 / 50 PD");
    assert.equal(field("xp-bar").value, 12);
    assert.equal(field("xp-bar").max, 50);
    assert.equal(field("coins").textContent, "18");
    assert.equal(field("wave-time").textContent, "Pozostało: 4");
    assert.equal(hud.update(state({ players: [player({ xp: Number.NaN })] })), false);
    assert.equal(hud.update(state({ players: [player({ points: 999 })] })), false);
    assert.equal(field("xp").textContent, "12 / 50 PD");
    hud.dispose();
});

test("adventure HUD: locked weapons and missing upgrade points are enforced even after DOM manipulation", () => {
    const { hud, weapon, upgrade, requests } = fixture();
    hud.setLocalPlayerId("A0");
    hud.update(state({ players: [player({ level: 1, xp: 0, xpToNext: 20, points: 0 })] }));
    assert.equal(weapon("scatter").disabled, true);
    assert.match(weapon("scatter").attributes.get("aria-label") ?? "", /od poziomu 2/);
    weapon("scatter").disabled = false;
    weapon("scatter").dataset.locked = "false";
    weapon("scatter").click();
    upgrade("power").disabled = false;
    upgrade("power").click();
    weapon("ember").click();
    assert.deepEqual(requests, []);
    hud.dispose();
});

test("adventure HUD: upgrade requests cannot spend points or alter stats until acknowledged", () => {
    const { hud, field, upgrade, requests } = fixture();
    hud.setLocalPlayerId("A0");
    hud.update(state());
    upgrade("power").click();
    upgrade("power").click();
    assert.deepEqual(requests, ["power"]);
    assert.equal(upgrade("power").querySelector("[data-upgrade-rank]")?.textContent, "0 / 5");
    assert.equal(field("points").textContent, "2 punkty rozwoju");
    assert.equal(upgrade("haste").disabled, true);
    hud.update(state());
    upgrade("haste").click();
    assert.deepEqual(requests, ["power"], "an unchanged server state cannot release a pending request");
    hud.update(state({ players: [player({ points: 1, upgrades: { power: 1, haste: 0, vitality: 0, stride: 0 } })] }));
    assert.equal(upgrade("power").querySelector("[data-upgrade-rank]")?.textContent, "1 / 5");
    assert.equal(field("points").textContent, "1 punkt rozwoju");
    assert.equal(upgrade("haste").disabled, false);
    hud.dispose();
});

test("adventure HUD: selected weapons change only with a server acknowledgement", () => {
    const { hud, weapon, requests } = fixture();
    hud.setLocalPlayerId("A0");
    hud.update(state());
    weapon("scatter").click();
    weapon("lance").click();
    assert.deepEqual(requests, ["scatter"]);
    assert.equal(weapon("ember").attributes.get("aria-pressed"), "true");
    assert.equal(weapon("scatter").attributes.get("aria-pressed"), "false");
    hud.update(state({ players: [player({ weapon: "scatter" })] }));
    assert.equal(weapon("ember").attributes.get("aria-pressed"), "false");
    assert.equal(weapon("scatter").attributes.get("aria-pressed"), "true");
    assert.equal(weapon("lance").disabled, false);
    hud.dispose();
});

test("adventure HUD: a refused request times out and cleanup cancels pending UI work", (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const { hud, field, upgrade, requests } = fixture();
    hud.setLocalPlayerId("A0");
    hud.update(state());
    upgrade("power").click();
    context.mock.timers.tick(1500);
    assert.equal(upgrade("power").disabled, false);
    assert.match(field("notice").textContent, /ponownie/);
    upgrade("power").click();
    assert.deepEqual(requests, ["power", "power"]);
    hud.dispose();
    hud.dispose();
    const notice = field("notice").textContent;
    context.mock.timers.tick(5000);
    upgrade("power").click();
    assert.equal(upgrade("power").disabled, true);
    assert.deepEqual(requests, ["power", "power"]);
    assert.equal(field("notice").textContent, notice);
    assert.equal(hud.update(state()), false);
});

test("adventure HUD: round changes release old requests and stale round packets are ignored", () => {
    const { hud, upgrade, field } = fixture();
    hud.setLocalPlayerId("A0");
    hud.update(state());
    upgrade("power").click();
    hud.update(state({ round: 2 }));
    assert.equal(upgrade("power").disabled, false);
    assert.equal(hud.update(state({ players: [player({ coins: 55 })] })), false);
    assert.equal(field("coins").textContent, "18");
    hud.dispose();
});

test("adventure HUD: connection errors stay bounded text, disable choices and reject late packets", () => {
    const { hud, field, upgrade, weapon, requests } = fixture();
    hud.setLocalPlayerId("A0");
    hud.update(state());
    const message = "<script>" + "x".repeat(300);
    hud.setConnectionError(message);
    hud.setConnectionError("Another disconnect");
    assert.equal(field("notice").textContent, message.slice(0, 256));
    assert.equal(upgrade("power").disabled, true);
    assert.equal(weapon("scatter").disabled, true);
    upgrade("power").click();
    weapon("scatter").click();
    assert.deepEqual(requests, []);
    assert.equal(hud.update(state()), false);
    hud.dispose();
    assert.equal(field("notice").textContent, message.slice(0, 256));
});

test("adventure HUD: maximum experience stays full and capped upgrades cannot consume remaining points", () => {
    const { hud, field, upgrade, requests } = fixture();
    hud.setLocalPlayerId("A0");
    hud.update(
        state({
            players: [
                player({
                    level: 20,
                    xp: 0,
                    xpToNext: 0,
                    points: 1,
                    upgrades: { power: 5, haste: 5, vitality: 5, stride: 3 },
                }),
            ],
        }),
    );
    assert.equal(field("xp").textContent, "MAKSYMALNY POZIOM");
    assert.equal(field("xp-bar").value, field("xp-bar").max);
    assert.equal(upgrade("power").disabled, true);
    assert.equal(upgrade("stride").disabled, false);
    upgrade("power").disabled = false;
    upgrade("power").click();
    assert.deepEqual(requests, []);
    hud.dispose();
});

test("adventure HUD: finished or waiting expeditions disable choices until the next active round", () => {
    const { hud, root, upgrade, weapon, requests } = fixture();
    hud.setLocalPlayerId("A0");
    hud.update(state());
    hud.setActive(false);
    assert.equal(root.dataset.points, "false");
    assert.equal(upgrade("power").disabled, true);
    assert.equal(weapon("scatter").disabled, true);
    upgrade("power").click();
    weapon("scatter").click();
    assert.deepEqual(requests, []);
    hud.setActive(true);
    assert.equal(root.dataset.points, "true");
    assert.equal(upgrade("power").disabled, false);
    assert.equal(weapon("scatter").disabled, false);
    hud.dispose();
});

test("village shop: only preparation and rest allow purchases, regardless of manipulated buttons", () => {
    const { hud, field, purchase, requests } = fixture();
    hud.setLocalPlayerId("A0");
    hud.setHealth(100, 200);
    hud.update(state());
    assert.equal(field("shop").hidden, true);
    purchase("training").disabled = false;
    purchase("training").click();
    assert.deepEqual(requests, []);
    hud.update(state({ stage: "preparing", wave: 0, remainingEnemies: 0, nextWaveInMs: 15_000 }));
    assert.equal(field("shop").hidden, false);
    assert.equal(purchase("heal").disabled, false);
    hud.setActive(false);
    assert.equal(field("shop").hidden, true);
    purchase("heal").click();
    assert.deepEqual(requests, []);
    hud.dispose();
});

test("village shop: prices, level cap and authoritative acknowledgements prevent repeated or optimistic purchases", () => {
    const { hud, field, purchase, requests } = fixture();
    hud.setLocalPlayerId("A0");
    hud.setHealth(100, 200);
    const rest = { stage: "rest", remainingEnemies: 0, nextWaveInMs: 12_000 } as const;
    hud.update(state({ ...rest, players: [player({ coins: 5 })] }));
    assert.equal(purchase("heal").disabled, true);
    purchase("heal").disabled = false;
    purchase("heal").click();
    assert.deepEqual(requests, []);
    hud.update(state(rest));
    purchase("heal").click();
    purchase("heal").click();
    purchase("training").click();
    assert.deepEqual(requests, ["heal"]);
    assert.equal(field("coins").textContent, "18");
    hud.update(state(rest));
    assert.equal(purchase("heal").disabled, true, "unchanged packets cannot acknowledge a purchase");
    hud.update(state({ ...rest, players: [player({ coins: 19 })] }));
    assert.equal(purchase("heal").disabled, true, "collecting another coin is not a purchase acknowledgement");
    hud.update(state({ ...rest, players: [player({ coins: 12 })] }));
    assert.equal(field("coins").textContent, "12");
    assert.equal(purchase("heal").disabled, false);
    purchase("training").click();
    assert.deepEqual(requests, ["heal", "training"]);
    hud.update(state());
    assert.equal(field("shop").hidden, true);
    hud.update(state(rest));
    assert.equal(purchase("training").disabled, false, "the next wave releases old shop requests");
    hud.update(state({ ...rest, players: [player({ level: 20, xp: 0, xpToNext: 0, points: 19 })] }));
    assert.equal(purchase("training").disabled, true);
    purchase("training").disabled = false;
    purchase("training").click();
    assert.deepEqual(requests, ["heal", "training"]);
    hud.dispose();
});

test("village shop: refused purchases time out, and disposal releases their listeners and timers", (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const { hud, purchase, requests, field } = fixture();
    hud.setLocalPlayerId("A0");
    hud.setHealth(100, 200);
    hud.update(state({ stage: "rest", remainingEnemies: 0, nextWaveInMs: 12_000 }));
    purchase("heal").click();
    context.mock.timers.tick(1500);
    assert.equal(purchase("heal").disabled, false);
    assert.match(field("notice").textContent, /ponownie/);
    purchase("training").click();
    hud.dispose();
    context.mock.timers.tick(5000);
    purchase("training").click();
    assert.deepEqual(requests, ["heal", "training"]);
    assert.equal(purchase("training").disabled, true);
});

test("village shop: full health, death and unknown health cannot request healing after button tampering", () => {
    const { hud, purchase, requests } = fixture();
    hud.setLocalPlayerId("A0");
    hud.update(state({ stage: "rest", remainingEnemies: 0, nextWaveInMs: 12_000 }));
    const attempt = () => {
        assert.equal(purchase("heal").disabled, true);
        purchase("heal").disabled = false;
        purchase("heal").click();
    };
    attempt();
    hud.setHealth(200, 200);
    attempt();
    hud.setHealth(0, 200);
    attempt();
    assert.deepEqual(requests, []);
    hud.setHealth(140, 200);
    assert.equal(purchase("heal").disabled, false);
    purchase("heal").click();
    assert.deepEqual(requests, ["heal"]);
    hud.dispose();
});
