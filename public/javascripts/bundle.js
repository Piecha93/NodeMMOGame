(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
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

},{"../Common/net/SocketMsgs":19,"./graphic/HtmlHandlers/ChatHtmlHandler":5}],2:[function(require,module,exports){
"use strict";
class ClientConfig {
}
ClientConfig.INPUT_SNAPSHOT_TIMER = 1 / 5 * 1000;
exports.ClientConfig = ClientConfig;

},{}],3:[function(require,module,exports){
/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />
"use strict";
const Game_1 = require("../Common/Game");
const Renderer_1 = require("./graphic/Renderer");
const InputHandler_1 = require("./input/InputHandler");
const NetObjectsManager_1 = require("../Common/net/NetObjectsManager");
const ObjectsFactory_1 = require("../Common/utils/ObjectsFactory");
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
            this.player = this.game.getObject(parseInt(data['id']));
            console.log(this.player);
            this.inputHandler.startInputSnapshotTimer();
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
            if (gameObject == null) {
                gameObject = ObjectsFactory_1.ObjectsFactory.CreateGameObject(id);
                this.netObjectMenager.addGameObject(gameObject, id);
                this.game.addGameObject(gameObject);
                this.renderer.addGameObject(gameObject, id[0]);
            }
            if (id[0] == '!') {
                id = id.slice(1);
                if (this.netObjectMenager.has(id)) {
                    this.renderer.removeGameObject(gameObject);
                    this.game.removeGameObject(gameObject.ID);
                    this.netObjectMenager.removeGameObject(id);
                }
                continue;
            }
            gameObject.deserialize(data.split('#'));
        }
    }
}
exports.GameClient = GameClient;

},{"../Client/net/InputSender":13,"../Common/DeltaTimer":15,"../Common/Game":16,"../Common/net/NetObjectsManager":18,"../Common/net/SocketMsgs":19,"../Common/utils/ObjectsFactory":23,"./Chat":1,"./graphic/HtmlHandlers/DebugWindowHtmlHandler":6,"./graphic/Renderer":8,"./input/InputHandler":9,"./net/HeartBeatSender":12}],4:[function(require,module,exports){
/// <reference path="../libs/@types/phaser.d.ts" />
"use strict";
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
    hide() {
        this.sprite.destroy();
    }
}
exports.GameObjectRender = GameObjectRender;

},{"./Renderer":8}],5:[function(require,module,exports){
"use strict";
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

},{}],6:[function(require,module,exports){
"use strict";
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

},{}],7:[function(require,module,exports){
"use strict";
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

},{"./GameObjectRender":4,"./Renderer":8}],8:[function(require,module,exports){
/// <reference path="../libs/@types/phaser.d.ts" />
"use strict";
const GameObjectRender_1 = require("./GameObjectRender");
const PlayerRender_1 = require("./PlayerRender");
class Renderer {
    constructor(afterCreateCallback) {
        Renderer.phaserGame = new Phaser.Game(1024, 576, Phaser.AUTO, 'content', { preload: this.preload.bind(this), create: this.create.bind(this, afterCreateCallback) });
        this.renderObjectMap = new Map();
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
        this.renderObjectMap.forEach((gameObjectRender) => {
            gameObjectRender.render();
        });
    }
    addGameObject(gameObject, type) {
        let gameObjectRender;
        if (type == "P") {
            gameObjectRender = new PlayerRender_1.PlayerRender();
        }
        else {
            gameObjectRender = new GameObjectRender_1.GameObjectRender();
        }
        gameObjectRender.setObject(gameObject);
        this.renderObjectMap.set(gameObject, gameObjectRender);
    }
    removeGameObject(gameObject) {
        this.renderObjectMap.get(gameObject).hide();
        this.renderObjectMap.delete(gameObject);
    }
    get PhaserInput() {
        return Renderer.phaserGame.input;
    }
}
exports.Renderer = Renderer;

},{"./GameObjectRender":4,"./PlayerRender":7}],9:[function(require,module,exports){
/// <reference path="../libs/@types/phaser.d.ts" />
"use strict";
const InputSnapshot_1 = require("../../Common/input/InputSnapshot");
const InputMap_1 = require("./InputMap");
const Position_1 = require("../../Common/utils/Position");
const ClientConfig_1 = require("../ClientConfig");
class InputHandler {
    constructor(phaserInput) {
        this.lastDirection = 0;
        this.pressedKeys = new Set();
        this.releasedKeys = new Set();
        this.clickPosition = null;
        this.snapshotCallbacks = new Array();
        document.addEventListener("keydown", this.keyPressed.bind(this));
        document.addEventListener("keyup", this.keyReleased.bind(this));
        this.changed = false;
        this.phaserInput = phaserInput;
        this.phaserInput.onDown.add(this.mouseClick, this);
        //this.phaserInput.addMoveCallback(this.mouseClick, this);
    }
    addSnapshotCallback(callback) {
        this.snapshotCallbacks.push(callback);
    }
    startInputSnapshotTimer() {
        if (this.changed) {
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
        this.timeoutId = setTimeout(() => this.startInputSnapshotTimer(), ClientConfig_1.ClientConfig.INPUT_SNAPSHOT_TIMER);
    }
    stopInputSnapshotTimer() {
        clearTimeout(this.timeoutId);
    }
    keyPressed(event) {
        if (InputMap_1.InputMap.has(event.keyCode) && !this.pressedKeys.has(event.keyCode)) {
            this.changed = true;
            this.releasedKeys.delete(event.keyCode);
            this.pressedKeys.add(event.keyCode);
        }
    }
    keyReleased(event) {
        if (InputMap_1.InputMap.has(event.keyCode) && this.pressedKeys.has(event.keyCode)) {
            this.pressedKeys.delete(event.keyCode);
            this.releasedKeys.add(event.keyCode);
            this.changed = true;
        }
    }
    mouseClick(mouseEvent) {
        this.clickPosition = new Position_1.Position(mouseEvent.x, mouseEvent.y);
        this.changed = true;
    }
    createInputSnapshot() {
        this.changed = false;
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
    get Changed() {
        return this.changed;
    }
}
InputHandler.SnapshotId = 0;
exports.InputHandler = InputHandler;

},{"../../Common/input/InputSnapshot":17,"../../Common/utils/Position":25,"../ClientConfig":2,"./InputMap":10}],10:[function(require,module,exports){
"use strict";
(function (INPUT) {
    INPUT[INPUT["NONE"] = 0] = "NONE";
    INPUT[INPUT["UP"] = 1] = "UP";
    INPUT[INPUT["DOWN"] = 2] = "DOWN";
    INPUT[INPUT["LEFT"] = 3] = "LEFT";
    INPUT[INPUT["RIGHT"] = 4] = "RIGHT";
})(exports.INPUT || (exports.INPUT = {}));
var INPUT = exports.INPUT;
exports.InputMap = new Map([
    [87, INPUT.UP],
    [83, INPUT.DOWN],
    [65, INPUT.LEFT],
    [68, INPUT.RIGHT],
]);

},{}],11:[function(require,module,exports){
"use strict";
const GameClient_1 = require("./GameClient");
const CommonConfig_1 = require("../Common/CommonConfig");
CommonConfig_1.CommonConfig.ORIGIN = CommonConfig_1.Origin.CLIENT;
window.onload = () => {
    let client = new GameClient_1.GameClient();
};

},{"../Common/CommonConfig":14,"./GameClient":3}],12:[function(require,module,exports){
"use strict";
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

},{"../../Common/net/SocketMsgs":19,"../graphic/HtmlHandlers/DebugWindowHtmlHandler":6}],13:[function(require,module,exports){
"use strict";
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

},{"../../Common/net/SocketMsgs":19}],14:[function(require,module,exports){
"use strict";
(function (Origin) {
    Origin[Origin["CLIENT"] = 0] = "CLIENT";
    Origin[Origin["SERVER"] = 1] = "SERVER";
    Origin[Origin["UNKNOWN"] = 2] = "UNKNOWN";
})(exports.Origin || (exports.Origin = {}));
var Origin = exports.Origin;
class CommonConfig {
}
CommonConfig.ORIGIN = Origin.UNKNOWN;
exports.CommonConfig = CommonConfig;

},{}],15:[function(require,module,exports){
"use strict";
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

},{}],16:[function(require,module,exports){
"use strict";
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
        console.log("player id " + player.ID);
        this.objects.set(player.ID, player);
        //console.log("New player " + name);
        //console.log("Number of objects " + this.objects.size);
        return player;
    }
    addGameObject(gameObject) {
        this.objects.set(gameObject.ID, gameObject);
    }
    removeObject(id) {
        this.objects.delete(id);
    }
    getObject(id) {
        return this.objects.get(id);
    }
}
exports.Game = Game;

},{"./utils/Player":24}],17:[function(require,module,exports){
"use strict";
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

},{}],18:[function(require,module,exports){
"use strict";
class NetObjectsManager {
    constructor() {
        this.gameObjects = new Map();
    }
    static GetNextId(type) {
        NetObjectsManager.NEXT_ID++;
        return type + NetObjectsManager.NEXT_ID.toString();
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
    addGameObject(gameObject, id) {
        //TODO - sprawdzic czy dany gejmobject juz istnieje
        let newObjectId;
        if (id != null) {
            if (this.gameObjects.has(id)) {
                throw new Error("NetObject id duplication: " + id);
            }
            newObjectId = id;
        }
        else {
            newObjectId = NetObjectsManager.GetNextId(gameObject.Type);
            console.log("new " + gameObject.Type);
        }
        this.gameObjects.set(newObjectId, gameObject);
        return id;
    }
    removeGameObject(id) {
        return this.gameObjects.delete(id);
    }
    has(id) {
        return this.gameObjects.has(id);
    }
}
NetObjectsManager.NEXT_ID = 0;
exports.NetObjectsManager = NetObjectsManager;

},{}],19:[function(require,module,exports){
"use strict";
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

},{}],20:[function(require,module,exports){
"use strict";
const GameObject_1 = require("./GameObject");
const Position_1 = require("../../Common/utils/Position");
const GameObjectTypes_1 = require("../../Common/utils/GameObjectTypes");
class Bullet extends GameObject_1.GameObject {
    constructor() {
        super(new Position_1.Position(200, 200));
        this.velocity = 10;
        this.direction = 0;
        this.lifeSpan = 3;
        this.spriteName = "bullet";
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.Bullet.toString();
    }
    update() {
        this.position.X = this.position.X + 1;
        this.changes.add('position');
    }
}
exports.Bullet = Bullet;

},{"../../Common/utils/GameObjectTypes":22,"../../Common/utils/Position":25,"./GameObject":21}],21:[function(require,module,exports){
"use strict";
const GameObjectTypes_1 = require("./GameObjectTypes");
//import {SerializeFunctions, DeserializeFunctions} from "./SerializeFunctionsMap";
class GameObject {
    constructor(position) {
        this.forceComplete = true;
        this.id = GameObject.NEXT_ID++;
        this.position = position;
        this.changes = new Set();
        this.sFunc = GameObject.SerializeFunctions;
        this.dFunc = GameObject.DeserializeFunctions;
        this.spriteName = "bunny";
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.GameObject.toString();
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
    get Position() {
        return this.position;
    }
    get ID() {
        return this.id;
    }
    get SpriteName() {
        return this.spriteName;
    }
    set SpriteName(spriteName) {
        this.spriteName = spriteName;
        this.changes.add("spriteName");
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
    static serializeSpriteName(gameObject) {
        return '#S:' + gameObject.spriteName;
    }
    static deserializeSpriteName(gameObject, data) {
        gameObject.spriteName = data;
    }
}
GameObject.NEXT_ID = 0;
GameObject.SerializeFunctions = new Map([
    ['position', GameObject.serializePosition],
    ['spriteName', GameObject.serializeSpriteName],
]);
GameObject.DeserializeFunctions = new Map([
    ['P', GameObject.deserializePosition],
    ['S', GameObject.deserializeSpriteName],
]);
exports.GameObject = GameObject;
// SerializeFunctions.set('position', GameObject.serializePosition);
// DeserializeFunctions.set('P', GameObject.deserializePosition);
//
// SerializeFunctions.set('spriteName', GameObject.serializeSpriteName);
// DeserializeFunctions.set('S', GameObject.deserializeSpriteName); 

},{"./GameObjectTypes":22}],22:[function(require,module,exports){
/**
 * Created by Tomek on 2017-04-08.
 */
"use strict";
(function (GameObjectType) {
    GameObjectType[GameObjectType["GameObject"] = 'G'] = "GameObject";
    GameObjectType[GameObjectType["Player"] = 'P'] = "Player";
    GameObjectType[GameObjectType["Bullet"] = 'B'] = "Bullet";
})(exports.GameObjectType || (exports.GameObjectType = {}));
var GameObjectType = exports.GameObjectType;
exports.TypeIdMap = new Map();
exports.TypeIdMap.set('G', GameObjectType.GameObject);
exports.TypeIdMap.set('P', GameObjectType.Player);
exports.TypeIdMap.set('B', GameObjectType.Bullet);

},{}],23:[function(require,module,exports){
"use strict";
const Player_1 = require("./Player");
const Position_1 = require("./Position");
const Bullet_1 = require("../../Common/utils/Bullet");
class ObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }
    static CreateGameObject(id) {
        let type = id.substr(0, 1);
        if (type == "P") {
            return new Player_1.Player('DEFAULT', new Position_1.Position(0, 0));
        }
        else if (type == "B") {
            return new Bullet_1.Bullet();
        }
        return null;
    }
}
exports.ObjectsFactory = ObjectsFactory;

},{"../../Common/utils/Bullet":20,"./Player":24,"./Position":25}],24:[function(require,module,exports){
"use strict";
const GameObject_1 = require("./GameObject");
const GameObjectTypes_1 = require("./GameObjectTypes");
class Player extends GameObject_1.GameObject {
    constructor(name, position) {
        super(position);
        this.direction = 0;
        this.speed = 10;
        this.sFunc = new Map(function* () { yield* Player.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map(function* () { yield* Player.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
        this.name = name;
        this.hp = 100;
        this.destination = null;
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.Player.toString();
    }
    setInput(commands) {
        commands.forEach((value, key) => {
            if (key == "D") {
                this.direction = parseInt(value);
            }
        });
    }
    update() {
        super.update();
        let xFactor = 0;
        let yFactor = 0;
        if (this.direction == 1) {
            yFactor = -1;
        }
        else if (this.direction == 2) {
            xFactor = 0.7071;
            yFactor = -0.7071;
        }
        else if (this.direction == 3) {
            xFactor = 1;
        }
        else if (this.direction == 4) {
            xFactor = 0.7071;
            yFactor = 0.7071;
        }
        else if (this.direction == 5) {
            yFactor = 1;
        }
        else if (this.direction == 6) {
            xFactor = -0.7071;
            yFactor = 0.7071;
        }
        else if (this.direction == 7) {
            xFactor = -1;
        }
        else if (this.direction == 8) {
            xFactor = -0.7071;
            yFactor = -0.7071;
        }
        this.position.X += xFactor * this.speed;
        this.position.Y += yFactor * this.speed;
        if (this.direction != 0) {
            this.changes.add('position');
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
            this.direction = direction;
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
        return this.direction;
    }
    static serializeHp(player) {
        if (player instanceof Player) {
            return '#H:' + player.HP.toString();
        }
        else {
            return "";
        }
    }
    static deserializeHp(player, data) {
        player.hp = parseInt(data);
    }
    static serializeName(player) {
        if (player instanceof Player) {
            return '#N:' + player.name;
        }
        else {
            return "";
        }
    }
    static deserializeName(player, data) {
        player.name = data;
    }
}
Player.SerializeFunctions = new Map([
    ['hp', Player.serializeHp],
    ['name', Player.serializeName],
]);
Player.DeserializeFunctions = new Map([
    ['H', Player.deserializeHp],
    ['N', Player.deserializeName],
]);
exports.Player = Player;
// SerializeFunctions.set('hp', Player.serializeHp);
// SerializeFunctions.set('name', Player.serializeName);
//1
// DeserializeFunctions.set('H', Player.deserializeHp);
// DeserializeFunctions.set('N', Player.deserializeName);

},{"./GameObject":21,"./GameObjectTypes":22}],25:[function(require,module,exports){
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

},{}]},{},[11]);
