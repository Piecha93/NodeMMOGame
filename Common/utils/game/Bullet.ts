import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {GameObjectType} from "./GameObjectTypes";
import {ChangesDict} from "./ChangesDict";
import {Player} from "./Player";

export class Bullet extends GameObject {
    get Type(): string {
        return GameObjectType.Bullet.toString();
    }

    private lifeSpan: number = 300;

    private owner: string;

    constructor(transform: Transform) {
        super(transform);
        this.id = this.Type + this.id;

        if(Math.floor(Math.random() * 2)) {
            this.spriteName = "bluebolt";
            this.velocity = 1.4;
        } else {
            this.spriteName = "fireball";
            this.velocity = 0.7;
        }

        this.spriteName = "flame";
        this.velocity = 0.7;

        this.transform.Width = 48;
        this.transform.Height = 32;

        this.lifeSpan = 5000;
        this.changes.add(ChangesDict.VELOCITY);
        this.changes.add(ChangesDict.LIFE_SPAN);

        this.sFunc = new Map<string, Function>(function*() { yield* Bullet.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map<string, Function>(function*() { yield* Bullet.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
    }

    onCollisionEnter(gameObject: GameObject, response?: SAT.Response) {
        if(gameObject.Type == GameObjectType.Bullet.toString()) {
            if((gameObject as Bullet).owner != this.owner) {
                this.destroy();
            }
       } else if(gameObject.Type == GameObjectType.Obstacle.toString()) {
            this.transform.X += response.overlapV.x * 1.2;
            this.transform.Y += response.overlapV.y * 1.2;

            if(response.overlapN.x) {
                this.Transform.Rotation = Math.PI - this.Transform.Rotation;
            } else {
                this.Transform.Rotation = 2*Math.PI - this.Transform.Rotation;
            }

            this.changes.add(ChangesDict.ROTATION);
            this.changes.add(ChangesDict.POSITION);
        } else if(gameObject.Type == GameObjectType.Player.toString()) {
            if(gameObject.ID != this.owner) {
                this.destroy()
            }
        }
    }

    get Owner(): string {
        return this.owner;
    }

    set Owner(value: string) {
        this.owner = value;
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);

        this.lifeSpan -= delta;

        if(this.lifeSpan <= 0) {
            this.destroy();
        }
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        let sinAngle: number = Math.sin(this.transform.Rotation);
        let cosAngle: number = Math.cos(this.transform.Rotation);

        this.oldTransform.X = this.transform.X;
        this.oldTransform.Y = this.transform.Y;

        this.transform.X += cosAngle * this.velocity * delta;
        this.transform.Y += sinAngle * this.velocity * delta;

        //this.changes.add(ChangesDict.POSITION);
    }

    static serializeLifeSpan(bullet: Bullet): string {
        return ChangesDict.buildTag(ChangesDict.LIFE_SPAN) + bullet.lifeSpan;
    }

    static deserializeLifeSpan(bullet: Bullet, data: string) {
        bullet.lifeSpan = parseInt(data);
    }

    static SerializeFunctions: Map<string, Function> = new Map<string, Function>([
        [ChangesDict.LIFE_SPAN, Bullet.serializeLifeSpan]
    ]);
    static DeserializeFunctions: Map<string, Function> = new Map<string, Function>([
        [ChangesDict.LIFE_SPAN, Bullet.deserializeLifeSpan]
    ]);
}