(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />
"use strict";
const Game_1 = require("../Common/Game");
const Renderer_1 = require("./graphic/Renderer");
const InputHandler_1 = require("./InputHandler");
const NetObjectsManager_1 = require("../Common/net/NetObjectsManager");
const ObjectsFactory_1 = require("../Common/utils/ObjectsFactory");
const HeartBeatSender_1 = require("./HeartBeatSender");
class GameClient {
    constructor() {
        this.game = new Game_1.Game;
        this.renderer = new Renderer_1.Renderer(() => {
            this.inputHandler = new InputHandler_1.InputHandler(this.renderer.PhaserInput);
            this.socket.emit('cr');
            this.heartBeatSender.startSendingHeartbeats();
        });
    }
    connect() {
        this.socket = io.connect();
        this.heartBeatSender = new HeartBeatSender_1.HeartBeatSender(this.socket);
        if (this.socket != null) {
            this.configureSocket();
        }
    }
    configureSocket() {
        this.socket.on('sg', this.startGame.bind(this));
        this.socket.on('ig', this.initializeGame.bind(this));
        this.socket.on('ug', this.updateGame.bind(this));
    }
    startGame() {
        this.game = new Game_1.Game;
        //  this.game.startSendingHeartbeats();
    }
    startSendingInput() {
        this.inputTtimeoutId = setTimeout(() => this.startSendingInput(), 1 / 10 * 1000);
        if (this.inputHandler.Changed) {
            let snapshot = this.inputHandler.cloneInputSnapshot();
            let serializedSnapshot = JSON.stringify(snapshot);
            this.socket.emit('is', serializedSnapshot);
        }
    }
    initializeGame(initData) {
        if (initData['objects'] == null) {
            return;
        }
        let update = initData['objects'].split('$');
        for (let object in update) {
            let splitObject = update[object].split('-');
            let id = splitObject[0];
            let data = splitObject[1];
            let netObject = NetObjectsManager_1.NetObjectsManager.Instance.getObject(id);
            if (netObject == null) {
                let gameObject = ObjectsFactory_1.ObjectsFactory.CreateGameObject(id);
                netObject = NetObjectsManager_1.NetObjectsManager.Instance.createObject(gameObject, id);
                this.renderer.addGameObject(gameObject);
            }
            else {
                netObject.GameObject.deserialize(data.split('#'));
            }
        }
        this.startSendingInput();
    }
    updateGame(data) {
        if (data['objects'] == null) {
            return;
        }
        let update = data['objects'].split('$');
        for (let object in update) {
            let splitObject = update[object].split('-');
            let id = splitObject[0];
            let data = splitObject[1];
            let netObject = NetObjectsManager_1.NetObjectsManager.Instance.getObject(id);
            if (netObject == null) {
                let gameObject = ObjectsFactory_1.ObjectsFactory.CreateGameObject(id);
                netObject = NetObjectsManager_1.NetObjectsManager.Instance.createObject(gameObject, id);
                this.renderer.addGameObject(gameObject);
            }
            else {
                netObject.GameObject.deserialize(data.split('#'));
            }
        }
        this.renderer.update();
    }
}
exports.GameClient = GameClient;

},{"../Common/Game":7,"../Common/net/NetObjectsManager":10,"../Common/utils/ObjectsFactory":13,"./HeartBeatSender":2,"./InputHandler":3,"./graphic/Renderer":5}],2:[function(require,module,exports){
"use strict";
class HeartBeatSender {
    constructor(socket, rate) {
        this.rate = 1;
        this.hbId = 0;
        this.socket = socket;
        this.socket.on('hbr', this.heartBeatResponse.bind(this));
        this.heartBeats = new Map();
        if (rate != null) {
            this.rate = rate;
        }
    }
    heartBeatResponse(id) {
        let ping = new Date().getTime() - this.heartBeats.get(id);
        console.log('hbr ' + ping);
    }
    startSendingHeartbeats() {
        this.timeoutId = setTimeout(() => this.startSendingHeartbeats(), 1 / this.rate * 1000);
        this.socket.emit('hb', this.hbId);
        this.heartBeats.set(this.hbId, new Date().getTime());
        this.hbId++;
    }
    stopSendingHeartbeats() {
        clearTimeout(this.timeoutId);
    }
}
exports.HeartBeatSender = HeartBeatSender;

},{}],3:[function(require,module,exports){
/// <reference path="libs/@types/phaser.d.ts" />
"use strict";
const Position_1 = require("../Common/utils/Position");
const InputSnapshot_1 = require("../Common/InputSnapshot");
class InputHandler {
    constructor(phaserInput) {
        // document.addEventListener("keydown", this.keyPressed);
        // document.addEventListener("keyup", this.keyReleased);
        this.inputSnapshot = new InputSnapshot_1.InputSnapshot;
        this.changed = false;
        this.phaserInput = phaserInput;
        this.phaserInput.onDown.add(this.mouseClick, this);
        //this.phaserInput.addMoveCallback(this.mouseClick, this);
    }
    // private keyPressed(event : KeyboardEvent) {
    //     console.log(event.keyCode);
    // }
    // private keyReleased(event : KeyboardEvent) {
    //     console.log(event.keyCode);
    // }
    mouseClick(mouseEvent) {
        this.inputSnapshot.ClickPosition = new Position_1.Position(mouseEvent.x, mouseEvent.y);
        this.changed = true;
    }
    cloneInputSnapshot() {
        this.changed = false;
        let inputSnapshotCopy = this.inputSnapshot.clone();
        this.inputSnapshot.clear();
        return inputSnapshotCopy;
    }
    get Changed() {
        return this.changed;
    }
}
exports.InputHandler = InputHandler;

},{"../Common/InputSnapshot":8,"../Common/utils/Position":15}],4:[function(require,module,exports){
/// <reference path="../libs/@types/phaser.d.ts" />
"use strict";
class GameObjectRender {
    constructor(phaserGame) {
        this.phaserGame = phaserGame;
    }
    set GameObject(gameObjectReference) {
        this.objectReference = gameObjectReference;
        let position = this.objectReference.Position;
        this.sprite = this.phaserGame.add.sprite(position.X, position.Y, 'bunny');
        this.sprite.anchor.setTo(0.5, 0.5);
    }
    render() {
        if (this.sprite) {
            let position = this.objectReference.Position;
            this.sprite.x = position.X;
            this.sprite.y = position.Y;
        }
    }
}
exports.GameObjectRender = GameObjectRender;

},{}],5:[function(require,module,exports){
/// <reference path="../libs/@types/phaser.d.ts" />
"use strict";
const GameObjectRender_1 = require("./GameObjectRender");
class Renderer {
    constructor(afterCreateCallback) {
        this.phaserGame = new Phaser.Game(800, 600, Phaser.AUTO, 'content', { preload: this.preload.bind(this), create: this.create.bind(this, afterCreateCallback) });
        this.objectList = new Array();
    }
    preload() {
        this.phaserGame.load.image('bunny', 'resources/images/bunny.png');
        //this.phaserGame.load.onLoadComplete.addOnce(() => { console.log("ASSETS LOAD COMPLETE"); });
    }
    create(afterCreateCallback) {
        //console.log("PHASER CREATE");
        afterCreateCallback();
    }
    update() {
        for (let gameObjectRender of this.objectList) {
            gameObjectRender.render();
        }
    }
    addGameObject(gameObject) {
        let gameObjectRender = new GameObjectRender_1.GameObjectRender(this.phaserGame);
        gameObjectRender.GameObject = gameObject;
        this.objectList.push(gameObjectRender);
    }
    get PhaserInput() {
        return this.phaserGame.input;
    }
}
exports.Renderer = Renderer;

},{"./GameObjectRender":4}],6:[function(require,module,exports){
"use strict";
const GameClient_1 = require("./GameClient");
let client = new GameClient_1.GameClient();
client.connect();

},{"./GameClient":1}],7:[function(require,module,exports){
"use strict";
const Player_1 = require("./utils/Player");
const Position_1 = require("./utils/Position");
class Game {
    constructor() {
        this.tickrate = 30;
        this.players = new Map();
        console.log("create game instance");
    }
    startGameLoop() {
        this.timeoutId = setTimeout(() => this.startGameLoop(), 1 / this.tickrate * 1000);
        // this.players.forEach((player: Player, key: string) => {
        //     player.Position.X +=  Math.floor(Math.random() * 3) - 1;
        //     player.Position.Y +=  Math.floor(Math.random() * 3) - 1;
        // });
        this.players.forEach((player, key) => {
            if (player.Destination != null) {
                player.Position.X += (player.Destination.X - player.Position.X) / 10;
                player.Position.Y += (player.Destination.Y - player.Position.Y) / 10;
                player.hit(Math.floor(Math.random() * 100));
            }
        });
    }
    stopGameLoop() {
        clearTimeout(this.timeoutId);
    }
    spawnPlayer(name, position) {
        if (this.players.has(name)) {
            return this.players.get(name);
        }
        let player;
        if (!position) {
            position = new Position_1.Position(0, 0);
        }
        player = new Player_1.Player(name, position);
        this.players.set(name, player);
        //console.log("New player " + name);
        //console.log("Number of players " + this.players.size);
        return player;
    }
    getPlayer(name) {
        return this.players.get(name);
    }
}
exports.Game = Game;

},{"./utils/Player":14,"./utils/Position":15}],8:[function(require,module,exports){
"use strict";
const Position_1 = require("../Common/utils/Position");
class InputSnapshot {
    constructor() {
        this.clear();
    }
    clear() {
        this.keysPressed = [];
        this.keysReleased = [];
        this.keysPressed = null;
    }
    clone() {
        let inputSnapshot = new InputSnapshot;
        inputSnapshot.ClickPosition = new Position_1.Position(this.moveTo.X, this.moveTo.Y);
        return inputSnapshot;
    }
    set ClickPosition(position) {
        this.moveTo = position;
    }
    get ClickPosition() {
        return this.moveTo;
    }
    deserialize(input) {
        if (this.moveTo) {
            this.moveTo = this.moveTo.deserialize(input.moveTo);
        }
        else {
            this.moveTo = new Position_1.Position().deserialize(input.moveTo);
        }
        return this;
    }
}
exports.InputSnapshot = InputSnapshot;

},{"../Common/utils/Position":15}],9:[function(require,module,exports){
"use strict";
class NetObject {
    constructor(id, gameObject) {
        this.id = id;
        this.gameObject = gameObject;
    }
    get GameObject() {
        return this.gameObject;
    }
    get ID() {
        return this.id;
    }
    serialize() {
        return this.id.toString() + this.gameObject.serialize();
    }
    deserialize(update) {
        let splitUpdate = update.split('#');
        this.gameObject.deserialize(splitUpdate);
    }
}
exports.NetObject = NetObject;

},{}],10:[function(require,module,exports){
"use strict";
const NetObject_1 = require("./NetObject");
class NetObjectsManager {
    constructor() {
        if (NetObjectsManager.instance) {
            return NetObjectsManager.instance;
        }
        else {
            NetObjectsManager.instance = this;
            this.netObjects = new Map();
            return this;
        }
    }
    static GetNextId(type) {
        NetObjectsManager.NEXT_ID++;
        return type + NetObjectsManager.NEXT_ID.toString();
    }
    static get Instance() {
        return new NetObjectsManager;
    }
    collectUpdate() {
        let serializedObjects = '';
        this.netObjects.forEach((value, key) => {
            let netObject = this.netObjects.get(key);
            serializedObjects += '$' + netObject.ID + '-' + netObject.GameObject.serialize().slice(1);
        });
        serializedObjects = serializedObjects.slice(1);
        return serializedObjects;
    }
    getObject(id) {
        return this.netObjects.get(id);
    }
    createObject(gameObject, id) {
        //TODO - sprawdzic czy dany gejmobject juz istnieje
        let newObjectId;
        if (id != null) {
            if (this.netObjects.has(id)) {
                throw new Error("NetObject id duplication: " + id);
            }
            newObjectId = id;
        }
        else {
            newObjectId = NetObjectsManager.GetNextId(gameObject.Type);
        }
        let netObject = new NetObject_1.NetObject(newObjectId, gameObject);
        this.netObjects.set(netObject.ID, netObject);
        return netObject;
    }
}
NetObjectsManager.NEXT_ID = 0;
exports.NetObjectsManager = NetObjectsManager;

},{"./NetObject":9}],11:[function(require,module,exports){
"use strict";
const Position_1 = require("./Position");
const GameObjectTypes_1 = require("./GameObjectTypes");
class GameObject {
    constructor(position) {
        if (position) {
            this.position = position;
        }
        else {
            this.position = new Position_1.Position(0, 0);
        }
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.GameObject.toString();
    }
    get Position() {
        return this.position;
    }
    serialize() {
        let position = '#P:' + this.position.X.toString() + ',' + this.position.Y.toString();
        let update = position;
        return update;
    }
    deserialize(update) {
        for (let item of update) {
            if (item.startsWith('P')) {
                this.updatePosition(item.split(':')[1]);
            }
        }
    }
    updatePosition(data) {
        let x = data.split(',')[0];
        let y = data.split(',')[1];
        this.position.X = parseFloat(x);
        this.position.Y = parseFloat(y);
    }
}
exports.GameObject = GameObject;

},{"./GameObjectTypes":12,"./Position":15}],12:[function(require,module,exports){
/**
 * Created by Tomek on 2017-04-08.
 */
"use strict";
(function (GameObjectType) {
    GameObjectType[GameObjectType["GameObject"] = 'G'] = "GameObject";
    GameObjectType[GameObjectType["Player"] = 'P'] = "Player";
})(exports.GameObjectType || (exports.GameObjectType = {}));
var GameObjectType = exports.GameObjectType;
exports.TypeIdMap = new Map();
exports.TypeIdMap.set('G', GameObjectType.GameObject);
exports.TypeIdMap.set('P', GameObjectType.Player);

},{}],13:[function(require,module,exports){
"use strict";
const Player_1 = require("./Player");
class ObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }
    static CreateGameObject(id) {
        let type = id.substr(0, 1);
        if (type == "P") {
            let player = new Player_1.Player();
            return player;
        }
        return null;
    }
}
exports.ObjectsFactory = ObjectsFactory;

},{"./Player":14}],14:[function(require,module,exports){
"use strict";
const GameObject_1 = require("./GameObject");
const GameObjectTypes_1 = require("./GameObjectTypes");
class Player extends GameObject_1.GameObject {
    constructor(name, position) {
        if (position) {
            super(position);
        }
        else {
            super();
        }
        this.name = name || "NoName";
        this.hp = 100;
        this.destination = null;
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.Player.toString();
    }
    get Name() {
        return this.name;
    }
    get Destination() {
        return this.destination;
    }
    set Destination(destination) {
        this.destination = destination;
    }
    hit(power) {
        this.hp += power;
        if (this.hp < 0) {
            this.hp = 0;
        }
    }
    get Position() {
        return this.position;
    }
    serialize() {
        let hp = '#H:' + this.hp.toString();
        let name = '#N:' + this.name;
        return super.serialize() + hp + name;
    }
    deserialize(update) {
        super.deserialize(update);
        for (let item of update) {
            if (item.startsWith('H')) {
                this.hp = parseInt(item.split(':')[1]);
            }
        }
    }
}
exports.Player = Player;

},{"./GameObject":11,"./GameObjectTypes":12}],15:[function(require,module,exports){
"use strict";
class Position {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }
    get X() {
        return this.x;
    }
    get Y() {
        return this.y;
    }
    set X(x) {
        this.x = x;
    }
    set Y(y) {
        this.y = y;
    }
    deserialize(input) {
        this.x = input.x;
        this.y = input.y;
        return this;
    }
    clone(position) {
        this.x = position.x;
        this.y = position.y;
        return new Position(position.x, position.y);
    }
}
exports.Position = Position;

},{}]},{},[6]);
