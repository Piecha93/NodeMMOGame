import {Transform} from "../physics/Transform";
import {Player} from "./Player";
import {GameObject} from "./GameObject";
import {Enemy} from "./Enemy";
import {Bullet} from "./Bullet";
import {Obstacle} from "./Obstacle";


export interface GameObjectConstructor {
    new (position: Transform): GameObject;
}
export class Types {

    static IdToClass: Map<string, GameObjectConstructor>;
    static ClassToId: Map<GameObjectConstructor, string>;

    static Init() {
       Types.IdToClass = new Map<string, GameObjectConstructor>([
            ["P", Player],
            ["E", Enemy],
            ["B", Bullet],
            ["O", Obstacle],
        ]);

       Types.ClassToId = Types.reverseMap(Types.IdToClass);
    }

    private static reverseMap(map: Map<string, GameObjectConstructor>) {
        let reverseMap: Map<GameObjectConstructor, string> = new Map<GameObjectConstructor, string>();
        map.forEach((val: GameObjectConstructor, key: string) => {
            reverseMap.set(val, key);
        });

        return reverseMap;
    }
}