import { Container } from "pixi.js";
import { Renderer } from "../graphic/Renderer";
import { smoothingFactor } from "./Presentation";

type FollowPoint = {
    x: number;
    y: number;
};

export class Camera extends Container {
    private follower: FollowPoint;

    private mouseDeviationX: number = 0;
    private mouseDeviationY: number = 0;

    private deviationRate: number = 6;
    private pointerPosition: [number, number] = [Renderer.WIDTH / 2, Renderer.HEIGHT / 2];
    private readonly mouseMoveHandler = (event: MouseEvent) => this.onMouseMove(event);

    constructor(follower: FollowPoint) {
        super();
        this.follower = follower;
        this.Follower = follower;

        this.position.set(Renderer.WIDTH / 2, Renderer.HEIGHT / 2);

        window.addEventListener("mousemove", this.mouseMoveHandler);
    }

    public updatePointer(event: Pick<MouseEvent, "clientX" | "clientY">): void {
        const canvas = document.getElementById("game-canvas");
        if (!(canvas instanceof HTMLCanvasElement)) return;
        const rect: DOMRect = canvas.getBoundingClientRect();

        const position = canvasPointerPosition(event.clientX, event.clientY, rect, Renderer.WIDTH, Renderer.HEIGHT);
        this.pointerPosition = position;
        this.mouseDeviationX = (position[0] - Renderer.WIDTH / 2) / this.deviationRate;
        this.mouseDeviationY = (position[1] - Renderer.HEIGHT / 2) / this.deviationRate;
    }

    private onMouseMove(event: MouseEvent) {
        this.updatePointer(event);
    }

    /** Invert the camera actually drawn on screen, including its follow smoothing. */
    get PointerWorldPosition(): [number, number] {
        return screenToWorld(this.pointerPosition, this.position, this.pivot);
    }

    set Follower(follower: FollowPoint) {
        this.follower = follower;
        this.pivot.set(follower.x, follower.y);
        this.update();
    }

    update(deltaMs: number = 1000 / 60) {
        const alpha = smoothingFactor(0.8, deltaMs);
        this.pivot.x += (this.follower.x + this.mouseDeviationX - this.pivot.x) * alpha;
        this.pivot.y += (this.follower.y + this.mouseDeviationY - this.pivot.y) * alpha;
    }

    get MouseDeviation(): [number, number] {
        return [this.mouseDeviationX * (this.deviationRate + 1), this.mouseDeviationY * (this.deviationRate + 1)];
    }

    public destroy(): void {
        window.removeEventListener("mousemove", this.mouseMoveHandler);
        super.destroy({ children: true });
    }
}

export function screenToWorld(
    pointer: readonly [number, number],
    cameraPosition: FollowPoint,
    cameraPivot: FollowPoint,
): [number, number] {
    return [pointer[0] - cameraPosition.x + cameraPivot.x, pointer[1] - cameraPosition.y + cameraPivot.y];
}

/** CSS can shrink the canvas; aim coordinates still belong to its internal viewport. */
export function canvasPointerPosition(
    clientX: number,
    clientY: number,
    rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
    width: number,
    height: number,
): [number, number] {
    if (rect.width <= 0 || rect.height <= 0) return [width / 2, height / 2];
    return [
        Math.max(0, Math.min(width, ((clientX - rect.left) / rect.width) * width)),
        Math.max(0, Math.min(height, ((clientY - rect.top) / rect.height) * height)),
    ];
}
