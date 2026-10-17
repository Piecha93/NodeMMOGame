import assert from "node:assert/strict";
import test from "node:test";
import { Body } from "detect-collisions";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Collider } from "../../shared/game_utils/physics/Collider";
import { Collision } from "../../shared/game_utils/physics/Collision";
import { CollisionsSystem } from "../../shared/game_utils/physics/CollisionsSystem";
import { Transform } from "../../shared/game_utils/physics/Transform";

type ContactEvent = readonly [source: string, event: "enter" | "stay" | "exit", target: string];

class OrderedProbe extends GameObject {
    onEnter?: (collision: Collision) => void;
    onStay?: (collision: Collision) => void;
    onExit?: (collision: Collision) => void;

    constructor(
        readonly label: string,
        private readonly events: ContactEvent[],
        x = 0,
        y = 0,
        size: [number, number] = [10, 10],
    ) {
        super(new Transform([x, y], size));
    }

    protected override sharedOnCollisionEnter(collision: Collision): void {
        this.events.push([this.label, "enter", (collision.ColliderB.Parent as OrderedProbe).label]);
        this.onEnter?.(collision);
    }

    protected override sharedOnCollisionStay(collision: Collision): void {
        this.events.push([this.label, "stay", (collision.ColliderB.Parent as OrderedProbe).label]);
        this.onStay?.(collision);
    }

    protected override sharedOnCollisionExit(collision: Collision): void {
        this.events.push([this.label, "exit", (collision.ColliderB.Parent as OrderedProbe).label]);
        this.onExit?.(collision);
    }
}

interface ContactState {
    bodyToColliderMap: Map<Body, Collider>;
    collidingBodiesMap: Map<Body, Set<Body>>;
    incomingCollidingBodiesMap: Map<Body, Set<Body>>;
}

function insert(system: CollisionsSystem, object: GameObject): void {
    object.addDestroyListener(() => system.removeObject(object));
    system.insertObject(object);
}

function assertContactIndices(system: CollisionsSystem): void {
    const state = system as unknown as ContactState;
    const incoming = new Map<Body, Set<Body>>();
    for (const [source, targets] of state.collidingBodiesMap) {
        assert.ok(state.bodyToColliderMap.has(source), "a contact source remains registered");
        for (const target of targets) {
            assert.ok(state.bodyToColliderMap.has(target), "a contact target remains registered");
            let sources = incoming.get(target);
            if (!sources) incoming.set(target, (sources = new Set()));
            sources.add(source);
        }
    }
    assert.equal(state.incomingCollidingBodiesMap.size, incoming.size);
    for (const [target, sources] of state.incomingCollidingBodiesMap) {
        assert.ok(sources.size > 0, "empty incoming sets do not retain bodies");
        assert.deepEqual(sources, incoming.get(target), "incoming contacts exactly mirror published outgoing contacts");
    }
}

function orderedTargets(system: CollisionsSystem, source: OrderedProbe): OrderedProbe[] {
    system.update();
    const state = system as unknown as ContactState;
    return source.Colliders[0].Body.potentials().map(
        (body) => state.bodyToColliderMap.get(body)!.Parent as OrderedProbe,
    );
}

function contactEvents(
    source: OrderedProbe,
    targets: readonly OrderedProbe[],
    firstEvent: "enter" | "stay" = "enter",
): ContactEvent[] {
    return targets.flatMap((target) =>
        firstEvent === "enter"
            ? ([
                  [source.label, "enter", target.label],
                  [source.label, "stay", target.label],
              ] as ContactEvent[])
            : ([[source.label, "stay", target.label]] as ContactEvent[]),
    );
}

test("collision order: moving the source in enter invalidates later narrowphase results within the same pass", () => {
    const system = new CollisionsSystem();
    const events: ContactEvent[] = [];
    const source = new OrderedProbe("source", events);
    const targets = [
        new OrderedProbe("a", events, 2),
        new OrderedProbe("b", events, 3),
        new OrderedProbe("c", events, 4),
    ];
    for (const object of [source, ...targets]) insert(system, object);
    try {
        const ordered = orderedTargets(system, source);
        assert.equal(ordered.length, 3);
        source.onEnter = () => {
            source.Transform.X = 1000;
            source.updateColliders();
        };
        system.updateCollisionsForGameObject(source);
        assert.deepEqual(events, contactEvents(source, [ordered[0]]));
        assertContactIndices(system);
        system.update();
        system.updateCollisionsForGameObject(source);
        assert.deepEqual(events.at(-1), ["source", "exit", ordered[0].label]);
        assertContactIndices(system);
    } finally {
        for (const object of [source, ...targets]) object.destroy();
    }
    assertContactIndices(system);
});

