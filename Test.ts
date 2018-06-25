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

let complete: boolean = false;
// let buffer: ArrayBuffer = new ArrayBuffer(player.calcNeededBufferSize(true));
//
// player.addChange(ChangesDict.HP);
// player.hit(54);
// let neededSize: number = player.calcNeededBufferSize(complete);
// let buffer: ArrayBuffer = new ArrayBuffer(neededSize);
// let view: DataView = new DataView(buffer);
//
// console.log("neededSize " + neededSize);
// console.log("offset after " + player.serialize(view, 0, complete));
//
// player.hit(100);

// for(let i = 0; i < neededSize; i++) {
//     console.log(view.getUint8(i));
// }

// player.deserialize(view, 0);


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



player.printSerializeOrder();
player.Transform.printSerializeOrder();


let testData1: Array<number> = [1, 0, 0, 0, 18, 2, 5, 69, 38, 39, 13, 67, 188, 120, 105];
let testData2: Array<number> =[1, 0, 0, 0, 21, 2, 3, 69, 55, 29, 23, 67, 165, 91, 102];
let testData3: Array<number> =[1, 0, 0, 0, 21, 2, 3, 69, 55, 29, 23, 67, 165, 91, 102];
let testData4: Array<number> =[1, 0, 0, 0, 21, 2, 3, 67, 165, 91, 102, 69, 55, 29, 23];
let testData5: Array<number> =[1, 0, 0, 0, 2, 34, 0, 200, 5, 0, 0, 0, 80, 255, 9, 104, 112, 95, 112, 111, 116, 105, 111, 110, 0, 0, 0, 0, 255, 67, 130, 0, 0, 67, 121, 0, 0, 0, 32, 0, 32, 0, 0, 0, 0, 5, 0, 0, 0, 81, 255, 9, 104, 112, 95, 112, 111, 116, 105, 111, 110, 0, 0, 0, 0, 255, 67, 149, 0, 0, 67, 108, 0, 0, 0, 32, 0, 32, 0, 0, 0, 0, 255, 5, 0, 0, 0, 76, 5, 0, 0, 0, 77, 5, 0, 0, 0, 78, 5, 0, 0, 0, 75, 5, 0, 0, 0, 79];


