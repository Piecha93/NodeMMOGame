import {GameObject} from "./GameObject";
import {Position} from "./Position";
import {GameObjectType} from "./GameObjectTypes";

export class Bullet extends GameObject {
    get Type(): string {
        return GameObjectType.Bullet.toString();
    }

    private directionAngle: number;
    private lifeSpan = 300;

    constructor(position: Position) {
        super(position);
        this.id = this.Type + this.id;

        this.spriteName = "bullet";

        this.lifeSpan = Math.floor(Math.random() * 150);
        this.velocity = Math.floor(Math.random() * 15) + 1;
        this.directionAngle = Math.floor(Math.random() * 360);

        this.changes.add("velocity");
        this.changes.add("lifeSpan");

        this.sFunc = new Map<string, Function>(function*() { yield* Bullet.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map<string, Function>(function*() { yield* Bullet.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
    }

    private asd = 0;

    public update() {
        this.asd++;
        if(this.asd > this.lifeSpan) {
            this.destroy();
        }

        let sinAngle: number = Math.sin(this.directionAngle);
        let cosAngle: number = Math.cos(this.directionAngle);

        this.position.X += cosAngle * this.velocity;
        this.position.Y += sinAngle * this.velocity;
        //this.changes.add('position');
    }

    set DirectionAngle(angle: number) {
        this.directionAngle = angle;
        this.changes.add("A");
    }

    static serializeLifeSpan(bullet: Bullet): string {
        return '#L:' + bullet.lifeSpan;
    }

    static deserializeDirectionAngle(bullet: Bullet, data: string) {
        bullet.lifeSpan = parseFloat(data);
    }

    static serializeDirectionAngle(bullet: Bullet): string {
        return '#A:' + bullet.lifeSpan;
    }

    static deserializeLifeSpan(bullet: Bullet, data: string) {
        bullet.directionAngle = parseInt(data);
    }

    static SerializeFunctions: Map<string, Function> = new Map<string, Function>([
        ['lifeSpan', Bullet.serializeLifeSpan],
        ['directionAngle', Bullet.serializeDirectionAngle],
    ]);
    static DeserializeFunctions: Map<string, Function> = new Map<string, Function>([
        ['L', Bullet.deserializeLifeSpan],
        ['A', Bullet.deserializeDirectionAngle],
    ]);
}