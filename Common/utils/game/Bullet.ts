import {GameObject} from "./GameObject";
import {Position} from "./Position";
import {GameObjectType} from "./GameObjectTypes";
import {ChangesDict} from "./ChangesDict";

export class Bullet extends GameObject {
    get Type(): string {
        return GameObjectType.Bullet.toString();
    }

    private directionAngle: number = 0;
    private lifeSpan = 300;

    constructor(position: Position) {
        super(position);
        this.id = this.Type + this.id;
        console.log("asd");


        if(Math.floor(Math.random() * 2)) {
            this.spriteName = "bluebolt";
            this.velocity = 1.5;
        } else {
            this.spriteName = "fireball";
            this.velocity = 0.75;
        }

        this.lifeSpan = 500;
        this.changes.add(ChangesDict.VELOCITY);
        this.changes.add(ChangesDict.LIFE_SPAN);

        this.sFunc = new Map<string, Function>(function*() { yield* Bullet.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map<string, Function>(function*() { yield* Bullet.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
    }

    public update(delta: number) {
        super.update(delta);
        this.lifeSpan -= delta;

        if(this.lifeSpan <= 0) {
            this.destroy();
        }

        let sinAngle: number = Math.sin(this.directionAngle);
        let cosAngle: number = Math.cos(this.directionAngle);

        this.position.X += cosAngle * this.velocity * delta;
        this.position.Y += sinAngle * this.velocity * delta;

        this.changes.add(ChangesDict.POSITION);
    }

    get DirectionAngle(): number {
        return this.directionAngle;
    }

    set DirectionAngle(angle: number) {
        this.directionAngle = angle;
        this.changes.add(ChangesDict.DIRECTION_ANGLE);
    }

    static serializeDirectionAngle(bullet: Bullet): string {
        return ChangesDict.buildTag(ChangesDict.DIRECTION_ANGLE) + bullet.directionAngle;
    }

    static deserializeDirectionAngle(bullet: Bullet, data: string) {
        bullet.directionAngle = parseFloat(data);
    }

    static serializeLifeSpan(bullet: Bullet): string {
        return ChangesDict.buildTag(ChangesDict.LIFE_SPAN) + bullet.lifeSpan;
    }

    static deserializeLifeSpan(bullet: Bullet, data: string) {
        bullet.lifeSpan = parseInt(data);
    }

    static SerializeFunctions: Map<string, Function> = new Map<string, Function>([
        [ChangesDict.LIFE_SPAN, Bullet.serializeLifeSpan],
        [ChangesDict.DIRECTION_ANGLE, Bullet.serializeDirectionAngle],
    ]);
    static DeserializeFunctions: Map<string, Function> = new Map<string, Function>([
        [ChangesDict.LIFE_SPAN, Bullet.deserializeLifeSpan],
        [ChangesDict.DIRECTION_ANGLE, Bullet.deserializeDirectionAngle],
    ]);
}