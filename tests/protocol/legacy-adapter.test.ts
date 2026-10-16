import assert from "node:assert/strict";
import { test } from "node:test";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/SharedConfig";
import { ReplicatedState } from "../../shared/core/ReplicatedState";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { createDefaultPrefabCatalog } from "../../shared/game_utils/factory/RegisterGameObjectPrefabs";
import { Transform } from "../../shared/game_utils/physics/Transform";
import { legacyView } from "../../shared/replication/LegacyView";
import { LegacyV1Decoder } from "../../shared/serialize/LegacyV1Decoder";
import { splitLegacyFrames } from "../../shared/serialize/LegacyV1Frames";
import { ObjectsSerializer } from "../../shared/serialize/ObjectsSerializer";
import { ProtocolDecodeError } from "../../shared/serialize/ProtocolDecodeError";
import { Serializable } from "../../shared/serialize/Serializable";

let constructed = 0;
class PersistentObject extends GameObject {
    constructor(transform: Transform) {
        super(transform);
        constructed++;
        this.isChunkDeactivationPersistent = true;
    }
}

function catalog() {
    const result = createDefaultPrefabCatalog();
    result.Register("Persistent", PersistentObject, { spriteName: "wall" }, "P");
    return result;
}

function concat(...buffers: ArrayBuffer[]): ArrayBuffer {
    const bytes = new Uint8Array(buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0));
    let offset = 0;
    for (const buffer of buffers) {
        bytes.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
    }
    return bytes.buffer;
}

test("protocol/legacy adapter: domain state exposes no codec methods or decorator metadata", () => {
    const object = new GameObject(new Transform([100, 100]));
    object.ID = "C42";
    const keysBefore = Reflect.ownKeys(object);
    assert.ok(object instanceof ReplicatedState);
    assert.equal(object instanceof Serializable, false);
    assert.equal("serialize" in object, false);
    assert.equal("SerializeFunctions" in GameObject.prototype, false);
    const view = legacyView(object);
    assert.equal(legacyView(object), view);
    const bytes = new ArrayBuffer(view.calcNeededBufferSize(true));
    assert.equal(view.serialize(new DataView(bytes), 0, true), bytes.byteLength);
    assert.deepEqual(Reflect.ownKeys(object), keysBefore);
    assert.equal("serialize" in object.Transform, false);
});

test("protocol/legacy adapter: preflight never constructs entities and rejects a malformed chunk before publishing", () => {
    const source = new GameCore({ prefabs: catalog() });
    const target = new GameCore({ role: Origin.CLIENT, prefabs: catalog() });
    try {
        const object = source.ObjectsFactory.instantiateWithPosition("Persistent", [100, 100]);
        const record = ObjectsSerializer.serializeObject(object).buffer as ArrayBuffer;
        const malformed = concat(record, Uint8Array.of(0x5a, 0, 0, 0, 1).buffer);
        const before = constructed;
        assert.throws(() => target.decodeUpdate(malformed), ProtocolDecodeError);
        assert.equal(constructed, before);
        assert.equal(target.ObjectsManager.ObjectsById.size, 0);
        assert.throws(
            () => ObjectsSerializer.deserializeChunkFrames([record, malformed], target.ObjectsFactory),
            ProtocolDecodeError,
        );
        assert.equal(constructed, before);
        assert.equal(target.ObjectsManager.ObjectsById.size, 0);
    } finally {
        source.dispose();
        target.dispose();
    }
});

test("protocol/legacy adapter: 4097 tombstones split into decoder-compatible bounded sections", () => {
    const target = new GameCore({ role: Origin.CLIENT });
    try {
        const frames = splitLegacyFrames(
            [],
            Array.from({ length: 4097 }, (_, id) => `C${id}`),
        );
        assert.equal(frames.length, 2);
        const decoded = new LegacyV1Decoder(target.ObjectsFactory).preflightFrames(frames);
        assert.deepEqual(
            decoded.map(({ plan }) => plan.tombstones.length),
            [4096, 1],
        );
        assert.doesNotThrow(() => target.decodeUpdateFrames(frames));
    } finally {
        target.dispose();
    }
});

test("protocol/legacy adapter: a large chunk splits updates and persistence without consuming state on wrapper failure", () => {
    const source = new GameCore({ prefabs: catalog() });
    const target = new GameCore({ role: Origin.CLIENT, prefabs: catalog() });
    try {
        source.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [1100, 1100]);
        let last: GameObject | undefined;
        for (let index = 0; index < 4097; index++) {
            last = source.ObjectsFactory.instantiateWithPosition("Persistent", [
                100 + (index % 100) * 10,
                100 + Math.floor(index / 100) * 10,
            ]);
        }
        assert.ok(last);
        const chunk = source.ChunksManager.getObjectChunk(last);
        assert.ok(chunk);
        assert.throws(() => source.collectUpdate(), ProtocolDecodeError);
        assert.ok(legacyView(last).calcNeededBufferSize(false) > 0);
        const frames = source.collectUpdateFrames().get(chunk);
        assert.ok(frames);
        assert.equal(frames.length, 2);
        assert.doesNotThrow(() => target.decodeUpdateFrames(frames));
        assert.equal(target.ObjectsManager.ObjectsById.size, 4098);
        assert.equal(source.collectUpdateFrames().size, 0);

        chunk.deactivate();
        assert.equal(source.ObjectsManager.ObjectsById.size, 0);
        chunk.activate();
        assert.equal(source.ObjectsManager.ObjectsById.size, 4097);
        assert.equal(source.ObjectsManager.get(last.ID)?.Transform.X, last.Transform.X);
    } finally {
        source.dispose();
        target.dispose();
    }
});