for (const mutation of ["move", "resize", "rotate"] as const) {
    test(`collision order: ${mutation} of a later target in enter changes its same-pass collision`, () => {
        const system = new CollisionsSystem();
        const events: ContactEvent[] = [];
        const source = new OrderedProbe("source", events);
        const targets = ["a", "b", "c"].map((label) => new OrderedProbe(label, events, 8, 0, [10, 4]));
        for (const object of [source, ...targets]) insert(system, object);
        try {
            const ordered = orderedTargets(system, source);
            assert.equal(ordered.length, 3);
            const later = ordered[1];
            source.onEnter = (collision) => {
                if (collision.ColliderB.Parent !== ordered[0]) return;
                if (mutation === "move") later.Transform.X = 1000;
                else if (mutation === "resize") later.Transform.ScaleX = 2;
                else later.Transform.Rotation = Math.PI / 2;
                later.updateColliders();
            };
            system.updateCollisionsForGameObject(source);
            assert.deepEqual(events, contactEvents(source, [ordered[0], ordered[2]]));
            assertContactIndices(system);
        } finally {
            for (const object of [source, ...targets]) object.destroy();
        }
        assertContactIndices(system);
    });
}

test("collision order: destroying the entered target skips its stay and preserves later contacts", () => {
    const system = new CollisionsSystem();
    const events: ContactEvent[] = [];
    const source = new OrderedProbe("source", events);
    const targets = [
        new OrderedProbe("a", events, 2),
        new OrderedProbe("b", events, 3),
        new OrderedProbe("c", events, 4),
    ];
    for (const object of [source, ...targets]) insert(system, object);
    try {
        const ordered = orderedTargets(system, source);
        source.onEnter = (collision) => {
            if (collision.ColliderB.Parent === ordered[0]) ordered[0].destroy();
            assertContactIndices(system);
        };
        source.onStay = () => assertContactIndices(system);
        system.updateCollisionsForGameObject(source);
        assert.deepEqual(events, [["source", "enter", ordered[0].label], ...contactEvents(source, ordered.slice(1))]);
        assertContactIndices(system);
    } finally {
        for (const object of [source, ...targets]) object.destroy();
    }
    assertContactIndices(system);
});

test("contact lifecycle: reentrant source/target removals and repeated removal leave both indices empty", () => {
    const system = new CollisionsSystem();
    const events: ContactEvent[] = [];
    const source = new OrderedProbe("source", events);
    const target = new OrderedProbe("target", events, 2);
    const tail = new OrderedProbe("tail", events, 4);
    for (const object of [source, target, tail]) insert(system, object);
    system.update();
    system.updateCollisions([source, target, tail]);
    assertContactIndices(system);
    target.addDestroyListener(() => {
        assertContactIndices(system);
        system.removeObject(source);
        system.removeObject(source);
        tail.destroy();
        assertContactIndices(system);
    });
    target.destroy();
    system.removeObject(target);
    source.destroy();
    assertContactIndices(system);
    const state = system as unknown as ContactState;
    assert.equal(state.bodyToColliderMap.size, 0);
    assert.equal(state.collidingBodiesMap.size, 0);
    assert.equal(state.incomingCollidingBodiesMap.size, 0);
});

test("contact lifecycle: exit callback destruction and thrown stay callbacks retain consistent indices", () => {
    const system = new CollisionsSystem();
    const events: ContactEvent[] = [];
    const source = new OrderedProbe("source", events);
    const target = new OrderedProbe("target", events, 2);
    for (const object of [source, target]) insert(system, object);
    try {
        system.update();
        source.onStay = () => {
            assertContactIndices(system);
            throw new Error("custom stay failed");
        };
        assert.throws(() => system.updateCollisionsForGameObject(source), /custom stay failed/);
        assertContactIndices(system);
        source.onStay = undefined;
        system.updateCollisionsForGameObject(source);
        assert.deepEqual(events, [
            ["source", "enter", "target"],
            ["source", "stay", "target"],
            ["source", "stay", "target"],
        ]);
        target.Transform.X = 1000;
        target.updateColliders();
        system.update();
        source.onExit = () => {
            assertContactIndices(system);
            target.destroy();
            source.destroy();
            assertContactIndices(system);
        };
        system.updateCollisionsForGameObject(source);
        assert.deepEqual(events.at(-1), ["source", "exit", "target"]);
        assertContactIndices(system);
    } finally {
        source.destroy();
        target.destroy();
    }
});

