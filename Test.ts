import {Player} from "./common/utils/game/Player";
import {GameObjectsFactory} from "./common/utils/game/ObjectsFactory";
import * as LZString from "lz-string";

let player: Player = GameObjectsFactory.Instatiate("Player") as Player;
//
// let update =
// [
//     "bunny",
//     [
//         0.4444,
//         0.4444,
//         40.4444,
//         64.4444,
//         0.4444
//     ],
//     0.5555,
//     undefined,
//     200.4444,
//     200.4444
// ];

// console.log(new Float64Array([
//     "bunny",
//     [
//         0,
//         0,
//         40,
//         64,
//         0
//     ],
//     0.5,
//     200,
//     200
// ]));

// let arrayUpdate = JSON.stringify(update);
//
// let playerUpdate: string = player.serialize(true);
//
// let compressedplayerUpdate: string = LZString.compressToUTF16(playerUpdate);
// let compressedArrayUpdate: string = LZString.compressToUTF16(arrayUpdate);
//
// console.log("arrayUpdate " + arrayUpdate + " --> " + getUTF8Size(arrayUpdate));
// console.log("playerUpdate " + playerUpdate + " --> " + getUTF8Size(playerUpdate));
// console.log("compressedPlayerUpdate " + compressedplayerUpdate + " --> " + getUTF8Size(compressedplayerUpdate));
// console.log("compressedArrayUpdate " + compressedArrayUpdate + " --> " + getUTF8Size(compressedArrayUpdate));


import { Message, Type, Field, OneOf } from "protobufjs/light";
import {Bullet} from "./common/utils/game/Bullet";

let bullet: Bullet = GameObjectsFactory.Instatiate("Bullet") as Bullet;

bullet.Owner = "Dupa";


let buffer  = Bullet.encode(bullet).finish();
let decoded = Bullet.decode(buffer);

console.log(bullet.toJSON());
// console.log(message);
// console.log(buffer);
// console.log(decoded);
console.log(decoded.toJSON());

// buffer  = Bullet.encodeDelimited(bullet).finish();
// decoded = Bullet.decodeDelimited(buffer);
//
// // console.log(message);
// console.log(buffer);
// console.log(decoded);