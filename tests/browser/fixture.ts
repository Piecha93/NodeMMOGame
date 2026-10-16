import { Ticker } from "pixi.js";
import { Renderer } from "../../client/graphic/Renderer";
import { GameCore } from "../../shared/GameCore";
import { Origin } from "../../shared/core/Origin";
import { Player } from "../../shared/game_utils/game/objects/Player";
import { Enemy } from "../../shared/game_utils/game/objects/Enemy";

function requireElements() {
    const status = document.getElementById("status");
    const mountArea = document.getElementById("mount");
    const metrics = document.getElementById("metrics");
    const remount = document.getElementById("remount");
    if (
        !(status instanceof HTMLOutputElement) ||
        !(mountArea instanceof HTMLDivElement) ||
        !(metrics instanceof HTMLPreElement) ||
        !(remount instanceof HTMLButtonElement)
    ) {
        throw new Error("Renderer fixture DOM is incomplete");
    }
    return { status, mountArea, metrics, remount };
}
const { status, mountArea, metrics, remount } = requireElements();

// AnimatedSprites start at frame zero and never join a running shared ticker.
Ticker.shared.autoStart = false;
Ticker.shared.stop();
let core: GameCore | null = null;
let renderer: Renderer | null = null;
let generation = 0;

function dispose(): void {
    renderer?.dispose();
    renderer = null;
    core?.dispose();
    core = null;
}

function pixelMetrics(canvas: HTMLCanvasElement) {
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Cannot read fixture pixels");
    // Called synchronously after render, while the WebGL drawing buffer exists.
    context.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    const colors = new Set<number>();
    let opaqueSamples = 0;
    for (let index = 0; index < pixels.length; index += 64) {
        const red = pixels[index] ?? 0;
        const green = pixels[index + 1] ?? 0;
        const blue = pixels[index + 2] ?? 0;
        const alpha = pixels[index + 3] ?? 0;
        colors.add((red << 24) | (green << 16) | (blue << 8) | alpha);
        if (alpha === 255) opaqueSamples++;
    }
    return { width: copy.width, height: copy.height, colors: colors.size, opaqueSamples };
}

async function mount(): Promise<void> {
    remount.disabled = true;
    status.textContent = "loading";
    try {
        dispose();
        const canvas = document.createElement("canvas");
        canvas.id = "game-canvas";
        mountArea.replaceChildren(canvas);
        const world = new GameCore({
            role: Origin.CLIENT,
            chunkSize: 640,
            numOfChunksX: 2,
            numOfChunksY: 2,
            clock: () => 0,
            random: () => 0.5,
        });
        core = world;
        const view = await Renderer.create(world.ObjectsManager, world.Runtime.config);
        renderer = view;
        await document.fonts.load("12px Arial");
        await document.fonts.ready;
        const player = world.ObjectsFactory.instantiateWithPosition("DefaultPlayer", [320, 320]);
        if (!(player instanceof Player)) throw new Error("Fixture player prefab is invalid");
        player.Name = "Fixture";
        player.hit(45);
        for (const x of [256, 288, 352, 384]) world.ObjectsFactory.instantiateWithPosition("Wall", [x, 240]);
        const enemy = world.ObjectsFactory.instantiateWithPosition("Michau", [400, 320]);
        if (!(enemy instanceof Enemy)) throw new Error("Fixture enemy prefab is invalid");
        enemy.Name = "Strażnik";
        enemy.hit(25);
        const projectile = world.ObjectsFactory.instantiateWithPosition("FireBall", [360, 350]);
        projectile.Transform.Rotation = Math.PI / 4;
        view.createHUD();
        view.FocusedObject = player;
        const chunk = world.ChunksManager.getObjectChunk(player);
        if (!chunk) throw new Error("Fixture player is outside the map");
        view.setCurrentChunk(chunk);
        // Settle the existing presentation filters with a deterministic cadence.
        for (let frame = 0; frame < 20; frame++) view.update(1000 / 60);
        const pixels = pixelMetrics(canvas);
        metrics.textContent = JSON.stringify(
            {
                ...pixels,
                objects: world.ObjectsManager.ObjectsById.size,
                name: player.Name,
                hp: player.HP,
                maxHp: player.MaxHP,
            },
            null,
            2,
        );
        status.dataset.mount = String(++generation);
        status.textContent = "ready";
    } catch (error) {
        status.textContent = "failed";
        metrics.textContent = error instanceof Error ? (error.stack ?? error.message) : String(error);
        dispose();
    } finally {
        remount.disabled = false;
    }
}

remount.addEventListener("click", () => {
    void mount();
});
window.addEventListener("pagehide", dispose, { once: true });
void mount();