let testData: Array<number> = testData5;

    // [2, 0, 0, 0, 133, 2, 3, 68, 237, 190, 255, 68, 127, 125, 86, 2, 0, 0, 0, 135, 2, 3, 68, 237, 67, 185, 68, 51, 214, 79, 2, 0, 0, 0, 136, 2, 3, 67, 130, 51, 100, 68, 108, 202, 220, 2, 0, 0, 0, 139, 2, 3, 68, 190, 27, 126, 66, 96, 0, 0, 2, 0, 0, 0, 141, 34, 0, 110, 3, 66, 48, 0, 0, 68, 17, 159, 230, 2, 0, 0, 0, 143, 2, 3, 67, 113, 64, 130, 68, 131, 0, 0, 2, 0, 0, 0, 144, 2, 3, 68, 244, 128, 0, 68, 117, 220, 218, 2, 0, 0, 0, 145, 2, 3, 67, 84, 95, 56, 67, 212, 127, 219, 2, 0, 0, 0, 146, 2, 3, 68, 244, 128, 0, 68, 42, 0, 0, 2, 0, 0, 0, 147, 2, 3, 68, 244, 120, 224, 66, 96, 0, 0, 2, 0, 0, 0, 150, 2, 3, 68, 128, 46, 239, 66, 96, 0, 0, 2, 0, 0, 0, 153, 2, 3, 68, 119, 98, 55, 68, 117, 4, 178, 2, 0, 0, 0, 154, 2, 3, 67, 148, 40, 21, 68, 123, 126, 170, 2, 0, 0, 0, 155, 2, 3, 68, 244, 128, 0, 68, 28, 3, 203, 2, 0, 0, 0, 156, 2, 3, 68, 20, 45, 10, 66, 96, 0, 0, 1, 0, 0, 0, 208, 34, 0, 140, 2, 0, 0, 1, 90, 2, 3, 67, 190, 237, 223, 67, 193, 46, 190, 2, 0, 0, 1, 146, 2, 3, 67, 71, 175, 97, 67, 148, 80, 143, 2, 0, 0, 2, 120, 2, 3, 66, 48, 0, 0, 68, 131, 0, 0, 2, 0, 0, 2, 121, 34, 0, 120, 3, 67, 253, 98, 155, 68, 36, 57, 16, 2, 0, 0, 2, 215, 2, 3, 68, 135, 147, 128, 68, 131, 0, 0, 2, 0, 0, 3, 108, 2, 3, 68, 165, 91, 59, 66, 199, 135, 65, 2, 0, 0, 3, 164, 34, 0, 160, 3, 67, 176, 253, 90, 67, 168, 22, 27, 2, 0, 0, 3, 200, 2, 3, 66, 48, 0, 0, 68, 14, 224, 193, 2, 0, 0, 3, 225, 2, 3, 67, 108, 0, 0, 66, 96, 0, 0, 2, 0, 0, 4, 15, 2, 3, 68, 74, 40, 247, 67, 24, 55, 119, 3, 0, 0, 4, 67, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 166, 240, 216, 68, 8, 229, 45, 0, 30, 0, 30, 63, 74, 214, 245, 3, 0, 0, 4, 68, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 149, 246, 0, 68, 25, 65, 140, 0, 30, 0, 30, 66, 104, 0, 0, 3, 0, 0, 4, 69, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 166, 27, 16, 67, 81, 116, 172, 0, 30, 0, 30, 66, 120, 0, 0, 3, 0, 0, 4, 70, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 106, 187, 95, 67, 189, 207, 174, 0, 30, 0, 30, 65, 176, 0, 0, 3, 0, 0, 4, 71, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 174, 116, 108, 67, 158, 74, 95, 0, 30, 0, 30, 64, 192, 0, 0, 3, 0, 0, 4, 72, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 106, 234, 20, 67, 181, 146, 79, 0, 30, 0, 30, 67, 70, 0, 0, 3, 0, 0, 4, 73, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 174, 116, 108, 67, 158, 74, 95, 0, 30, 0, 30, 64, 192, 0, 0, 3, 0, 0, 4, 74, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 117, 218, 213, 67, 116, 186, 134, 0, 30, 0, 30, 67, 14, 0, 0, 3, 0, 0, 4, 75, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 175, 138, 181, 67, 199, 21, 199, 0, 30, 0, 30, 67, 48, 0, 0, 3, 0, 0, 4, 76, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 124, 254, 58, 67, 84, 65, 126, 0, 30, 0, 30, 67, 121, 0, 0, 3, 0, 0, 4, 77, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 131, 48, 103, 68, 16, 252, 69, 0, 30, 0, 30, 67, 155, 0, 0, 3, 0, 0, 4, 78, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 154, 129, 58, 67, 29, 174, 97, 0, 30, 0, 30, 67, 169, 0, 0, 3, 0, 0, 4, 79, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 174, 116, 108, 67, 158, 74, 95, 0, 30, 0, 30, 64, 192, 0, 0, 3, 0, 0, 4, 80, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 124, 63, 225, 67, 87, 29, 29, 0, 30, 0, 30, 67, 77, 0, 0, 3, 0, 0, 4, 81, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 167, 193, 145, 68, 7, 56, 161, 0, 30, 0, 30, 66, 190, 0, 0, 3, 0, 0, 4, 82, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 173, 160, 60, 67, 233, 39, 185, 0, 30, 0, 30, 67, 86, 0, 0, 3, 0, 0, 4, 83, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 148, 42, 34, 67, 21, 18, 4, 0, 30, 0, 30, 67, 15, 0, 0, 3, 0, 0, 4, 84, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 158, 155, 251, 68, 20, 99, 118, 0, 30, 0, 30, 67, 176, 128, 0, 3, 0, 0, 4, 85, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 174, 17, 80, 67, 153, 96, 114, 0, 30, 0, 30, 67, 123, 0, 0, 3, 0, 0, 4, 86, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 134, 34, 235, 67, 42, 174, 159, 0, 30, 0, 30, 67, 165, 128, 0, 3, 0, 0, 4, 87, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 173, 33, 182, 67, 143, 197, 164, 0, 30, 0, 30, 65, 248, 0, 0, 3, 0, 0, 4, 88, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 107, 119, 149, 67, 172, 92, 230, 0, 30, 0, 30, 66, 36, 0, 0, 3, 0, 0, 4, 89, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 136, 8, 38, 68, 21, 201, 88, 0, 30, 0, 30, 67, 75, 0, 0, 3, 0, 0, 4, 90, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 174, 169, 40, 67, 220, 106, 143, 0, 30, 0, 30, 67, 141, 128, 0, 3, 0, 0, 4, 91, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 170, 127, 156, 68, 0, 101, 161, 0, 30, 0, 30, 66, 152, 0, 0, 3, 0, 0, 4, 92, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 173, 184, 3, 67, 149, 126, 210, 0, 30, 0, 30, 67, 35, 0, 0, 3, 0, 0, 4, 93, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 173, 60, 5, 67, 236, 248, 143, 0, 30, 0, 30, 67, 151, 0, 0, 3, 0, 0, 4, 94, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 161, 89, 70, 68, 17, 133, 47, 0, 30, 0, 30, 66, 178, 0, 0, 3, 0, 0, 4, 95, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 153, 65, 221, 68, 24, 19, 177, 0, 30, 0, 30, 66, 254, 0, 0, 3, 0, 0, 4, 96, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 109, 12, 218, 67, 158, 73, 131, 0, 30, 0, 30, 67, 174, 128, 0, 3, 0, 0, 4, 97, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 1, 50, 48, 56, 255, 68, 174, 38, 49, 67, 227, 85, 101, 0, 30, 0, 30, 66, 164, 0, 0, 3, 0, 0, 4, 98, 255, 5, 102, 108, 97, 109, 101, 63, 128, 0, 0, 0, 10, 4, 2, 55, 50, 55, 255, 68, 154, 130, 151, 68, 124, 115, 19, 0, 30, 0, 30, 67, 135, 0, 0, 255, 3, 0, 0, 4, 59, 3, 0, 0, 4, 57, 3, 0, 0, 4, 41, 3, 0, 0, 4, 66, 3, 0, 0, 4, 100, 3, 0, 0, 4, 64, 3, 0, 0, 4, 99, 3, 0, 0, 4, 101, 3, 0, 0, 4, 102]

let buffer: ArrayBuffer = new ArrayBuffer(8);
let view: DataView = new DataView(buffer);

// for(let i = 0; i < testData.length; i++) {
//     view.setUint8(i, testData[i]);
// }

// console.log("asd " + player.deserialize(view, 5));

player.Transform["changes"].clear();
player.Transform.Y = 1.1210387714598537e-43;
player.Transform.X = 330.71405029296875;

player.addChange(ChangesDict.HP);
// player.Transform.addChange(ChangesDict.X);
// player.Transform.addChange(ChangesDict.Y);

console.log(player.calcNeededBufferSize(false));
console.log(player.Transform["changes"]);
player.serialize(view, 0);

let arr = "";
for(let i = 0; i < view.byteLength; i++) {
    arr += view.getUint8(i) + ", ";
}

console.log(arr);

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

