(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const Game_1 = require("../Common/Game");
const Renderer_1 = require("./graphic/Renderer");
const InputHandler_1 = require("./InputHandler");
const NetObjectsManager_1 = require("../Common/net/NetObjectsManager");
const ObjectsFactory_1 = require("../Common/utils/ObjectsFactory");
const HeartBeatSender_1 = require("./HeartBeatSender");
const SocketMsgs_1 = require("../Common/net/SocketMsgs");
class GameClient {
    constructor() {
        this.netObjectMenager = NetObjectsManager_1.NetObjectsManager.Instance;
        this.game = new Game_1.Game;
        this.renderer = new Renderer_1.Renderer(() => {
            this.inputHandler = new InputHandler_1.InputHandler(this.renderer.PhaserInput);
            this.socket.emit(SocketMsgs_1.SocketMsgs.CLIENT_READY);
            this.heartBeatSender.startSendingHeartbeats();
        });
    }
    connect() {
        this.socket = io.connect({
            reconnection: false
        });
        this.heartBeatSender = new HeartBeatSender_1.HeartBeatSender(this.socket);
        if (this.socket != null) {
            this.configureSocket();
        }
    }
    configureSocket() {
        this.socket.on(SocketMsgs_1.SocketMsgs.START_GAME, this.startGame.bind(this));
        this.socket.on(SocketMsgs_1.SocketMsgs.INITIALIZE_GAME, (data) => {
            this.updateGame(data);
            this.startSendingInput();
        });
        this.socket.on(SocketMsgs_1.SocketMsgs.UPDATE_GAME, this.updateGame.bind(this));
    }
    startGame() {
        this.game = new Game_1.Game;
    }
    startSendingInput() {
        this.inputTtimeoutId = setTimeout(() => this.startSendingInput(), 1 / 10 * 1000);
        if (this.inputHandler.Changed) {
            let snapshot = this.inputHandler.cloneInputSnapshot();
            let serializedSnapshot = JSON.stringify(snapshot);
            this.socket.emit(SocketMsgs_1.SocketMsgs.INPUT_SNAPSHOT, serializedSnapshot);
        }
    }
    updateGame(data) {
        if (data['update'] == null) {
            return;
        }
        console.log(data['update']);
        let update = data['update'].split('$');
        for (let object in update) {
            let splitObject = update[object].split('-');
            let id = splitObject[0];
            let data = splitObject[1];
            if (id[0] == '!') {
                id = id.slice(1);
                if (this.netObjectMenager.has(id)) {
                    let gameObject = this.netObjectMenager.getObject(id).GameObject;
                    this.renderer.removeGameObject(gameObject);
                    this.game.removeObject(gameObject.ID);
                    this.netObjectMenager.removeObject(id);
                }
                continue;
            }
            let netObject = this.netObjectMenager.getObject(id);
            if (netObject == null) {
                let gameObject = ObjectsFactory_1.ObjectsFactory.CreateGameObject(id);
                netObject = this.netObjectMenager.createObject(gameObject, id);
                this.renderer.addGameObject(gameObject);
            }
            netObject.GameObject.deserialize(data.split('#'));
        }
        this.renderer.update();
    }
}
exports.GameClient = GameClient;

},{"../Common/Game":7,"../Common/net/NetObjectsManager":10,"../Common/net/SocketMsgs":11,"../Common/utils/ObjectsFactory":14,"./HeartBeatSender":2,"./InputHandler":3,"./graphic/Renderer":5}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SocketMsgs_1 = require("../Common/net/SocketMsgs");
class HeartBeatSender {
    constructor(socket, rate) {
        this.hbId = 0;
        this.rate = 1;
        this.isRunning = false;
        this.socket = socket;
        this.socket.on(SocketMsgs_1.SocketMsgs.HEARTBEAT_RESPONSE, this.heartBeatResponse.bind(this));
        this.heartBeats = new Map();
        if (rate != null) {
            this.rate = rate;
        }
    }
    heartBeatResponse(id) {
        let ping = new Date().getTime() - this.heartBeats.get(id);
        console.log('hbr ' + ping);
        if (this.isRunning) {
            setTimeout(() => this.startSendingHeartbeats(), 1 / this.rate * 1000);
        }
    }
    startSendingHeartbeats() {
        this.isRunning = true;
        this.socket.emit(SocketMsgs_1.SocketMsgs.HEARTBEAT, this.hbId);
        this.heartBeats.set(this.hbId, new Date().getTime());
        this.hbId++;
    }
    stopSendingHeartbeats() {
        this.isRunning = true;
    }
}
exports.HeartBeatSender = HeartBeatSender;

},{"../Common/net/SocketMsgs":11}],3:[function(require,module,exports){
"use strict";
/// <reference path="libs/@types/phaser.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const Position_1 = require("../Common/utils/Position");
const InputSnapshot_1 = require("../Common/InputSnapshot");
class InputHandler {
    constructor(phaserInput) {
        document.addEventListener("keydown", this.keyPressed);
        document.addEventListener("keyup", this.keyReleased);
        this.inputSnapshot = new InputSnapshot_1.InputSnapshot;
        this.changed = false;
        this.phaserInput = phaserInput;
        this.phaserInput.onDown.add(this.mouseClick, this);
        //this.phaserInput.addMoveCallback(this.mouseClick, this);
    }
    keyPressed(event) {
        console.log(event.keyCode);
    }
    keyReleased(event) {
        console.log(event.keyCode);
    }
    mouseClick(mouseEvent) {
        this.inputSnapshot.ClickPosition = new Position_1.Position(mouseEvent.x, mouseEvent.y);
        this.changed = true;
    }
    // public getSerializedSnapshot(): InputSnapshot {
    //     this.changed = false;
    //
    //     this.inputSnapshot.clear();
    //     return inputSnapshotCopy;
    // }
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

},{"../Common/InputSnapshot":8,"../Common/utils/Position":16}],4:[function(require,module,exports){
"use strict";
/// <reference path="../libs/@types/phaser.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
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
    hide() {
        this.sprite.destroy();
    }
}
exports.GameObjectRender = GameObjectRender;

},{}],5:[function(require,module,exports){
"use strict";
/// <reference path="../libs/@types/phaser.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectRender_1 = require("./GameObjectRender");
class Renderer {
    constructor(afterCreateCallback) {
        this.phaserGame = new Phaser.Game(800, 600, Phaser.AUTO, 'content', { preload: this.preload.bind(this), create: this.create.bind(this, afterCreateCallback) });
        this.renderObjectMap = new Map();
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
        this.renderObjectMap.forEach((gameObjectRender) => {
            gameObjectRender.render();
        });
    }
    addGameObject(gameObject) {
        let gameObjectRender = new GameObjectRender_1.GameObjectRender(this.phaserGame);
        gameObjectRender.GameObject = gameObject;
        this.renderObjectMap.set(gameObject, gameObjectRender);
    }
    removeGameObject(gameObject) {
        this.renderObjectMap.get(gameObject).hide();
        this.renderObjectMap.delete(gameObject);
    }
    get PhaserInput() {
        return this.phaserGame.input;
    }
}
exports.Renderer = Renderer;

},{"./GameObjectRender":4}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameClient_1 = require("./GameClient");
let client = new GameClient_1.GameClient();
client.connect();

},{"./GameClient":1}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Player_1 = require("./utils/Player");
class Game {
    constructor() {
        this.tickrate = 30;
        this.objects = new Map();
        console.log("create game instance");
    }
    startGameLoop() {
        this.timeoutId = setTimeout(() => this.startGameLoop(), 1 / this.tickrate * 1000);
        this.objects.forEach((object) => {
            object.update();
        });
    }
    stopGameLoop() {
        clearTimeout(this.timeoutId);
    }
    spawnPlayer(name, position) {
        let player;
        player = new Player_1.Player(name, position);
        this.objects.set(player.ID, player);
        //console.log("New player " + name);
        //console.log("Number of objects " + this.objects.size);
        return player;
    }
    removeObject(id) {
        this.objects.delete(id);
    }
    getObject(id) {
        return this.objects.get(id);
    }
}
exports.Game = Game;

},{"./utils/Player":15}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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

},{"../Common/utils/Position":16}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
Object.defineProperty(exports, "__esModule", { value: true });
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
    collectUpdate(complete = false) {
        let serializedObjects = '';
        this.netObjects.forEach((value, key) => {
            let netObject = this.netObjects.get(key);
            let objectUpdate = netObject.GameObject.serialize(complete).slice(1);
            if (objectUpdate != '') {
                serializedObjects += '$' + netObject.ID + '-' + objectUpdate;
            }
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
    has(id) {
        return this.netObjects.has(id);
    }
    removeObject(id) {
        return this.netObjects.delete(id);
    }
}
NetObjectsManager.NEXT_ID = 0;
exports.NetObjectsManager = NetObjectsManager;

},{"./NetObject":9}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SocketMsgs {
}
SocketMsgs.CLIENT_READY = 'cr';
SocketMsgs.START_GAME = 'sg';
SocketMsgs.INITIALIZE_GAME = 'ig';
SocketMsgs.HEARTBEAT = 'hb';
SocketMsgs.HEARTBEAT_RESPONSE = 'hbr';
SocketMsgs.UPDATE_GAME = 'ug';
SocketMsgs.INPUT_SNAPSHOT = 'is';
exports.SocketMsgs = SocketMsgs;

},{}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectTypes_1 = require("./GameObjectTypes");
const SerializeFunctionsMap_1 = require("./SerializeFunctionsMap");
class GameObject {
    constructor(position) {
        this.fCompleteUpdate = true;
        this.id = GameObject.NEXT_ID++;
        this.position = position;
        this.changes = new Set();
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.GameObject.toString();
    }
    forceCompleteUpdate() {
        this.fCompleteUpdate = true;
    }
    update() {
    }
    serialize(complete = false) {
        let update = "";
        if (this.fCompleteUpdate) {
            this.fCompleteUpdate = false;
            complete = true;
        }
        if (complete) {
            SerializeFunctionsMap_1.SerializeFunctionsMap.forEach((serializeFunc) => {
                update += serializeFunc(this);
            });
        }
        else {
            this.changes.forEach((field) => {
                if (SerializeFunctionsMap_1.SerializeFunctionsMap.has(field)) {
                    update += SerializeFunctionsMap_1.SerializeFunctionsMap.get(field)(this);
                    this.changes.delete(field);
                }
            });
        }
        this.changes.clear();
        return update;
    }
    deserialize(update) {
        for (let item of update) {
            if (SerializeFunctionsMap_1.DeserializeFunctionsMap.has(item[0])) {
                SerializeFunctionsMap_1.DeserializeFunctionsMap.get(item[0])(this, item.split(':')[1]);
            }
        }
    }
    get Position() {
        return this.position;
    }
    get ID() {
        return this.id;
    }
    static serializePosition(gameObject) {
        return '#P:' + gameObject.Position.X.toString() + ',' + gameObject.Position.Y.toString();
    }
    static deserializePosition(gameObject, data) {
        let x = data.split(',')[0];
        let y = data.split(',')[1];
        gameObject.position.X = parseFloat(x);
        gameObject.position.Y = parseFloat(y);
    }
}
GameObject.NEXT_ID = 0;
exports.GameObject = GameObject;
SerializeFunctionsMap_1.SerializeFunctionsMap.set('position', GameObject.serializePosition);
SerializeFunctionsMap_1.DeserializeFunctionsMap.set('P', GameObject.deserializePosition);

},{"./GameObjectTypes":13,"./SerializeFunctionsMap":17}],13:[function(require,module,exports){
"use strict";
/**
 * Created by Tomek on 2017-04-08.
 */
Object.defineProperty(exports, "__esModule", { value: true });
var GameObjectType;
(function (GameObjectType) {
    GameObjectType[GameObjectType["GameObject"] = 'G'] = "GameObject";
    GameObjectType[GameObjectType["Player"] = 'P'] = "Player";
})(GameObjectType = exports.GameObjectType || (exports.GameObjectType = {}));
exports.TypeIdMap = new Map();
exports.TypeIdMap.set('G', GameObjectType.GameObject);
exports.TypeIdMap.set('P', GameObjectType.Player);

},{}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Player_1 = require("./Player");
const Position_1 = require("./Position");
class ObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }
    static CreateGameObject(id) {
        let type = id.substr(0, 1);
        if (type == "P") {
            let player = new Player_1.Player('DEFAULT', new Position_1.Position(0, 0));
            return player;
        }
        return null;
    }
}
exports.ObjectsFactory = ObjectsFactory;

},{"./Player":15,"./Position":16}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
const GameObjectTypes_1 = require("./GameObjectTypes");
const SerializeFunctionsMap_1 = require("./SerializeFunctionsMap");
class Player extends GameObject_1.GameObject {
    get Type() {
        return GameObjectTypes_1.GameObjectType.Player.toString();
    }
    constructor(name, position) {
        super(position);
        this.name = name;
        this.hp = 100;
        this.destination = null;
    }
    update() {
        super.update();
        if (this.destination) {
            //this.position.X += (this.destination.X - this.position.X) / 10;
            //this.position.Y += (this.destination.Y - this.position.Y) / 10;
            this.position.X = this.destination.X;
            this.position.Y = this.destination.Y;
            this.destination = null;
            this.changes.add('position');
        }
        this.hit(Math.floor(Math.random() * 100));
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
    get HP() {
        return this.hp;
    }
    static serializeHp(player) {
        return '#H:' + player.HP.toString();
    }
    static deserializeHp(player, data) {
        player.hp = parseInt(data);
    }
    static serializeName(player) {
        return '#N:' + player.name;
    }
    static deserializeName(player, data) {
        player.name = data;
    }
}
exports.Player = Player;
SerializeFunctionsMap_1.SerializeFunctionsMap.set('hp', Player.serializeHp);
SerializeFunctionsMap_1.SerializeFunctionsMap.set('name', Player.serializeName);
SerializeFunctionsMap_1.DeserializeFunctionsMap.set('H', Player.deserializeHp);
SerializeFunctionsMap_1.DeserializeFunctionsMap.set('N', Player.deserializeName);

},{"./GameObject":12,"./GameObjectTypes":13,"./SerializeFunctionsMap":17}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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

},{}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SerializeFunctionsMap = new Map();
exports.DeserializeFunctionsMap = new Map();

},{}]},{},[6]);
