import {INPUT_COMMAND, MouseKeys} from "../../../input/InputCommands";
import {Transform} from "../../physics/Transform";
import {Actor} from "./Actor";
import {ChangesDict} from "../../../serialize/ChangesDict";
import {SharedConfig} from "../../../SharedConfig";
import {InputSnapshot} from "../../../input/InputSnapshot";
import {PortalGun} from "../weapons/PortalGun";
import {MagicWand} from "../weapons/MagicWand";
import {ObjectsSpawner} from "../weapons/ObjectsSpawner";
import {Collider} from "../../physics/Collider";
import {Result} from "detect-collisions";
import {GameObject} from "./GameObject";
import {Doors} from "./Doors";
import {Enemy} from "./Enemy";
import {Collision} from "../../physics/Collision";

export class Player extends Actor {
    private static onlyServerActions: Set<INPUT_COMMAND> = new Set<INPUT_COMMAND>([
        INPUT_COMMAND.LEFT_MOUSE,
        INPUT_COMMAND.RIGHT_MOUSE,
        INPUT_COMMAND.MIDDLE_MOUSE,
        INPUT_COMMAND.TEST
    ]);


    constructor(transform: Transform) {
        super(transform);

        let collider: Collider = this.addCollider([transform.ScaleX * 2, transform.ScaleY * 2]);
        collider.IsTriger = true;

        this.velocity = 0.25;

        // this.weapon = new PortalGun();
        // this.weapon = new MagicWand();
        this.weapon = new ObjectsSpawner();
        this.isChunkActivateTriger = true;
        this.isChunkFullUpdateTriger = true;
    }

    serverOnTriggerEnter(collision: Collision) {
        let gameObject: GameObject = collision.ColliderB.Parent;

        if(gameObject instanceof Doors) {
            (gameObject as Doors).open()
        } else if(gameObject instanceof Enemy) {
            gameObject.destroy();
        }
    }

    serverOnTriggerExit(collision: Collision) {
        let gameObject: GameObject = collision.ColliderB.Parent;

        if(gameObject instanceof Doors) {
            (gameObject as Doors).open()
        }
    }

    private lastInputSnapshot: InputSnapshot = null;

    public setInput(inputSnapshot: InputSnapshot) {
        let inputCommands: Map<INPUT_COMMAND, string> = inputSnapshot.Commands;

        inputCommands.forEach((value: string, key: INPUT_COMMAND) => {
            if (SharedConfig.IS_CLIENT && Player.onlyServerActions.has(key)) return;

            if (key == INPUT_COMMAND.HORIZONTAL) {
                this.Horizontal = parseFloat(value);
                this.lastInputSnapshot = inputSnapshot;
            } else if (key == INPUT_COMMAND.VERTICAL) {
                this.Vertical = parseFloat(value);
                this.lastInputSnapshot = inputSnapshot;
            } else if (key == INPUT_COMMAND.LEFT_MOUSE) {
                this.mouseClickAction(value, MouseKeys.LEFT);
            } else if (key == INPUT_COMMAND.RIGHT_MOUSE) {
                this.mouseClickAction(value, MouseKeys.RIGHT);
            } else if (key == INPUT_COMMAND.MIDDLE_MOUSE) {
                this.mouseClickAction(value, MouseKeys.MIDDLE);
            } else if (key == INPUT_COMMAND.SWITCH_WEAPON) {
                this.switchWeaponAction(value);
            } else if (key == INPUT_COMMAND.TEST) {
                this.testAction(value);
            }
        });
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

