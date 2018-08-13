import {INPUT_COMMAND} from "../../../input/InputCommands";
import {Transform} from "../../physics/Transform";
import {Actor} from "./Actor";
import {ChangesDict} from "../../../serialize/ChangesDict";
import {CommonConfig} from "../../../CommonConfig";
import {InputSnapshot} from "../../../input/InputSnapshot";
import {PortalGun} from "../weapons/PortalGun";
import {MagicWand} from "../weapons/MagicWand";
import {ObjectsSpawner} from "../weapons/ObjectsSpawner";

export class Player extends Actor {
    private static onlyServerActions: Set<INPUT_COMMAND> = new Set<INPUT_COMMAND>([
        INPUT_COMMAND.LEFT_MOUSE,
        INPUT_COMMAND.RIGHT_MOUSE,
        INPUT_COMMAND.WALL
    ]);


    constructor(transform: Transform) {
        super(transform);

        this.velocity = 0.25;

        // this.weapon = new PortalGun();
        // this.weapon = new MagicWand();
        this.weapon = new ObjectsSpawner();
    }

    private lastInputSnapshot: InputSnapshot = null;

    public setInput(inputSnapshot: InputSnapshot) {
        let inputCommands: Map<INPUT_COMMAND, string> = inputSnapshot.Commands;

        inputCommands.forEach((value: string, key: INPUT_COMMAND) => {
            if (CommonConfig.IS_CLIENT && Player.onlyServerActions.has(key)) return;

            if(key == INPUT_COMMAND.MOVE_DIRECTION) {
                this.moveDirectionAction(value);
                this.lastInputSnapshot = inputSnapshot;
            } else if(key == INPUT_COMMAND.LEFT_MOUSE) {
                this.fireAction(value, 0);
            } else if(key == INPUT_COMMAND.RIGHT_MOUSE) {
                this.fireAction(value, 2);
            } else if(key == INPUT_COMMAND.WALL) {
                this.wallAction(value);
            }
        });
    }

    private moveDirectionAction(direction: string) {
        let newDirection: number = parseInt(direction);
        if(newDirection != this.moveDirection) {
            this.MoveDirection = parseInt(direction);
        }
    }

    private fireAction(position: string, clickButton: number) {
        let splited: number[] = position.split(',').map((val: string) => {return parseFloat(val)});
        this.weapon.use(this, [splited[0], splited[1]], clickButton);
        // for(let i = 0; i < 8; i++) {
        //     this.weapon.use(this, Math.random() * 7, clickButton);
        // }
    }

    private wallAction(coords) {
        // this.invisible = !this.invisible;
        // this.addChange("INV");
        this.velocity += 0.8;
        if(this.velocity > 2) {
            this.velocity = 0.25;
        }
        this.addChange(ChangesDict.VELOCITY);
        // FOR TEST

        // let o: Obstacle = GameObjectsFactory.Instatiate("Obstacle") as Obstacle;
        // let splited = value.split(',');
        // o.Transform.X = Number(splited[0]) + this.Transform.X;
        // o.Transform.Y = Number(splited[1]) + this.Transform.Y;
        //
        // this.Transform.addChange(ChangesDict.X);
        // this.Transform.addChange(ChangesDict.Y);
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

