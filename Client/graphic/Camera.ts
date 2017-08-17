/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {Renderer} from "../../Client/graphic/Renderer";

export class Camera extends PIXI.Container {

    private follower: PIXI.Point | PIXI.ObservablePoint;
    private dt: number = 0.1;

    private mouseX: number = 0;
    private mouseY: number = 0;

    private deviationRate: number = 6;

    constructor(follower: PIXI.Point) {
        super();
        this.Follower = follower;

        this.position.set(Renderer.WIDTH / 2, Renderer.HEIGHT / 2);

        window.addEventListener("mousemove", this.onMouseMove.bind(this));
    }

    private onMouseMove(event: MouseEvent) {
        let canvas: HTMLCanvasElement = document.getElementById("game-canvas") as HTMLCanvasElement;
        let rect: ClientRect = canvas.getBoundingClientRect();

        this.mouseX = (event.x - rect.left - Renderer.WIDTH / 2) / this.deviationRate;
        this.mouseY = (event.y - rect.top - Renderer.HEIGHT / 2) / this.deviationRate;
    }

    set Follower(follower: PIXI.Point | PIXI.ObservablePoint) {
        this.follower = follower;
        this.pivot = new PIXI.Point(follower.x, follower.y);
        this.update();
    }

    update() {
        this.pivot.x += (this.follower.x + this.mouseX - this.pivot.x) * this.dt;
        this.pivot.y += (this.follower.y + this.mouseY - this.pivot.y) * this.dt;
    }
}