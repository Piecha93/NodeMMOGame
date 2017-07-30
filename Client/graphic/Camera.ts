/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {Renderer} from "../../Client/graphic/Renderer";

export class Camera extends PIXI.Container {

    private follower: PIXI.Point | PIXI.ObservablePoint;
    private dt = 0.1;

    constructor(follower: PIXI.Point) {
        super();
        this.Follower = follower;

        this.position.set(Renderer.WIDTH / 2, Renderer.HEIGHT / 2);
    }

    set Follower(follower: PIXI.Point | PIXI.ObservablePoint) {
            this.follower = follower;
            this.pivot = new PIXI.Point(follower.x, follower.y);
            this.update();
    }

    update() {
        this.pivot.x = (this.follower.x - this.pivot.x) * this.dt + this.pivot.x;
        this.pivot.y = (this.follower.y - this.pivot.y) * this.dt + this.pivot.y;
    }
}