import {Player} from "./common/utils/game/Player";
import {GameObjectsFactory} from "./common/utils/game/ObjectsFactory";
import * as LZString from "lz-string";

let player: Player = GameObjectsFactory.Instatiate("Player") as Player;

var getUTF8Size = function( str ) {
    var sizeInBytes = str.split('')
        .map(function( ch ) {
            return ch.charCodeAt(0);
        }).map(function( uchar ) {
            // The reason for this is explained later in
            // the section “An Aside on Text Encodings”
            return uchar < 128 ? 1 : 2;
        }).reduce(function( curr, next ) {
            return curr + next;
        });

    return sizeInBytes;
};

let update =
[
    "bunny",
    [
        0.4444,
        0.4444,
        40.4444,
        64.4444,
        0.4444
    ],
    0.5555,
    undefined,
    200.4444,
    200.4444
];

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

let arrayUpdate = JSON.stringify(update);

let playerUpdate: string = player.serialize(true);

let compressedplayerUpdate: string = LZString.compressToUTF16(playerUpdate);
let compressedArrayUpdate: string = LZString.compressToUTF16(arrayUpdate);

console.log("arrayUpdate " + arrayUpdate + " --> " + getUTF8Size(arrayUpdate));
console.log("playerUpdate " + playerUpdate + " --> " + getUTF8Size(playerUpdate));
console.log("compressedPlayerUpdate " + compressedplayerUpdate + " --> " + getUTF8Size(compressedplayerUpdate));
console.log("compressedArrayUpdate " + compressedArrayUpdate + " --> " + getUTF8Size(compressedArrayUpdate));