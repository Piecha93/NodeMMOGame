/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../Common/utils/game/GameObject";
import {Transform} from "../../Common/utils/physics/Transform";

export abstract class GameObjectRender extends PIXI.Container {
    protected objectReference: GameObject;

    constructor() {
        super();
    }

    public setObject(gameObjectReference: GameObject) {
        this.objectReference = gameObjectReference;
    }

    public update() {

       let transform: Transform = this.objectReference.Transform;

        // this.x = (transform.X - this.x) * 0.8 + this.x;
        // this.y = (transform.Y - this.y) * 0.8 + this.y;
       this.x = transform.X;
       this.y = transform.Y;
       this.rotation = this.objectReference.Transform.Rotation;
    }

    public destroy() {
    }
}
