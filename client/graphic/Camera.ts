import {Container} from "pixi.js";
import {Renderer} from "../graphic/Renderer";

type FollowPoint = {
    x: number;
    y: number;
};

export class Camera extends Container {

    private follower: FollowPoint;
    private dt: number = 0.8;

    private mouseDeviationX: number = 0;
    private mouseDeviationY: number = 0;

    private deviationRate: number = 6;
    private readonly mouseMoveHandler = (event: MouseEvent) => this.onMouseMove(event);

    constructor(follower: FollowPoint) {
        super();
        this.Follower = follower;

        this.position.set(Renderer.WIDTH / 2, Renderer.HEIGHT / 2);

        window.addEventListener("mousemove", this.mouseMoveHandler);
    }

    private onMouseMove(event: MouseEvent) {
        let canvas: HTMLCanvasElement = document.getElementById("game-canvas") as HTMLCanvasElement;
        const rect: DOMRect = canvas.getBoundingClientRect();

        this.mouseDeviationX = (event.clientX - rect.left - Renderer.WIDTH / 2) / this.deviationRate;
        this.mouseDeviationY = (event.clientY - rect.top - Renderer.HEIGHT / 2) / this.deviationRate;
    }

    set Follower(follower: FollowPoint) {
        this.follower = follower;
        this.pivot.set(follower.x, follower.y);
        this.update();
    }

    update() {
        this.pivot.x += (this.follower.x + this.mouseDeviationX - this.pivot.x) * this.dt;
        this.pivot.y += (this.follower.y + this.mouseDeviationY - this.pivot.y) * this.dt;
    }

    get MouseDeviation(): [number, number] {
        return [this.mouseDeviationX * (this.deviationRate + 1), this.mouseDeviationY * (this.deviationRate + 1)];
    }

    public destroy(): void {
        window.removeEventListener("mousemove", this.mouseMoveHandler);
        super.destroy({children: true});
    }
}
