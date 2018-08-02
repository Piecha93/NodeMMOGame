import {Obstacle} from "../game/Obstacle";
import {Item} from "../game/Item";
import {Player} from "../game/Player";
import {GameObject} from "../game/GameObject";
import {FireBall} from "../game/FireBall";
import {Enemy} from "../game/Enemy";
import {Portal} from "../game/Portal";

export interface Constructor<T> extends Function {
    new(...params: any[]): T; prototype: T;
}

export class Types {
    static ClassNamesToId = new Map<string, string>();

    static IdToClassNames = new Map<string, string>();

    static ClassNamesToTypes: Map<string, Constructor<GameObject> > =
        new Map<string, Constructor<GameObject> >();

    private static shortIdCounter = 65;

    static RegisterGameObject: Function = function (gameObjectType: Constructor<GameObject>) {
        Types.ClassNamesToTypes.set(gameObjectType.name, gameObjectType);
        let shortId: string;
        shortId = String.fromCharCode(Types.shortIdCounter++);

        Types.ClassNamesToId.set(gameObjectType.name, shortId);
        Types.IdToClassNames.set(shortId, gameObjectType.name);
    }
}

Types.RegisterGameObject(Player);
Types.RegisterGameObject(Enemy);
Types.RegisterGameObject(Obstacle);
Types.RegisterGameObject(Item);
Types.RegisterGameObject(FireBall);
Types.RegisterGameObject(Portal);
