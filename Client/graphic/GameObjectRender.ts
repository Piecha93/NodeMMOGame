/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {GameObject} from "../../Common/utils/game/GameObject";
import {Transform} from "../../Common/utils/physics/Transform";

export abstract class GameObjectRender extends PIXI.Container {
    protected objectReference: GameObject;

    private dt: number = 0.4;

    constructor() {
        super();
    }

    public setObject(gameObjectReference: GameObject) {
        this.objectReference = gameObjectReference;
    }

    public update() {

       let transform: Transform = this.objectReference.Transform;

       if(Math.abs(transform.X - this.x) > 50) {
           this.x = transform.X;
       } else {
           this.x = (transform.X - this.x) * this.dt + this.x;
       }
        if(Math.abs(transform.Y - this.y) > 50) {
            this.y = transform.Y;
        } else {
            this.y = (transform.Y - this.y) * this.dt + this.y;
        }

       this.rotation = this.objectReference.Transform.Rotation;
    }

    public destroy() {
        super.destroy();
    }
}
