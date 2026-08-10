import {Container} from "pixi.js";
import {GameObject} from "../../shared/game_utils/game/objects/GameObject";
import {Transform} from "../../shared/game_utils/physics/Transform";

export abstract class GameObjectRender extends Container {
    protected objectRef: GameObject;

    private dt: number = 0.25;

    protected constructor() {
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

    public destroy(): void {
        super.destroy({children: true});
    }
}
