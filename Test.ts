import {Player} from "./common/utils/game/Player";
import {GameObjectsFactory} from "./common/utils/game/ObjectsFactory";
import * as LZString from "lz-string";
import {ChangesDict} from "./common/serialize/ChangesDict";

let player: Player = GameObjectsFactory.Instatiate("Player") as Player;

// console.log(player.Transform.calcNeedenBufferSize(true));
// console.log(player.calcNeedenBufferSize(true));

// console.log(player.Transform.calcNeedenBufferSize(false));
// console.log(player.calcNeededBufferSize(false));

// console.log(player.serialize(true));
player["forceComplete"] = false;
player.Transform["forceComplete"] = false;


// let buffer: ArrayBuffer = new ArrayBuffer(player.calcNeededBufferSize(true));

player.addChange(ChangesDict.HP);
player.hit(54);
let neededSize: number = player.calcNeededBufferSize(true);
let buffer: ArrayBuffer = new ArrayBuffer(neededSize);
let view: DataView = new DataView(buffer);

console.log(player.serialize(view, 0, true));

for(let i = 0; i < neededSize; i++) {
    console.log(view.getUint8(i));
}

player.deserialize(view, 0);


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

let buff: Uint8Array = new Uint8Array(10);

// console.log(buff);

let str1 = "asd";
let str2 = "ghj";

// function fillString(str: string, buff: Uint8Array, startIdx: number): number {
//     buff.fill(str.length, startIdx, ++startIdx);
//     for(let i = 0; i < str.length; i++) {
//         buff.fill(str.charCodeAt(i), startIdx, ++startIdx);
//     }
//     return startIdx;
// }
//
// function decodeString(buff: Uint8Array, startIdx: number): string {
//     let len: number = buff[startIdx];
//     let str: string = "";
//     for(let i = 1; i <= len; i++) {
//         console.log(i + startIdx);
//         str += String.fromCharCode(buff[i + startIdx]);
//     }
//
//     return str;
// }

// let startIdx = 0;
//
// startIdx = fillString(str1, buff, startIdx);
// startIdx = fillString(str2, buff, startIdx);
//
// let decodedStr1: string = decodeString(buff, 0);
// let decodedStr2: string = decodeString(buff, decodedStr1.length + 1);
//
// console.log(decodedStr1);
// console.log(decodedStr2);

function fillString(str: string, view: DataView, offset: number): number {
    view.setUint8(offset++, str.length);
    for(let i = 0; i < str.length; i++) {
        view.setUint8(offset, str.charCodeAt(i));
        offset++
    }
    return offset;
}

function decodeString(view: DataView, offset: number): string {
    let len: number = view.getUint8(offset);
    let str: string = "";
    for(let i = 1; i <= len; i++) {
        str += String.fromCharCode(view.getUint8(i + offset));
    }

    return str;
}

// let buffer: ArrayBuffer = new ArrayBuffer(5);
// let view: DataView = new DataView(buffer);
//
// let buffer2: ArrayBuffer = new ArrayBuffer(5);
// let view2: DataView = new DataView(buffer);
//
// fillString("asdf", view, 0);
// fillString("zxcv", view, 0);
//
// let buffer3: ArrayBuffer = new ArrayBuffer(view.byteLength + view2.byteLength);
// let view3: DataView = new DataView(buffer);
// console.log(view.byteOffset);
// console.log(view2.byteOffset);
// console.log(view3.);


// console.log(decodeString(view, 0));
// view.setInt32(0,22);

// console.log(view);

// let n: number = 0;
// let mask: number = 1 << 0;
//
// n |= mask;

// console.log("n " + n);
