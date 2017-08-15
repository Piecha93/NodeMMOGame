import {GameObject} from "./GameObject";
import {Transform} from "../physics/Transform";
import {GameObjectType} from "./GameObjectTypes";
import {ChangesDict} from "./ChangesDict";
import {Bullet} from "./Bullet";

export abstract class Actor extends GameObject {
    get Type(): string {
        return GameObjectType.Actor.toString();
    }

    private name: string;
    private maxHp: number;
    private hp: number;

    constructor(name: string, transform: Transform) {
        super(transform);
        this.id = this.Type + this.id;

        this.sFunc = new Map<string, Function>(function*() { yield* Actor.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map<string, Function>(function*() { yield* Actor.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
        this.name = name;

        this.maxHp = 200;
        this.hp = this.maxHp;
        this.velocity = 0.3;

        this.transform.Width = 40;
        this.transform.Height = 64;

        this.spriteName = "bunny";
    }

    protected serverCollision(gameObject: GameObject, response: SAT.Response) {
        if(gameObject.Type == GameObjectType.Bullet.toString()) {
            let bullet: Bullet = gameObject as Bullet;
            if(bullet.Owner == this.ID) {
                return;
            }
            this.hit(bullet.Power);
        }
    }

    protected commonCollision(gameObject: GameObject, response: SAT.Response) {
        if(gameObject.Type == GameObjectType.Obstacle.toString()) {
            this.transform.X += response.overlapV.x * 1.2;
            this.transform.Y += response.overlapV.y * 1.2;
        }
    }

    hit(power: number) {
        this.hp -= power;
        if(this.hp < 0) {
            this.hp = 0;
        }
        this.changes.add(ChangesDict.HP);
    }

    get MaxHP(): number {
        return this.maxHp;
    }

    get HP(): number {
        return this.hp;
    }

    get Name(): string {
        return this.name;
    }

    set Name(name: string) {
        this.name = name;
        this.changes.add(ChangesDict.NAME);
    }

    static serializeMaxHp(actor: Actor): string {
        return ChangesDict.buildTag(ChangesDict.MAX_HP) + actor.maxHp.toString();
    }

    static deserializeMaxHp(actor: Actor, data: string) {
        actor.maxHp = parseInt(data);
    }

    static serializeHp(actor: Actor): string {
        return ChangesDict.buildTag(ChangesDict.HP) + actor.HP.toString();
    }

    static deserializeHp(actor: Actor, data: string) {
        actor.hp = parseInt(data);
    }

    static serializeName(actor: Actor): string {
        return ChangesDict.buildTag(ChangesDict.NAME) +  actor.name;
    }

    static deserializeName(actor: Actor, data: string) {
        actor.name = data;
    }

    static SerializeFunctions: Map<string, Function> = new Map<string, Function>([
        [ChangesDict.MAX_HP, Actor.serializeMaxHp],
        [ChangesDict.HP, Actor.serializeHp],
        [ChangesDict.NAME, Actor.serializeName],
    ]);
    static DeserializeFunctions: Map<string, Function> = new Map<string, Function>([
        [ChangesDict.MAX_HP, Actor.deserializeMaxHp],
        [ChangesDict.HP, Actor.deserializeHp],
        [ChangesDict.NAME, Actor.deserializeName],
    ]);
}

