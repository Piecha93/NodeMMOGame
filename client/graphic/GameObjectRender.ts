/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../common/utils/game/GameObject";
import {Transform} from "../../common/utils/physics/Transform";

export abstract class GameObjectRender extends PIXI.Container {
    protected objectRef: GameObject;

    private dt: number = 0.25;

    constructor() {
        super();
    }

    public setObject(gameObjectReference: GameObject) {
        this.objectRef = gameObjectReference;
    }

    public update() {
        this.visible = !this.objectRef.Invisible;

        let transform: Transform = this.objectRef.Transform;

        let distance: number = Math.sqrt(Math.pow(transform.X - this.x, 2) + Math.pow(transform.Y - this.y, 2));
        if (distance > 200) {
            this.x = transform.X;
            this.y = transform.Y;
        } else {
            this.x = (transform.X - this.x) * this.dt + this.x;
            this.y = (transform.Y - this.y) * this.dt + this.y;
        }

        this.rotation = this.objectRef.Transform.Rotation;
    }

    public destroy() {
        super.destroy();
    }
}
