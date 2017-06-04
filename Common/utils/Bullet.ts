import {GameObject} from "./GameObject";
import {Position} from "./Position";
import {GameObjectType} from "./GameObjectTypes";

export class Bullet extends GameObject {
    get Type(): string {
        return GameObjectType.Bullet.toString();
    }

    private velocity: number = 10;
    private direction: number = 0;

    private lifeSpan = 300;

    constructor(position: Position) {
        super(position);
        this.id = this.Type + this.id;

        this.spriteName = "bullet";

        this.lifeSpan = Math.floor(Math.random() * 150);
        this.velocity = Math.floor(Math.random() * 15) + 1;

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
        this.position.X = this.position.X + this.velocity;
        //this.changes.add('position');
    }

    static serializeVelocity(bullet: Bullet): string {
        return '#V:' + bullet.velocity;
    }

    static deserializeVelocity(bullet: Bullet, data: string) {
        bullet.velocity = parseFloat(data);
    }

    static serializeLifeSpan(bullet: Bullet): string {
        return '#L:' + bullet.lifeSpan;
    }

    static deserializeLifeSpan(bullet: Bullet, data: string) {
        bullet.lifeSpan = parseFloat(data);
    }

    static SerializeFunctions: Map<string, Function> = new Map<string, Function>([
        ['velocity', Bullet.serializeVelocity],
        ['lifeSpan', Bullet.serializeLifeSpan],
    ]);
    static DeserializeFunctions: Map<string, Function> = new Map<string, Function>([
        ['V', Bullet.deserializeVelocity],
        ['L', Bullet.deserializeLifeSpan],
    ]);
}