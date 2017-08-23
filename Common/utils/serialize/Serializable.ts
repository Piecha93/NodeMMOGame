export class Serializable {
    protected forceComplete: boolean;
    protected changes: Set<string>;

    constructor() {
        this.changes = new Set<string>();
        this.forceComplete = true;
    }

    public addChange(change: string) {
        this.changes.add(change);
    }

    public serialize(complete: boolean = false): string {
        let update: string = "";

        if (this.forceComplete) {
            this.forceComplete = false;
            complete = true;
        }

        if (complete) {
            this['SerializeFunctions'].forEach((serializeFunc: Function) => {
                update += serializeFunc(this);
            });
        } else {
            this.changes.forEach((field: string) => {
                if (this['SerializeFunctions'].has(field)) {
                    update += this['SerializeFunctions'].get(field)(this);
                    this.changes.delete(field);
                }
            });
        }
        if(this['NestedNetworkObjects']) {
            for (let key of this['NestedNetworkObjects']) {
                update += this[key].serialize(complete);
            }
        }
        this.changes.clear();

        return update;
    }

    public deserialize(update: string[]) {
        for (let item of update) {
            if (this['DeserializeFunctions'].has(item[0])) {
                this['DeserializeFunctions'].get(item[0])(this, item.split(':')[1]);
            }
            if(this['NestedNetworkObjects']) {
                for (let key of this['NestedNetworkObjects']) {
                    this[key].deserialize(update);
                }
            }
        }
    }
}