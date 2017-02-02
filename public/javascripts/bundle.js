(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />
"use strict";
const Game_1 = require("../Common/Game");
const Renderer_1 = require("./graphic/Renderer");
const InputHandler_1 = require("./InputHandler");
class GameClient {
    constructor() {
        this.inputHandler = new InputHandler_1.InputHandler;
        this.game = new Game_1.Game;
        this.renderer = new Renderer_1.Renderer;
    }
    connect() {
        this.socket = io.connect();
        if (this.socket != null) {
            this.configureSocket();
        }
    }
    configureSocket() {
        this.socket.on('startgame', this.startGame);
    }
    startGame() {
    }
}
exports.GameClient = GameClient;

},{"../Common/Game":5,"./InputHandler":2,"./graphic/Renderer":3}],2:[function(require,module,exports){
"use strict";
class InputHandler {
    constructor() {
        document.addEventListener("keydown", this.keyPressed);
        document.addEventListener("keyup", this.keyReleased);
        console.log("InputHandler");
    }
    keyPressed(event) {
        console.log(event.keyCode);
    }
    keyReleased(event) {
        console.log(event.keyCode);
    }
}
exports.InputHandler = InputHandler;

},{}],3:[function(require,module,exports){
/// <reference path="../libs/@types/phaser.d.ts" />
"use strict";
class Renderer {
    constructor() {
        this.phaser = new Phaser.Game(800, 600, Phaser.AUTO, 'content', { preload: this.preload.bind(this), create: this.create.bind(this) });
        if (this.phaser == null) {
            console.log("KURWA MAĆ");
        }
        else {
            console.log("XD" + this.phaser.antialias);
        }
    }
    preload() {
        this.phaser.load.image('bunny', 'resources/images/bunny.png');
    }
    create() {
        let logo = this.phaser.add.sprite(this.phaser.world.centerX, this.phaser.world.centerY, 'bunny');
        logo.anchor.setTo(0.5, 0.5);
    }
}
exports.Renderer = Renderer;

},{}],4:[function(require,module,exports){
"use strict";
const GameClient_1 = require("./GameClient");
let client = new GameClient_1.GameClient();
client.connect();

},{"./GameClient":1}],5:[function(require,module,exports){
"use strict";
class Game {
    constructor() {
        console.log("create game instance");
    }
}
exports.Game = Game;

},{}]},{},[4]);
