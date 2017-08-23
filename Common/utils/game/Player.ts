import {INPUT_COMMAND} from "../../input/InputCommands";
import {Transform} from "../physics/Transform";
import {Bullet} from "./Bullet";
import {Actor} from "./Actor";
import {ChangesDict} from "../serialize/ChangesDict";
import {ObjectsFactory} from "./ObjectsFactory";
import {CommonConfig, Origin} from "../../CommonConfig";

export class Player extends Actor {
    private moveDirection: number = 0;
    private inputCommands: Map<INPUT_COMMAND, string> = new Map<INPUT_COMMAND, string>();

    constructor(transform: Transform) {
        super(transform);
    }

    public setInput(commands: Map<INPUT_COMMAND, string> ) {
        this.inputCommands = commands;

        if(this.inputCommands.has(INPUT_COMMAND.MOVE_DIRECTION)) {
            this.moveDirection = parseInt(this.inputCommands.get(INPUT_COMMAND.MOVE_DIRECTION));
            this.inputCommands.delete(INPUT_COMMAND.MOVE_DIRECTION);
        }

        //here starts server commands
        if(CommonConfig.ORIGIN != Origin.SERVER) {
            return;
        }

        if(this.inputCommands.has(INPUT_COMMAND.FIRE)) {
            for(let i = 0; i < 1; i++) {
                let bullet: Bullet = ObjectsFactory.CreateGameObject(Bullet) as Bullet;
                bullet.Owner = this.ID;

                bullet.Transform.Rotation = parseFloat(this.inputCommands.get(INPUT_COMMAND.FIRE));
                //bullet.Transform.Rotation = Math.floor(Math.random() * 360);

                bullet.Transform.X = this.transform.X;
                bullet.Transform.Y = this.transform.Y;
            }
            this.inputCommands.delete(INPUT_COMMAND.FIRE);
        }
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        if(this.moveDirection != 0) {
            let xFactor: number = 0;
            let yFactor: number = 0;
            if (this.moveDirection == 1) {
                yFactor = -1;
            } else if (this.moveDirection == 2) {
                xFactor = 0.7071;
                yFactor = -0.7071;
            } else if (this.moveDirection == 3) {
                xFactor = 1;
            } else if (this.moveDirection == 4) {
                xFactor = 0.7071;
                yFactor = 0.7071;
            } else if (this.moveDirection == 5) {
                yFactor = 1;
            } else if (this.moveDirection == 6) {
                xFactor = -0.7071;
                yFactor = 0.7071;
            } else if (this.moveDirection == 7) {
                xFactor = -1;
            } else if (this.moveDirection == 8) {
                xFactor = -0.7071;
                yFactor = -0.7071;
            }

            if (xFactor != 0) {
                this.Transform.X += xFactor * this.velocity * delta;
                this.Transform.addChange(ChangesDict.X)
            }
            if (yFactor != 0) {
                this.Transform.Y += yFactor * this.velocity * delta;
                this.Transform.addChange(ChangesDict.X)
            }
        }
    }

    protected serverUpdate(delta: number) {

    }

    set Direction(direction: number) {
        if(direction >= 0 && direction <= 8) {
            this.moveDirection = direction;
        }
    }

    get Direction(): number {
        return this.moveDirection;
    }
}

