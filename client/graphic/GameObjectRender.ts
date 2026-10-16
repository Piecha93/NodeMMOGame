import { Container } from "pixi.js";
import { GameObject } from "../../shared/game_utils/game/objects/GameObject";
import { Transform } from "../../shared/game_utils/physics/Transform";
import { smoothingFactor } from "./Presentation";

export abstract class GameObjectRender extends Container {
    public presentationPosition: readonly [number, number] | undefined;
    private object: GameObject | null = null;
    protected get objectRef(): GameObject {
        if (!this.object) throw new Error("Render object has not been bound to a game object");
        return this.object;
    }

    public get PresentationVisible(): boolean {
        return this.object !== null && !this.object.Invisible;
    }

    protected constructor() {
        super();
    }

    public setObject(gameObjectReference: GameObject) {
        this.object = gameObjectReference;
    }

    public update(deltaMs: number = 1000 / 60) {
        this.visible = this.PresentationVisible;
        const alpha = smoothingFactor(0.25, deltaMs);

        let transform: Transform = this.objectRef.Transform;

        let distance: number = Math.sqrt(Math.pow(transform.X - this.x, 2) + Math.pow(transform.Y - this.y, 2));
        if (this.presentationPosition) {
            this.x = this.presentationPosition[0];
            this.y = this.presentationPosition[1];
        } else if (distance > 200) {
            this.x = transform.X;
            this.y = transform.Y;
        } else {
            this.x = (transform.X - this.x) * alpha + this.x;
            this.y = (transform.Y - this.y) * alpha + this.y;
        }

        this.rotation = this.objectRef.Transform.Rotation;
    }

    public destroy(): void {
        super.destroy({ children: true });
    }
}
