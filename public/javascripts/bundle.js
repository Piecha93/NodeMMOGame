(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ChatHtmlHandler_1 = require("./graphic/HtmlHandlers/ChatHtmlHandler");
const SocketMsgs_1 = require("../Common/net/SocketMsgs");
class Chat {
    constructor(socket) {
        this.socket = socket;
        this.socket.on(SocketMsgs_1.SocketMsgs.CHAT_MESSAGE, (data) => {
            this.chatHtmlHandler.append(data['s'], data['m']);
        });
        this.chatHtmlHandler = ChatHtmlHandler_1.ChatHtmlHandler.Instance;
        this.chatHtmlHandler.setSubmitCallback((text) => {
            this.socket.emit(SocketMsgs_1.SocketMsgs.CHAT_MESSAGE, text);
        });
    }
}
exports.Chat = Chat;

},{"../Common/net/SocketMsgs":18,"./graphic/HtmlHandlers/ChatHtmlHandler":4}],2:[function(require,module,exports){
"use strict";
/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const Game_1 = require("../Common/Game");
const Renderer_1 = require("./graphic/Renderer");
const InputHandler_1 = require("./input/InputHandler");
const NetObjectsManager_1 = require("../Common/net/NetObjectsManager");
const ObjectsFactory_1 = require("../Common/utils/game/ObjectsFactory");
const HeartBeatSender_1 = require("./net/HeartBeatSender");
const SocketMsgs_1 = require("../Common/net/SocketMsgs");
const Chat_1 = require("./Chat");
const InputSender_1 = require("../Client/net/InputSender");
const DeltaTimer_1 = require("../Common/DeltaTimer");
const DebugWindowHtmlHandler_1 = require("./graphic/HtmlHandlers/DebugWindowHtmlHandler");
class GameClient {
    constructor() {
        this.netObjectMenager = NetObjectsManager_1.NetObjectsManager.Instance;
        this.player = null;
        this.connect();
        this.game = new Game_1.Game;
        this.inputSender = new InputSender_1.InputSender(this.socket);
        this.heartBeatSender = new HeartBeatSender_1.HeartBeatSender(this.socket);
        this.chat = new Chat_1.Chat(this.socket);
        this.renderer = new Renderer_1.Renderer(() => {
            this.inputHandler = new InputHandler_1.InputHandler(this.renderer.PhaserInput);
            this.inputHandler.addSnapshotCallback(this.inputSender.sendInput.bind(this.inputSender));
            this.inputHandler.addSnapshotCallback((id, snapshot) => {
                if (this.player) {
                    this.player.setInput(snapshot.Commands);
                }
            });
            ObjectsFactory_1.ObjectsFactory.HolderSubscribers.push(this.renderer);
            ObjectsFactory_1.ObjectsFactory.HolderSubscribers.push(this.game);
            ObjectsFactory_1.ObjectsFactory.HolderSubscribers.push(this.netObjectMenager);
            this.socket.emit(SocketMsgs_1.SocketMsgs.CLIENT_READY);
        });
    }
    connect() {
        this.socket = io.connect({
            reconnection: false
        });
        if (this.socket != null) {
            this.configureSocket();
        }
        else {
            throw new Error("Cannot connect to server");
        }
    }
    configureSocket() {
        this.socket.on(SocketMsgs_1.SocketMsgs.START_GAME, this.startGame.bind(this));
        this.socket.on(SocketMsgs_1.SocketMsgs.INITIALIZE_GAME, (data) => {
            this.updateGame(data);
            this.player = this.game.getGameObject(data['id']);
            this.heartBeatSender.startSendingHeartbeats();
        });
        this.socket.on(SocketMsgs_1.SocketMsgs.UPDATE_GAME, this.updateGame.bind(this));
    }
    startGame() {
        this.game = new Game_1.Game;
        this.game.startGameLoop();
        let timer = new DeltaTimer_1.DeltaTimer;
        setInterval(() => {
            DebugWindowHtmlHandler_1.DebugWindowHtmlHandler.Instance.Fps = (1000 / timer.getDelta()).toPrecision(2).toString();
            this.renderer.update();
        }, 33.33);
    }
    updateGame(data) {
        if (data['update'] == null) {
            return;
        }
        let update = data['update'].split('$');
        console.log(update);
        for (let object in update) {
            let splitObject = update[object].split('-');
            let id = splitObject[0];
            let data = splitObject[1];
            let gameObject = this.netObjectMenager.getObject(id);
            if (id[0] == '!') {
                id = id.slice(1);
                gameObject = this.netObjectMenager.getObject(id);
                gameObject.destroy();
                continue;
            }
            if (gameObject == null) {
                gameObject = ObjectsFactory_1.ObjectsFactory.CreateGameObject(id);
            }
            gameObject.deserialize(data.split('#'));
        }
    }
}
exports.GameClient = GameClient;

},{"../Client/net/InputSender":12,"../Common/DeltaTimer":14,"../Common/Game":15,"../Common/net/NetObjectsManager":17,"../Common/net/SocketMsgs":18,"../Common/utils/game/ObjectsFactory":24,"./Chat":1,"./graphic/HtmlHandlers/DebugWindowHtmlHandler":5,"./graphic/Renderer":7,"./input/InputHandler":8,"./net/HeartBeatSender":11}],3:[function(require,module,exports){
"use strict";
/// <reference path="../libs/@types/phaser.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const Renderer_1 = require("./Renderer");
class GameObjectRender {
    constructor() {
    }
    setObject(gameObjectReference) {
        this.objectReference = gameObjectReference;
        let position = this.objectReference.Position;
        this.sprite = Renderer_1.Renderer.phaserGame.add.sprite(position.X, position.Y, this.objectReference.SpriteName);
        this.sprite.anchor.setTo(0.5, 0.5);
    }
    render() {
        if (!this.sprite) {
            return;
        }
        let position = this.objectReference.Position;
        this.sprite.x = position.X;
        this.sprite.y = position.Y;
        if (this.sprite.texture.baseTexture.source.name != this.objectReference.SpriteName) {
            this.sprite.loadTexture(this.objectReference.SpriteName);
        }
    }
    destroy() {
        this.sprite.destroy();
    }
}
exports.GameObjectRender = GameObjectRender;

},{"./Renderer":7}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ChatHtmlHandler {
    constructor() {
        this.create();
    }
    static get Instance() {
        if (ChatHtmlHandler.instance) {
            return ChatHtmlHandler.instance;
        }
        else {
            ChatHtmlHandler.instance = new ChatHtmlHandler;
            return ChatHtmlHandler.instance;
        }
    }
    create() {
        ChatHtmlHandler.instance = this;
        this.chatInput = document.getElementById("chat-input");
        this.chatForm = document.getElementById("chat-form");
        this.chatForm.onsubmit = () => {
            if (this.chatInput.value != "") {
                this.callSubmitCallback(this.chatInput.value);
                this.chatInput.value = "";
            }
            this.chatInput.blur();
            return false;
        };
        document.addEventListener("keypress", (event) => {
            if (event.keyCode == 13) {
                event.stopPropagation();
                this.chatInput.focus();
            }
        });
        this.chatInput.addEventListener("focusin", () => {
            //console.log("focusin" + this.chatForm.style);
            this.chatInput.style.color = "rgba(85, 85, 85, 1)";
        });
        this.chatInput.addEventListener("focusout", () => {
            //console.log("focusout" + this.chatForm.style);
            this.chatInput.style.color = "rgba(85, 85, 85, 0.1)";
        });
        let chatZone = document.getElementById("chat-zone");
        chatZone.addEventListener("mousedown", (event) => {
            return false;
        });
    }
    callSubmitCallback(text) {
        if (this.submitCallback) {
            this.submitCallback(text);
        }
    }
    setSubmitCallback(submitCallback) {
        this.submitCallback = submitCallback;
    }
    append(sender, message) {
        let htmlMessageeSender = document.createElement("span");
        htmlMessageeSender.innerHTML = "<b>" + sender + "</b>: ";
        htmlMessageeSender.style.color = "rgb(50, 50, 85)";
        let htmlMessageeContent = document.createElement("span");
        htmlMessageeContent.textContent = message;
        htmlMessageeContent.style.color = "rgb(85, 85, 85)";
        let htmlMessagee = document.createElement("span");
        htmlMessagee.id = "chat-msg";
        htmlMessagee.appendChild(htmlMessageeSender);
        htmlMessagee.appendChild(htmlMessageeContent);
        htmlMessagee.appendChild(document.createElement("br"));
        let messagesDiv = document.getElementById("chat-msgs");
        messagesDiv.appendChild(htmlMessagee);
        if (messagesDiv.childNodes.length > 100) {
            messagesDiv.removeChild(messagesDiv.firstChild);
        }
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}
exports.ChatHtmlHandler = ChatHtmlHandler;

},{}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DebugWindowHtmlHandler {
    constructor() {
        this.debugWindowDiv = document.getElementById("debug-window");
        this.pingSpan = document.createElement("span");
        this.fpsSpan = document.createElement("span");
        this.Ping = "";
        this.Fps = "";
        this.debugWindowDiv.appendChild(this.pingSpan);
        this.debugWindowDiv.appendChild(this.fpsSpan);
    }
    static get Instance() {
        if (DebugWindowHtmlHandler.instance) {
            return DebugWindowHtmlHandler.instance;
        }
        else {
            DebugWindowHtmlHandler.instance = new DebugWindowHtmlHandler;
            return DebugWindowHtmlHandler.instance;
        }
    }
    set Ping(ping) {
        this.pingSpan.textContent = "Ping(ms): " + ping;
    }
    set Fps(fps) {
        this.fpsSpan.innerHTML = "<br>" + "Fps: " + fps;
    }
}
exports.DebugWindowHtmlHandler = DebugWindowHtmlHandler;

},{}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectRender_1 = require("./GameObjectRender");
const Renderer_1 = require("./Renderer");
class PlayerRender extends GameObjectRender_1.GameObjectRender {
    constructor() {
        super();
    }
    setObject(player) {
        super.setObject(player);
        this.playerReference = player;
        this.nameText = Renderer_1.Renderer.phaserGame.add.text(0, 0, this.playerReference.Name, {
            font: "bold 11px Arial",
            fill: "#ffffff"
        });
        this.nameText.anchor.setTo(0.5, 2);
        this.sprite.addChild(this.nameText);
    }
    render() {
        super.render();
        if (this.sprite) {
            this.nameText.text = this.playerReference.Name;
        }
    }
}
exports.PlayerRender = PlayerRender;

},{"./GameObjectRender":3,"./Renderer":7}],7:[function(require,module,exports){
"use strict";
/// <reference path="../libs/@types/phaser.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectsHolder_1 = require("../../Common/utils/game/GameObjectsHolder");
const GameObjectRender_1 = require("./GameObjectRender");
const PlayerRender_1 = require("./PlayerRender");
class Renderer extends GameObjectsHolder_1.GameObjectsHolder {
    constructor(afterCreateCallback) {
        super();
        Renderer.phaserGame = new Phaser.Game(1024, 576, Phaser.AUTO, 'content', { preload: this.preload.bind(this), create: this.create.bind(this, afterCreateCallback) });
        this.renderObjects = new Map();
    }
    preload() {
        Renderer.phaserGame.load.image('bunny', 'resources/images/bunny.png');
        Renderer.phaserGame.load.image('dyzma', 'resources/images/dyzma.jpg');
        Renderer.phaserGame.load.image('bullet', 'resources/images/bullet.png');
        //this.phaserGame.load.onLoadComplete.addOnce(() => { console.log("ASSETS LOAD COMPLETE"); });
    }
    create(afterCreateCallback) {
        //console.log("PHASER CREATE");
        afterCreateCallback();
    }
    update() {
        this.renderObjects.forEach((gameObjectRender) => {
            gameObjectRender.render();
        });
    }
    addGameObject(gameObject) {
        super.addGameObject(gameObject);
        let gameObjectRender;
        let type = gameObject.ID[0];
        if (type == "P") {
            gameObjectRender = new PlayerRender_1.PlayerRender();
        }
        else {
            gameObjectRender = new GameObjectRender_1.GameObjectRender();
        }
        gameObjectRender.setObject(gameObject);
        this.renderObjects.set(gameObject, gameObjectRender);
    }
    removeGameObject(gameObject) {
        super.removeGameObject(gameObject);
        this.renderObjects.get(gameObject).destroy();
        this.renderObjects.delete(gameObject);
    }
    get PhaserInput() {
        return Renderer.phaserGame.input;
    }
}
exports.Renderer = Renderer;

},{"../../Common/utils/game/GameObjectsHolder":23,"./GameObjectRender":3,"./PlayerRender":6}],8:[function(require,module,exports){
"use strict";
/// <reference path="../libs/@types/phaser.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const InputSnapshot_1 = require("../../Common/input/InputSnapshot");
const InputMap_1 = require("./InputMap");
const Position_1 = require("../../Common/utils/game/Position");
class InputHandler {
    constructor(phaserInput) {
        this.lastDirection = 0;
        this.pressedKeys = new Set();
        this.releasedKeys = new Set();
        this.clickPosition = null;
        this.snapshotCallbacks = new Array();
        document.addEventListener("keydown", this.keyPressed.bind(this));
        document.addEventListener("keyup", this.keyReleased.bind(this));
        //this.changed = false;
        this.phaserInput = phaserInput;
        this.phaserInput.onDown.add(this.mouseClick, this);
        //this.phaserInput.addMoveCallback(this.mouseClick, this);
    }
    addSnapshotCallback(callback) {
        this.snapshotCallbacks.push(callback);
    }
    keyPressed(event) {
        if (InputMap_1.InputMap.has(event.keyCode) && !this.pressedKeys.has(event.keyCode)) {
            this.releasedKeys.delete(event.keyCode);
            this.pressedKeys.add(event.keyCode);
            this.serializeSnapshot();
        }
    }
    keyReleased(event) {
        if (InputMap_1.InputMap.has(event.keyCode) && this.pressedKeys.has(event.keyCode)) {
            this.pressedKeys.delete(event.keyCode);
            this.releasedKeys.add(event.keyCode);
            this.serializeSnapshot();
        }
    }
    mouseClick(mouseEvent) {
        this.clickPosition = new Position_1.Position(mouseEvent.x, mouseEvent.y);
        this.serializeSnapshot();
    }
    serializeSnapshot() {
        let snapshot = this.createInputSnapshot();
        let serializedSnapshot = JSON.stringify(snapshot);
        if (serializedSnapshot.length == 0) {
            return;
        }
        let id = InputHandler.SnapshotId++;
        this.snapshotCallbacks.forEach((callback) => {
            callback(id, snapshot);
        });
    }
    createInputSnapshot() {
        let inputSnapshot = new InputSnapshot_1.InputSnapshot;
        let directionBuffor = new Array(4);
        let inputPressed = new Set();
        this.pressedKeys.forEach((key) => {
            let input = InputMap_1.InputMap.get(key);
            if (input == InputMap_1.INPUT.UP || input == InputMap_1.INPUT.DOWN || input == InputMap_1.INPUT.LEFT || input == InputMap_1.INPUT.RIGHT) {
                directionBuffor.push(input);
            }
            else {
                inputPressed.add(input);
            }
        });
        let newDirection = this.parseDirection(directionBuffor);
        if (newDirection != this.lastDirection) {
            this.lastDirection = newDirection;
            inputSnapshot.append("D", newDirection.toString());
        }
        if (this.clickPosition != null) {
            inputSnapshot.append("C", this.clickPosition.X.toString() + ";" + this.clickPosition.Y.toString());
            this.clickPosition = null;
        }
        this.releasedKeys.clear();
        return inputSnapshot;
    }
    parseDirection(directionBuffor) {
        let direction = 0;
        if (directionBuffor.indexOf(InputMap_1.INPUT.UP) != -1 && directionBuffor.indexOf(InputMap_1.INPUT.RIGHT) != -1) {
            direction = 2;
        }
        else if (directionBuffor.indexOf(InputMap_1.INPUT.DOWN) != -1 && directionBuffor.indexOf(InputMap_1.INPUT.RIGHT) != -1) {
            direction = 4;
        }
        else if (directionBuffor.indexOf(InputMap_1.INPUT.DOWN) != -1 && directionBuffor.indexOf(InputMap_1.INPUT.LEFT) != -1) {
            direction = 6;
        }
        else if (directionBuffor.indexOf(InputMap_1.INPUT.UP) != -1 && directionBuffor.indexOf(InputMap_1.INPUT.LEFT) != -1) {
            direction = 8;
        }
        else if (directionBuffor.indexOf(InputMap_1.INPUT.UP) != -1) {
            direction = 1;
        }
        else if (directionBuffor.indexOf(InputMap_1.INPUT.RIGHT) != -1) {
            direction = 3;
        }
        else if (directionBuffor.indexOf(InputMap_1.INPUT.LEFT) != -1) {
            direction = 7;
        }
        else if (directionBuffor.indexOf(InputMap_1.INPUT.DOWN) != -1) {
            direction = 5;
        }
        return direction;
    }
}
InputHandler.SnapshotId = 0;
exports.InputHandler = InputHandler;

},{"../../Common/input/InputSnapshot":16,"../../Common/utils/game/Position":26,"./InputMap":9}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var INPUT;
(function (INPUT) {
    INPUT[INPUT["NONE"] = 0] = "NONE";
    INPUT[INPUT["UP"] = 1] = "UP";
    INPUT[INPUT["DOWN"] = 2] = "DOWN";
    INPUT[INPUT["LEFT"] = 3] = "LEFT";
    INPUT[INPUT["RIGHT"] = 4] = "RIGHT";
})(INPUT = exports.INPUT || (exports.INPUT = {}));
exports.InputMap = new Map([
    [87, INPUT.UP],
    [83, INPUT.DOWN],
    [65, INPUT.LEFT],
    [68, INPUT.RIGHT],
]);

},{}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameClient_1 = require("./GameClient");
const CommonConfig_1 = require("../Common/CommonConfig");
CommonConfig_1.CommonConfig.ORIGIN = CommonConfig_1.Origin.CLIENT;
window.onload = () => {
    let client = new GameClient_1.GameClient();
};

},{"../Common/CommonConfig":13,"./GameClient":2}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SocketMsgs_1 = require("../../Common/net/SocketMsgs");
const DebugWindowHtmlHandler_1 = require("../graphic/HtmlHandlers/DebugWindowHtmlHandler");
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
        //console.log('hbr ' + ping);
        DebugWindowHtmlHandler_1.DebugWindowHtmlHandler.Instance.Ping = ping.toString();
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
        this.isRunning = false;
    }
}
exports.HeartBeatSender = HeartBeatSender;

},{"../../Common/net/SocketMsgs":18,"../graphic/HtmlHandlers/DebugWindowHtmlHandler":5}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SocketMsgs_1 = require("../../Common/net/SocketMsgs");
class InputSender {
    constructor(socket) {
        this.socket = socket;
    }
    sendInput(id, snapshot) {
        let serializedSnapshot = snapshot.serializeSnapshot();
        //console.log(serializedSnapshot);
        if (serializedSnapshot.length > 0) {
            this.socket.emit(SocketMsgs_1.SocketMsgs.INPUT_SNAPSHOT, { id, serializedSnapshot });
        }
    }
}
exports.InputSender = InputSender;

},{"../../Common/net/SocketMsgs":18}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Origin;
(function (Origin) {
    Origin[Origin["CLIENT"] = 0] = "CLIENT";
    Origin[Origin["SERVER"] = 1] = "SERVER";
    Origin[Origin["UNKNOWN"] = 2] = "UNKNOWN";
})(Origin = exports.Origin || (exports.Origin = {}));
class CommonConfig {
}
CommonConfig.ORIGIN = Origin.UNKNOWN;
exports.CommonConfig = CommonConfig;

},{}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DeltaTimer {
    constructor() {
        this.lastUpdate = new Date().getTime();
    }
    getDelta() {
        this.currentTime = new Date().getTime();
        this.delta = this.currentTime - this.lastUpdate;
        this.lastUpdate = this.currentTime;
        return this.delta;
    }
    ;
}
exports.DeltaTimer = DeltaTimer;

},{}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectsHolder_1 = require("./utils/game/GameObjectsHolder");
class Game extends GameObjectsHolder_1.GameObjectsHolder {
    constructor() {
        super();
        this.tickrate = 30;
        console.log("create game instance");
    }
    startGameLoop() {
        this.timeoutId = setTimeout(() => this.startGameLoop(), 1 / this.tickrate * 1000);
        this.gameObjects.forEach((object) => {
            object.update();
        });
    }
    stopGameLoop() {
        clearTimeout(this.timeoutId);
    }
}
exports.Game = Game;

},{"./utils/game/GameObjectsHolder":23}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class InputSnapshot {
    constructor(serializedSnapshot) {
        if (serializedSnapshot) {
            this.deserialize(serializedSnapshot);
        }
        else {
            this.commandList = new Map();
        }
    }
    get Commands() {
        return this.commandList;
    }
    append(command, value) {
        this.commandList.set(command, value);
    }
    serializeSnapshot() {
        let serializedSnapshot = '';
        this.commandList.forEach((value, key) => {
            serializedSnapshot += '#' + key + ':' + value;
        });
        return serializedSnapshot.slice(1);
    }
    deserialize(serializedSnapshot) {
        this.commandList = new Map();
        let commands = serializedSnapshot.split('#');
        commands.forEach((command) => {
            let splited = command.split(':');
            this.commandList.set(splited[0], splited[1]);
        });
    }
}
exports.InputSnapshot = InputSnapshot;

},{}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectsHolder_1 = require("../utils/game/GameObjectsHolder");
class NetObjectsManager extends GameObjectsHolder_1.GameObjectsHolder {
    constructor() {
        super();
    }
    static get Instance() {
        if (NetObjectsManager.instance) {
            return NetObjectsManager.instance;
        }
        else {
            NetObjectsManager.instance = new NetObjectsManager;
            return NetObjectsManager.instance;
        }
    }
    collectUpdate(complete = false) {
        let serializedObjects = '';
        this.gameObjects.forEach((gameObject, id) => {
            let objectUpdate = gameObject.serialize(complete).slice(1);
            if (objectUpdate != '') {
                serializedObjects += '$' + id + '-' + objectUpdate;
            }
        });
        serializedObjects = serializedObjects.slice(1);
        return serializedObjects;
    }
    getObject(id) {
        return this.gameObjects.get(id);
    }
}
exports.NetObjectsManager = NetObjectsManager;

},{"../utils/game/GameObjectsHolder":23}],18:[function(require,module,exports){
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
SocketMsgs.CHAT_MESSAGE = 'ch';
exports.SocketMsgs = SocketMsgs;

},{}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
const GameObjectTypes_1 = require("./GameObjectTypes");
const ChangesDict_1 = require("./ChangesDict");
class Bullet extends GameObject_1.GameObject {
    constructor(position) {
        super(position);
        this.lifeSpan = 300;
        this.asd = 0;
        this.id = this.Type + this.id;
        this.spriteName = "bullet";
        this.lifeSpan = Math.floor(Math.random() * 20) + 100;
        this.velocity = Math.floor(Math.random() * 50) + 1;
        this.directionAngle = Math.floor(Math.random() * 360);
        this.changes.add(ChangesDict_1.ChangesDict.VELOCITY);
        this.changes.add(ChangesDict_1.ChangesDict.LIFE_SPAN);
        this.sFunc = new Map(function* () { yield* Bullet.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map(function* () { yield* Bullet.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.Bullet.toString();
    }
    update() {
        this.asd++;
        if (this.asd > this.lifeSpan) {
            this.destroy();
        }
        let sinAngle = Math.sin(this.directionAngle);
        let cosAngle = Math.cos(this.directionAngle);
        this.position.X += cosAngle * this.velocity;
        this.position.Y += sinAngle * this.velocity;
        //this.changes.add(ChangesDict.POSITION);
    }
    set DirectionAngle(angle) {
        this.directionAngle = angle;
        this.changes.add(ChangesDict_1.ChangesDict.DIRECTION_ANGLE);
    }
    static serializeDirectionAngle(bullet) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.DIRECTION_ANGLE) + bullet.directionAngle;
    }
    static deserializeDirectionAngle(bullet, data) {
        bullet.directionAngle = parseFloat(data);
    }
    static serializeLifeSpan(bullet) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.LIFE_SPAN) + bullet.lifeSpan;
    }
    static deserializeLifeSpan(bullet, data) {
        bullet.lifeSpan = parseInt(data);
    }
}
Bullet.SerializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.LIFE_SPAN, Bullet.serializeLifeSpan],
    [ChangesDict_1.ChangesDict.DIRECTION_ANGLE, Bullet.serializeDirectionAngle],
]);
Bullet.DeserializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.LIFE_SPAN, Bullet.deserializeLifeSpan],
    [ChangesDict_1.ChangesDict.DIRECTION_ANGLE, Bullet.deserializeDirectionAngle],
]);
exports.Bullet = Bullet;

},{"./ChangesDict":20,"./GameObject":21,"./GameObjectTypes":22}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ChangesDict {
    static buildTag(char) {
        return '#' + char + ':';
    }
}
//GameObject
ChangesDict.VELOCITY = 'V';
ChangesDict.SPRITE = 'S';
ChangesDict.POSITION = 'P';
//Player
ChangesDict.HP = 'H';
ChangesDict.NAME = 'N';
//Bullet
ChangesDict.LIFE_SPAN = 'L';
ChangesDict.DIRECTION_ANGLE = 'A';
exports.ChangesDict = ChangesDict;

},{}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ChangesDict_1 = require("./ChangesDict");
class GameObject {
    constructor(position) {
        this.id = (GameObject.NEXT_ID++).toString();
        this.velocity = 10;
        this.forceComplete = true;
        this.position = position;
        this.changes = new Set();
        this.sFunc = GameObject.SerializeFunctions;
        this.dFunc = GameObject.DeserializeFunctions;
        this.spriteName = "bunny";
        this.destroyListeners = new Set();
    }
    forceCompleteUpdate() {
        this.forceComplete = true;
    }
    update() {
    }
    serialize(complete = false) {
        let update = "";
        if (this.forceComplete) {
            this.forceComplete = false;
            complete = true;
        }
        if (complete) {
            this.sFunc.forEach((serializeFunc) => {
                update += serializeFunc(this);
            });
        }
        else {
            this.changes.forEach((field) => {
                if (this.sFunc.has(field)) {
                    update += this.sFunc.get(field)(this);
                    this.changes.delete(field);
                }
            });
        }
        this.changes.clear();
        return update;
    }
    deserialize(update) {
        for (let item of update) {
            if (this.dFunc.has(item[0])) {
                this.dFunc.get(item[0])(this, item.split(':')[1]);
            }
        }
    }
    addDestroyListener(listener) {
        this.destroyListeners.add(listener);
    }
    removeDestroyListener(listener) {
        this.destroyListeners.delete(listener);
    }
    destroy() {
        for (let listener of this.destroyListeners) {
            listener(this.id);
        }
        this.destroyListeners.clear();
    }
    get Position() {
        return this.position;
    }
    get ID() {
        return this.id;
    }
    set ID(id) {
        this.id = id;
    }
    get SpriteName() {
        return this.spriteName;
    }
    set SpriteName(spriteName) {
        this.spriteName = spriteName;
        this.changes.add(ChangesDict_1.ChangesDict.SPRITE);
    }
    static serializePosition(gameObject) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.POSITION) + gameObject.Position.X.toString() + ',' + gameObject.Position.Y.toString();
    }
    static deserializePosition(gameObject, data) {
        let x = data.split(',')[0];
        let y = data.split(',')[1];
        gameObject.position.X = parseFloat(x);
        gameObject.position.Y = parseFloat(y);
    }
    static serializeSpriteName(gameObject) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.SPRITE) + gameObject.spriteName;
    }
    static deserializeSpriteName(gameObject, data) {
        gameObject.spriteName = data;
    }
    static serializeVelocity(bullet) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.VELOCITY) + bullet.velocity;
    }
    static deserializeVelocity(bullet, data) {
        bullet.velocity = parseFloat(data);
    }
}
GameObject.NEXT_ID = 0;
GameObject.SerializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.POSITION, GameObject.serializePosition],
    [ChangesDict_1.ChangesDict.SPRITE, GameObject.serializeSpriteName],
    [ChangesDict_1.ChangesDict.VELOCITY, GameObject.serializeVelocity],
]);
GameObject.DeserializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.POSITION, GameObject.deserializePosition],
    [ChangesDict_1.ChangesDict.SPRITE, GameObject.deserializeSpriteName],
    [ChangesDict_1.ChangesDict.VELOCITY, GameObject.deserializeVelocity],
]);
exports.GameObject = GameObject;
// SerializeFunctions.set('position', GameObject.serializePosition);
// DeserializeFunctions.set('P', GameObject.deserializePosition);
//
// SerializeFunctions.set('spriteName', GameObject.serializeSpriteName);
// DeserializeFunctions.set('S', GameObject.deserializeSpriteName); 

},{"./ChangesDict":20}],22:[function(require,module,exports){
"use strict";
/**
 * Created by Tomek on 2017-04-08.
 */
Object.defineProperty(exports, "__esModule", { value: true });
var GameObjectType;
(function (GameObjectType) {
    GameObjectType[GameObjectType["GameObject"] = 'G'] = "GameObject";
    GameObjectType[GameObjectType["Player"] = 'P'] = "Player";
    GameObjectType[GameObjectType["Bullet"] = 'B'] = "Bullet";
})(GameObjectType = exports.GameObjectType || (exports.GameObjectType = {}));
exports.TypeIdMap = new Map();
exports.TypeIdMap.set('G', GameObjectType.GameObject);
exports.TypeIdMap.set('P', GameObjectType.Player);
exports.TypeIdMap.set('B', GameObjectType.Bullet);

},{}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class GameObjectsHolder {
    constructor() {
        this.gameObjects = new Map();
    }
    onDestroy(id) {
        this.removeGameObjectById(id);
    }
    addGameObject(gameObject) {
        gameObject.addDestroyListener(this.onDestroy.bind(this));
        this.gameObjects.set(gameObject.ID, gameObject);
    }
    removeGameObject(gameObject) {
        this.gameObjects.delete(gameObject.ID);
    }
    removeGameObjectById(id) {
        if (this.gameObjects.has(id)) {
            this.removeGameObject(this.gameObjects.get(id));
        }
    }
    getGameObject(id) {
        return this.gameObjects.get(id);
    }
    has(id) {
        return this.gameObjects.has(id);
    }
}
exports.GameObjectsHolder = GameObjectsHolder;

},{}],24:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Player_1 = require("./Player");
const Position_1 = require("./Position");
const Bullet_1 = require("./Bullet");
//TODO maybe make this facrory as singleton??????
class ObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }
    static CreateGameObject(id, position) {
        let type = id.substr(0, 1);
        if (position == null) {
            position = new Position_1.Position(0, 0);
        }
        let gameObject = null;
        if (type == "P") {
            gameObject = new Player_1.Player('DEFAULT', position);
        }
        else if (type == "B") {
            gameObject = new Bullet_1.Bullet(position);
        }
        if (gameObject) {
            if (id.length > 1) {
                gameObject.ID = id;
            }
            ObjectsFactory.HolderSubscribers.forEach((subscriber) => {
                subscriber.addGameObject(gameObject);
            });
            ObjectsFactory.DestroySubscribers.forEach((subscriber) => {
                gameObject.addDestroyListener(subscriber);
            });
        }
        return gameObject;
    }
}
ObjectsFactory.HolderSubscribers = new Array();
ObjectsFactory.DestroySubscribers = new Array();
exports.ObjectsFactory = ObjectsFactory;

},{"./Bullet":19,"./Player":25,"./Position":26}],25:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
const GameObjectTypes_1 = require("./GameObjectTypes");
const ChangesDict_1 = require("./ChangesDict");
class Player extends GameObject_1.GameObject {
    constructor(name, position) {
        super(position);
        this.moveDirection = 0;
        this.id = this.Type + this.id;
        this.sFunc = new Map(function* () { yield* Player.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map(function* () { yield* Player.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
        this.name = name;
        this.hp = 100;
        this.destination = null;
        this.velocity = 10;
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.Player.toString();
    }
    setInput(commands) {
        commands.forEach((value, key) => {
            if (key == "D") {
                this.moveDirection = parseInt(value);
            }
        });
    }
    update() {
        super.update();
        let xFactor = 0;
        let yFactor = 0;
        if (this.moveDirection == 1) {
            yFactor = -1;
        }
        else if (this.moveDirection == 2) {
            xFactor = 0.7071;
            yFactor = -0.7071;
        }
        else if (this.moveDirection == 3) {
            xFactor = 1;
        }
        else if (this.moveDirection == 4) {
            xFactor = 0.7071;
            yFactor = 0.7071;
        }
        else if (this.moveDirection == 5) {
            yFactor = 1;
        }
        else if (this.moveDirection == 6) {
            xFactor = -0.7071;
            yFactor = 0.7071;
        }
        else if (this.moveDirection == 7) {
            xFactor = -1;
        }
        else if (this.moveDirection == 8) {
            xFactor = -0.7071;
            yFactor = -0.7071;
        }
        this.position.X += xFactor * this.velocity;
        this.position.Y += yFactor * this.velocity;
        if (this.moveDirection != 0) {
            this.changes.add(ChangesDict_1.ChangesDict.POSITION);
        }
    }
    get Destination() {
        return this.destination;
    }
    set Destination(destination) {
        this.destination = destination;
    }
    set Direction(direction) {
        if (direction >= 0 && direction <= 8) {
            this.moveDirection = direction;
        }
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
    get Name() {
        return this.name;
    }
    get Direction() {
        return this.moveDirection;
    }
    static serializeHp(player) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.HP) + player.HP.toString();
    }
    static deserializeHp(player, data) {
        player.hp = parseInt(data);
    }
    static serializeName(player) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.NAME) + player.name;
    }
    static deserializeName(player, data) {
        player.name = data;
    }
}
Player.SerializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.HP, Player.serializeHp],
    [ChangesDict_1.ChangesDict.NAME, Player.serializeName],
]);
Player.DeserializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.HP, Player.deserializeHp],
    [ChangesDict_1.ChangesDict.NAME, Player.deserializeName],
]);
exports.Player = Player;

},{"./ChangesDict":20,"./GameObject":21,"./GameObjectTypes":22}],26:[function(require,module,exports){
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

},{}]},{},[10]);
