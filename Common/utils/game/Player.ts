import {Transform} from "../physics/Transform";
import {GameObjectType} from "./GameObjectTypes";
import {ChangesDict} from "./ChangesDict";
import {ObjectsFactory} from "./ObjectsFactory";
import {Bullet} from "./Bullet";
import {Actor} from "./Actor";

export class Player extends Actor {
    get Type(): string {
        return GameObjectType.Player.toString();
    }

    private moveDirection: number = 0;
    private inputCommands: Map<string, string> = new Map<string, string>();

    constructor(name: string, transform: Transform) {
        super(name, transform);
    }

    public setInput(commands: Map<string, string> ) {
        this.inputCommands = commands;
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        if(this.inputCommands.has("D")) {
            this.moveDirection = parseInt(this.inputCommands.get("D"));
            this.inputCommands.delete("D");
        }

        let xFactor: number = 0;
        let yFactor: number = 0;
        if(this.moveDirection == 1) {
            yFactor = -1;
        } else if(this.moveDirection == 2) {
            xFactor = 0.7071;
            yFactor = -0.7071;
        } else if(this.moveDirection == 3) {
            xFactor = 1;
        } else if(this.moveDirection == 4) {
            xFactor = 0.7071;
            yFactor = 0.7071;
        } else if(this.moveDirection == 5) {
            yFactor = 1;
        } else if(this.moveDirection == 6) {
            xFactor = -0.7071;
            yFactor = 0.7071;
        } else if(this.moveDirection == 7) {
            xFactor = -1;
        } else if(this.moveDirection == 8) {
            xFactor = -0.7071;
            yFactor = -0.7071;
        }

        if(this.moveDirection != 0) {
            this.transform.X += xFactor * this.velocity * delta;
            this.transform.Y += yFactor * this.velocity * delta;

            this.changes.add(ChangesDict.POSITION);
        }
    }

    protected serverUpdate(delta: number) {
        if(this.inputCommands.has("C")) {
            for(let i = 0; i < 1; i++) {
                let bullet: Bullet = ObjectsFactory.CreateGameObject("B") as Bullet;
                bullet.Owner = this.ID;

                bullet.Transform.Rotation = parseFloat(this.inputCommands.get("C"));
                //bullet.Transform.Rotation = Math.floor(Math.random() * 360);

                bullet.Transform.X = this.transform.X;
                bullet.Transform.Y = this.transform.Y;
            }
            this.inputCommands.delete("C");
        }
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

