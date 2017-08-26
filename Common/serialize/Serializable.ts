import {PropName} from "./NetworkDecorators";

export class Serializable {
    protected forceComplete: boolean;
    protected changes: Set<string>;
    protected deserializedFields: Set<string>;

    constructor() {
        this.changes = new Set<string>();
        this.deserializedFields = new Set<string>();
        this.forceComplete = true;
    }

    public addChange(change: string) {
        this.changes.add(change);
    }

    get DeserializedFields():Set<string> {
        return this.deserializedFields;
    }

    public serialize(complete: boolean = false): string {
        if (this.forceComplete) {
            this.forceComplete = false;
            complete = true;
        }

        let updateArray: Array<string> = [];

        if(this[PropName.SerializeFunctions]) {
            if (complete) {
                this[PropName.SerializeFunctions].forEach((serializeFunc: Function, short_key: string) => {
                    let index: number = this[PropName.SerializeEncodeOrder].get(short_key);
                    updateArray[index] = serializeFunc(this);
                });
            } else {
                this.changes.forEach((shortKey: string) => {
                    if (this[PropName.SerializeFunctions].has(shortKey)) {
                        let index: number = this[PropName.SerializeEncodeOrder].get(shortKey);
                        updateArray[index] = this[PropName.SerializeFunctions].get(shortKey)(this);
                        this.changes.delete(shortKey);
                    }
                });
            }
        }

        if(this[PropName.NestedNetworkObjects]) {
            this[PropName.NestedNetworkObjects].forEach((key: string, short_key: string) => {
                let index: number = this[PropName.SerializeEncodeOrder].get(short_key);
                let data: string = this[key].serialize(complete);
                if(data != "") {
                    updateArray[index] = "<" + data +">";
                }
            });
        }

        let update: string = "";
        let lastFiledIndex = 0;
        for(let i = 0; i < this[PropName.SerializeEncodeOrder].size; i++) {
            if(updateArray[i] != null) {
                update += updateArray[i];
                lastFiledIndex = update.length + 1;
            }
            if(i < this[PropName.SerializeEncodeOrder].size - 1) {
                update += "|";
            }
        }

        this.changes.clear();
        return update.substr(0, lastFiledIndex);
    }

    public deserialize(update: string) {
        let decodeIdx: number = 0;
        this.deserializedFields.clear();
        while (update) {
            let short_key = this[PropName.SerializeDecodeOrder].get(decodeIdx++);
            let idx1 = update.indexOf('|');
            let idx2 = update.indexOf('<');
            if (idx2 == -1 || idx1 <= idx2) {
                let data: string = update.split('|', 1)[0];
                if(data) {
                    this[PropName.DeserializeFunctions].get(short_key)(this, data);
                    this.deserializedFields.add(short_key);
                }
                if(idx1 != -1) {
                    update = update.substr(idx1 + 1, update.length);
                } else {
                    update = null;
                }
            } else {
                let bracketEnd: number = update.indexOf('>', idx2);
                let data: string = update.split('>', 1)[0].slice(1);
                if(data) {
                    let key: string = this[PropName.NestedNetworkObjects].get(short_key);
                    this[key].deserialize(data);
                }
                update = update.substr(bracketEnd + 2, update.length)
            }
        }
    }
}