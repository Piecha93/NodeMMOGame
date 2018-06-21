import {Obstacle} from "./Obstacle";
import {Item} from "./Item";
import {Transform} from "../physics/Transform";
import {Player} from "./Player";
import {GameObject} from "./GameObject";
import {Bullet} from "./Bullet";
import {Enemy} from "./Enemy";

export class Types {
    static ClassNamesToId = new Map<string, string>();

    static IdToClassNames = new Map<string, string>();

    static ClassNamesToTypes: Map<string, new (position: Transform) => GameObject> =
        new Map<string, new (position: Transform) => GameObject>();

    private static shortIdCounter = 1;

    static RegisterGameObject: Function = function (gameObjectType: new (position: Transform) => GameObject) {
        Types.ClassNamesToTypes.set(gameObjectType.name, gameObjectType);
        let shortId: string;
        shortId = String.fromCharCode(Types.shortIdCounter++);

        Types.ClassNamesToId.set(gameObjectType.name, shortId);
        Types.IdToClassNames.set(shortId, gameObjectType.name);
    }
}

Types.RegisterGameObject(Player);
Types.RegisterGameObject(Enemy);
Types.RegisterGameObject(Bullet);
Types.RegisterGameObject(Obstacle);
Types.RegisterGameObject(Item);