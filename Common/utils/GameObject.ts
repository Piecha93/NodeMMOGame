import {Position} from "./Position";
import {GameObjectType} from "./GameObjectTypes";
//import {SerializeFunctions, DeserializeFunctions} from "./SerializeFunctionsMap";

export abstract class GameObject {
    get Type(): string {
        return GameObjectType.GameObject.toString();
    }

    private static NEXT_ID: number = 0;

    private forceComplete: boolean = true;
    protected changes: Set<string>;
    protected id: number = GameObject.NEXT_ID++;
    protected spriteName: string;
    protected position: Position;
    protected sFunc: Map<string, Function>;
    protected dFunc: Map<string, Function>;

    constructor(position: Position) {
        this.position = position;
        this.changes = new Set<string>();

        this.sFunc = GameObject.SerializeFunctions;
        this.dFunc = GameObject.DeserializeFunctions;

        this.spriteName = "bunny";
    }

    forceCompleteUpdate() {
        this.forceComplete = true;
    }

    update() {

    }

    serialize(complete: boolean = false): string {
        let update: string = "";

        if(this.forceComplete) {
            this.forceComplete = false;
            complete = true;
        }

        if(complete) {
            this.sFunc.forEach((serializeFunc: Function) => {
                update += serializeFunc(this);
            });
        } else {
            this.changes.forEach((field: string) => {
                if (this.sFunc.has(field)) {
                    update += this.sFunc.get(field)(this);
                    this.changes.delete(field);
                }
            });
        }

        this.changes.clear();

        return update;
    }

    deserialize(update: string[]) {
        for(let item of update) {
            if(this.dFunc.has(item[0])) {
                this.dFunc.get(item[0])(this, item.split(':')[1]);
            }
        }
    }

    get Position(): Position {
        return this.position;
    }

    get ID(): number {
        return this.id;
    }

    get SpriteName(): string {
        return this.spriteName;
    }

    set SpriteName(spriteName: string) {
        this.spriteName = spriteName;
        this.changes.add("spriteName");
    }

    static serializePosition(gameObject: GameObject): string {
        return '#P:' + gameObject.Position.X.toString() + ',' + gameObject.Position.Y.toString();
    }

    static deserializePosition(gameObject: GameObject, data: string) {
        let x: string = data.split(',')[0];
        let y: string = data.split(',')[1];

        gameObject.position.X = parseFloat(x);
        gameObject.position.Y = parseFloat(y);
    }

    static serializeSpriteName(gameObject: GameObject): string {
        return '#S:' + gameObject.spriteName;
    }

    static deserializeSpriteName(gameObject: GameObject, data: string) {
        gameObject.spriteName = data;
    }

    static SerializeFunctions: Map<string, Function> = new Map<string, Function>([
        ['position', GameObject.serializePosition],
        ['spriteName', GameObject.serializeSpriteName],
    ]);
    static DeserializeFunctions: Map<string, Function> = new Map<string, Function>([
        ['P', GameObject.deserializePosition],
        ['S', GameObject.deserializeSpriteName],
    ]);
}

// SerializeFunctions.set('position', GameObject.serializePosition);
// DeserializeFunctions.set('P', GameObject.deserializePosition);
//
// SerializeFunctions.set('spriteName', GameObject.serializeSpriteName);
// DeserializeFunctions.set('S', GameObject.deserializeSpriteName);