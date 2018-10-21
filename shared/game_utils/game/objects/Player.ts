import {INPUT_COMMAND} from "../../../input/InputCommands";
import {Transform} from "../../physics/Transform";
import {Actor} from "./Actor";
import {ChangesDict} from "../../../serialize/ChangesDict";
import {SharedConfig} from "../../../SharedConfig";
import {InputSnapshot} from "../../../input/InputSnapshot";
import {PortalGun} from "../weapons/PortalGun";
import {MagicWand} from "../weapons/MagicWand";
import {ObjectsSpawner} from "../weapons/ObjectsSpawner";

export class Player extends Actor {
    private static onlyServerActions: Set<INPUT_COMMAND> = new Set<INPUT_COMMAND>([
        INPUT_COMMAND.LEFT_MOUSE,
        INPUT_COMMAND.RIGHT_MOUSE,
        INPUT_COMMAND.MIDDLE_MOUSE,
        INPUT_COMMAND.TEST
    ]);


    constructor(transform: Transform) {
        super(transform);

        this.velocity = 0.25;

        // this.weapon = new PortalGun();
        // this.weapon = new MagicWand();
        this.weapon = new ObjectsSpawner();
        this.isChunkActivateTriger = true;
        this.isChunkFullUpdateTriger = true;
    }

    private lastInputSnapshot: InputSnapshot = null;

    public setInput(inputSnapshot: InputSnapshot) {
        let inputCommands: Map<INPUT_COMMAND, string> = inputSnapshot.Commands;

        inputCommands.forEach((value: string, key: INPUT_COMMAND) => {
            if (SharedConfig.IS_CLIENT && Player.onlyServerActions.has(key)) return;

            if (key == INPUT_COMMAND.HORIZONTAL_UP || key == INPUT_COMMAND.HORIZONTAL_DOWN) {
                this.setHorizontalInput(parseFloat(value), key);
                this.lastInputSnapshot = inputSnapshot;
            } else if (key == INPUT_COMMAND.VERTICAL_LEFT || key == INPUT_COMMAND.VERTICAL_RIGHT) {
                this.setVerticalInput(parseFloat(value), key);
                this.lastInputSnapshot = inputSnapshot;
            } else if (key == INPUT_COMMAND.LEFT_MOUSE) {
                this.mouseClickAction(value, 0);
            } else if (key == INPUT_COMMAND.RIGHT_MOUSE) {
                this.mouseClickAction(value, 2);
            } else if (key == INPUT_COMMAND.MIDDLE_MOUSE) {
                this.mouseClickAction(value, 1);
            } else if (key == INPUT_COMMAND.SWITCH_WEAPON) {
                this.switchWeaponAction(value);
            } else if (key == INPUT_COMMAND.TEST) {
                this.testAction(value);
            }
        });
    }

    private horizontalInput: [number, number] = [0, 0];
    private verticalInput: [number, number] = [0, 0];

    private setHorizontalInput(value: number, key) {
        let idx: number = key == INPUT_COMMAND.HORIZONTAL_DOWN ? 0 : 1;

        this.horizontalInput[idx] = value;

        if(value != 0) {
            this.Horizontal = this.horizontalInput[idx];
        } else {
            this.Horizontal = this.horizontalInput[idx == 0 ? 1 : 0];
        }
    }
    private setVerticalInput(value: number, key) {
        let idx: number = key == INPUT_COMMAND.VERTICAL_LEFT ? 0 : 1;

        this.verticalInput[idx] = value;

        if(value != 0) {
            this.Vertical = this.verticalInput[idx];
        } else {
            this.Vertical = this.verticalInput[idx == 0 ? 1 : 0];
        }
    }

    private mouseClickAction(position: string, clickButton: number) {
        let splited: number[] = position.split(',').map((val: string) => {return parseFloat(val)});
        this.weapon.use(this, [splited[0], splited[1]], clickButton);
        // for(let i = 0; i < 8; i++) {
        //     this.weapon.use(this, Math.random() * 7, clickButton);
        // }
    }

    private switchWeaponAction(value) {
        if(this.weapon instanceof ObjectsSpawner) {
            this.weapon = new MagicWand();
        } else {
            this.weapon = new ObjectsSpawner();
        }
    }

    private testAction(value) {
        // this.invisible = !this.invisible;
        // this.addChange("INV");
        this.velocity += 0.8;
        if(this.velocity > 2) {
            this.velocity = 0.25;
        }
        this.addChange(ChangesDict.VELOCITY);
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        if(this.lastInputSnapshot) {
            this.lastInputSnapshot.setSnapshotDelta();
        }

        this.updatePosition(delta);
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
    }
}

