import {InputSnapshot} from "./InputSnapshot";

export class InputManager {
    private inputHistory: Map<number, InputSnapshot>;

    constructor() {
        this.inputHistory = new Map<number, InputSnapshot>();
    }

    addInputSnapshot(id: number, snapshot: InputSnapshot) {
        this.inputHistory.set(id, snapshot);
    }
}