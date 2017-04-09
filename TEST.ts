
import Game = Phaser.Game;
let dupa:string = "#P:1.234,2.456#F:123#G:asdasd";

export enum GameObjectType {
    GameObject = <any>'G',
    Player = <any>'P'
}

let id: string = "P123";
let type: string =  id.substr(0, 1);

console.log(type);