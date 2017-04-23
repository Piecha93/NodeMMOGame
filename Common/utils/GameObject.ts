import {Position} from "./Position";
import {GameObjectType, TypeIdMap} from "./GameObjectTypes";

const changesMap: Map<string, Function> = new Map<string, Function>([
    ['position', serializePosition]
]);

export abstract class GameObject {
    get Type(): string {
        return GameObjectType.GameObject.toString();
    }

    private static NEXT_ID: number = 0;

    protected changes: Set<string>;
    protected position: Position;
    protected id: number = GameObject.NEXT_ID++;

    constructor(position: Position) {
        this.position = position;
        this.changes = new Set<string>();
    }

    get Position(): Position {
        return this.position;
    }

    get ID(): number {
        return this.id;
    }

    update() {

    }

    serialize(complete: boolean = false): string {
        let update: string = "";

        if(complete) {
            changesMap.forEach((serializeFunc: Function) => {
                update += serializeFunc(this);
            });
        } else {
            this.changes.forEach((field: string) => {
                if (changesMap.has(field)) {
                    update += changesMap.get(field)(this);
                    this.changes.delete(field);
                }
            });
        }

        return update;
    }

    deserialize(update: string[]) {
        for(let item of update) {
            if(item.startsWith('P')) {
                this.updatePosition(item.split(':')[1]);
            }
        }
    }

    private updatePosition(data: string) {
        let x: string = data.split(',')[0];
        let y: string = data.split(',')[1];

        this.position.X = parseFloat(x);
        this.position.Y = parseFloat(y);
    }
}

function serializePosition(gameObject: GameObject): string {
    return '#P:' + gameObject.Position.X.toString() + ',' + gameObject.Position.Y.toString();
}