import {INPUT_COMMAND} from "../../../input/InputCommands";
import {Transform} from "../../physics/Transform";
import {Actor} from "./Actor";
import {ChangesDict} from "../../../serialize/ChangesDict";
import {CommonConfig} from "../../../CommonConfig";
import {InputSnapshot} from "../../../input/InputSnapshot";
import {PortalGun} from "../weapons/PortalGun";
import {MagicWand} from "../weapons/MagicWand";

export class Player extends Actor {
    private static onlyServerActions: Set<INPUT_COMMAND> = new Set<INPUT_COMMAND>([
        INPUT_COMMAND.FIRE,
        INPUT_COMMAND.FIRE_2,
        INPUT_COMMAND.WALL
    ]);


    constructor(transform: Transform) {
        super(transform);

        this.velocity = 0.25;

        // this.weapon = new PortalGun();
        this.weapon = new MagicWand();
    }

    public setInput(inputSnapshot: InputSnapshot) {
        let inputCommands: Map<INPUT_COMMAND, string> = inputSnapshot.Commands;

        inputCommands.forEach((value: string, key: INPUT_COMMAND) => {
            if (CommonConfig.IS_CLIENT && Player.onlyServerActions.has(key)) return;

            if(key == INPUT_COMMAND.MOVE_DIRECTION) {
                this.moveDirectionAction(value);
            } else if(key == INPUT_COMMAND.FIRE) {
                this.fireAction(value, 0);
            } else if(key == INPUT_COMMAND.FIRE_2) {
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

    private fireAction(angle: string, clickButton: number) {
        this.weapon.use(this, parseFloat(angle), clickButton);
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

        this.updatePosition(delta);
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
    }
}