for (const event of ["enter", "stay"] as const) {
    test(`contact lifecycle: reentrant ${event} keeps the recursively published contact set authoritative`, () => {
        const system = new CollisionsSystem();
        const events: ContactEvent[] = [];
        const source = new OrderedProbe("source", events);
        const first = new OrderedProbe("first", events, 2);
        const second = new OrderedProbe("second", events, 3);
        const objects = [source, first, second];
        for (const object of objects) insert(system, object);
        try {
            const ordered = orderedTargets(system, source);
            const removed = ordered[1];
            let reentered = false;
            const reenter = () => {
                if (reentered) return;
                reentered = true;
                removed.Transform.X = 1000;
                removed.updateColliders();
                system.updateCollisionsForGameObject(source);
                assertContactIndices(system);
            };
            if (event === "enter") source.onEnter = reenter;
            else source.onStay = reenter;
            system.updateCollisionsForGameObject(source);
            assert.equal(reentered, true);
            assertContactIndices(system);
            removed.destroy();
            ordered[0].destroy();
            assertContactIndices(system);
            const state = system as unknown as ContactState;
            assert.equal(state.collidingBodiesMap.get(source.Colliders[0].Body)?.size, 0);
            assert.equal(state.incomingCollidingBodiesMap.size, 0);
        } finally {
            for (const object of objects) object.destroy();
        }
        assertContactIndices(system);
    });
}

test("contact lifecycle: multi-collider objects remove every directed incoming and outgoing edge", () => {
    const system = new CollisionsSystem();
    const events: ContactEvent[] = [];
    const source = new OrderedProbe("source", events);
    const target = new OrderedProbe("target", events, 2);
    source.addCollider(8).IsTriger = true;
    target.addCollider(8).IsTriger = true;
    for (const object of [source, target]) insert(system, object);
    try {
        system.update();
        system.updateCollisions([source, target]);
        assertContactIndices(system);
        const state = system as unknown as ContactState;
        assert.equal(state.collidingBodiesMap.size, 4);
        for (const contacts of state.collidingBodiesMap.values()) assert.equal(contacts.size, 2);
        target.destroy();
        system.removeObject(target);
        assertContactIndices(system);
        assert.equal(state.collidingBodiesMap.size, 2);
        for (const contacts of state.collidingBodiesMap.values()) assert.equal(contacts.size, 0);
        assert.equal(state.incomingCollidingBodiesMap.size, 0);
    } finally {
        source.destroy();
        target.destroy();
    }
    assertContactIndices(system);
});

test("contact lifecycle: removing a body visits only its sparse incoming contacts", () => {
    const system = new CollisionsSystem();
    const events: ContactEvent[] = [];
    const pairs = Array.from(
        { length: 128 },
        (_, index) =>
            [
                new OrderedProbe(`source-${index}`, events, index * 100),
                new OrderedProbe(`target-${index}`, events, index * 100 + 2),
            ] as const,
    );
    const objects = pairs.flatMap((pair) => [...pair]);
    for (const object of objects) insert(system, object);
    try {
        system.update();
        system.updateCollisions(objects);
        assert.equal(events.length, pairs.length * 4);
        assertContactIndices(system);
        const state = system as unknown as ContactState;
        const removed = pairs[64][1];
        const removedBody = removed.Colliders[0].Body;
        let deleteAttempts = 0;
        for (const contacts of state.collidingBodiesMap.values()) {
            const original = contacts.delete;
            contacts.delete = function (body: Body): boolean {
                if (body === removedBody) deleteAttempts++;
                return original.call(this, body);
            };
        }
        removed.destroy();
        assert.equal(deleteAttempts, 1, "unrelated contact sets are not scanned when one sparse target disappears");
        assertContactIndices(system);
        events.length = 0;
        system.updateCollisions(objects);
        assert.equal(events.length, (pairs.length - 1) * 2);
        assert.ok(events.every(([, event]) => event === "stay"));
        assertContactIndices(system);
    } finally {
        for (const object of objects) object.destroy();
    }
    assertContactIndices(system);
});
