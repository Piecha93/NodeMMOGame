import assert from "node:assert/strict";
import { test } from "node:test";
import { canvasPointerPosition, screenToWorld } from "../../client/graphic/Camera";
import { projectileAim } from "../../shared/core/Aiming";
import { Origin } from "../../shared/core/Origin";
import { GameCore } from "../../shared/GameCore";
import { FireBall } from "../../shared/game_utils/game/objects/FireBall";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { MouseKeys } from "../../shared/input/InputCommands";

test("aiming: scaled canvas coordinates invert the rendered camera, including follow lag and look ahead", () => {
    const rect = { left: 100, top: 50, width: 512, height: 288 };
    const pointer = canvasPointerPosition(550, 140, rect, 1024, 576);
    assert.deepEqual(pointer, [900, 180]);
    const target = screenToWorld(pointer, { x: 512, y: 288 }, { x: 715, y: 440 });
    assert.deepEqual(target, [1103, 332]);
    // A player at (700, 400) may be rendered elsewhere during reconciliation. Its simulation
    // position is deliberately absent from this inverse: the crosshair must stay under the mouse.
    const onScreen = [target[0] - 715 + 512, target[1] - 440 + 288];
    assert.deepEqual(onScreen, pointer);
});

test("aiming: the muzzle uses the body centre and every heading continues exactly through the target", () => {
    const center = [600, 800] as const;
    for (const [dx, dy] of [
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [-1, -1],
        [0, -1],
        [1, -1],
    ]) {
        const target: [number, number] = [center[0] + dx * 100, center[1] + dy * 100];
        const aim = projectileAim(center, target, [32, 32]);
        assert.ok(aim);
        const distance = Math.hypot(...[aim.position[0] - center[0], aim.position[1] - center[1]]);
        assert.ok(Math.abs(distance - 4) < 1e-9);
        const remaining = Math.hypot(target[0] - aim.position[0], target[1] - aim.position[1]);
        assert.ok(Math.abs(aim.position[0] + Math.cos(aim.rotation) * remaining - target[0]) < 1e-9);
        assert.ok(Math.abs(aim.position[1] + Math.sin(aim.rotation) * remaining - target[1]) < 1e-9);
    }
    assert.equal(projectileAim(center, center, [32, 32]), null);
    assert.equal(projectileAim(center, [NaN, 0], [32, 32]), null);
    const near = projectileAim(center, [602, 800], [32, 32]);
    assert.deepEqual(near?.position, [601, 800], "a close target must not end up behind the muzzle");
});

test("aiming: the wand publishes a centred, fully oriented projectile and zero aim does not consume its cooldown", () => {
    const core = new GameCore({ role: Origin.SERVER });
    try {
        const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [600, 800]) as Player;
        const published: Array<{ position: [number, number]; rotation: number; owner: string }> = [];
        core.ObjectsManager.subscribe({
            created(object) {
                if (object instanceof FireBall)
                    published.push({
                        position: object.Transform.Position,
                        rotation: object.Transform.Rotation,
                        owner: object.Owner,
                    });
            },
        });
        player.Weapon?.use(player, [600, 800], MouseKeys.LEFT);
        assert.equal(core.ObjectsManager.ObjectsById.size, 1);
        player.Weapon?.use(player, [600, 500], MouseKeys.LEFT);
        const projectile = Array.from(core.ObjectsManager.ObjectsById.values()).find(
            (object): object is FireBall => object instanceof FireBall,
        );
        assert.ok(projectile);
        assert.deepEqual(projectile.Transform.Position, [600, 796]);
        assert.equal(projectile.Owner, player.ID);
        assert.equal(projectile.Transform.Rotation, -Math.PI / 2);
        assert.deepEqual(published, [{ position: [600, 796], rotation: -Math.PI / 2, owner: player.ID }]);
        const collider = projectile.Colliders[0];
        assert.ok(collider);
        assert.equal(collider.Body.x, 600);
        assert.equal(collider.Body.y, 796);
        core.step();
        assert.ok(projectile.Transform.Y < 796);
        assert.ok(Math.abs(projectile.Transform.X - 600) < 1e-9);
    } finally {
        core.dispose();
    }
});

test("aiming: firing while touching thin cover does not teleport the muzzle through the wall", () => {
    for (const fixedDeltaMs of [1000 / 64, 20]) {
        for (const direction of [-1, 1]) {
            const core = new GameCore({ role: Origin.SERVER, fixedDeltaMs });
            try {
                const wall = core.ObjectsFactory.instantiateWithPosition("Wall", [600 + direction * 18, 800], [2, 32]);
                const player = core.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [600, 800]) as Player;
                assert.equal(player.IsDestroyed, false);
                assert.equal(wall.IsDestroyed, false);
                player.Weapon?.use(player, [600 + direction * 100, 800], MouseKeys.LEFT);
                const projectile = Array.from(core.ObjectsManager.ObjectsById.values()).find(
                    (object): object is FireBall => object instanceof FireBall,
                );
                assert.ok(projectile);
                core.step();
                assert.equal(
                    projectile.IsDestroyed,
                    true,
                    "a point-blank shot must collide on its first simulation step",
                );
            } finally {
                core.dispose();
            }
        }
    }
});
