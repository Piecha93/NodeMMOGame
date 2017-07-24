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

},{"../Common/net/SocketMsgs":20,"./graphic/HtmlHandlers/ChatHtmlHandler":6}],2:[function(require,module,exports){
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
        this.game = new Game_1.Game();
        this.inputSender = new InputSender_1.InputSender(this.socket);
        this.heartBeatSender = new HeartBeatSender_1.HeartBeatSender(this.socket);
        this.chat = new Chat_1.Chat(this.socket);
        this.renderer = new Renderer_1.Renderer(() => {
            this.inputHandler = new InputHandler_1.InputHandler();
            this.inputHandler.addSnapshotCallback(this.inputSender.sendInput.bind(this.inputSender));
            // this.inputHandler.addSnapshotCallback((id:number, snapshot: InputSnapshot) => {
            //     if(this.player) {
            //         this.player.setInput(snapshot.Commands);
            //     }
            // });
            ObjectsFactory_1.ObjectsFactory.HolderSubscribers.push(this.renderer);
            ObjectsFactory_1.ObjectsFactory.HolderSubscribers.push(this.game);
            ObjectsFactory_1.ObjectsFactory.HolderSubscribers.push(this.netObjectMenager);
            this.socket.emit(SocketMsgs_1.SocketMsgs.CLIENT_READY);
            // this.game.Cells.forEach((cell: Cell) => {
            //     this.renderer.addCell(cell);
            // });
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
        let timer = new DeltaTimer_1.DeltaTimer;
        let deltaHistory = new Array();
        setInterval(() => {
            let delta = timer.getDelta();
            this.game.update(delta);
            this.renderer.update();
            deltaHistory.push(delta);
            if (deltaHistory.length > 30)
                deltaHistory.splice(0, 1);
            let deltaAvg = 0;
            deltaHistory.forEach((delta) => {
                deltaAvg += delta;
            });
            deltaAvg /= deltaHistory.length;
            DebugWindowHtmlHandler_1.DebugWindowHtmlHandler.Instance.Fps = (1000 / deltaAvg).toPrecision(2).toString();
        }, 15);
    }
    updateGame(data) {
        if (data['update'] == null) {
            return;
        }
        let update = data['update'].split('$');
        //console.log(update);
        for (let object in update) {
            let splitObject = update[object].split('-');
            let id = splitObject[0];
            let data = splitObject[1];
            let gameObject = null;
            if (id[0] == '!') {
                id = id.slice(1);
                gameObject = this.netObjectMenager.getObject(id);
                if (gameObject) {
                    gameObject.destroy();
                }
                continue;
            }
            gameObject = this.netObjectMenager.getObject(id);
            if (gameObject == null) {
                gameObject = ObjectsFactory_1.ObjectsFactory.CreateGameObject(id, data);
            }
            gameObject.deserialize(data.split('#'));
        }
    }
}
exports.GameClient = GameClient;

},{"../Client/net/InputSender":14,"../Common/DeltaTimer":16,"../Common/Game":17,"../Common/net/NetObjectsManager":19,"../Common/net/SocketMsgs":20,"../Common/utils/game/ObjectsFactory":26,"./Chat":1,"./graphic/HtmlHandlers/DebugWindowHtmlHandler":7,"./graphic/Renderer":9,"./input/InputHandler":10,"./net/HeartBeatSender":13}],3:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
class BoxRenderer extends PIXI.Container {
    constructor() {
        super();
        this.red = false;
    }
    setObject(cell) {
        this.cell = cell;
        this.trans = cell.Transform;
        this.rect1 = new PIXI.Graphics();
        this.x = this.trans.X;
        this.y = this.trans.Y;
        this.addChild(this.rect1);
    }
    update() {
        if (this.cell.isEmpty()) {
            if (!this.red) {
                this.drawRectl(0xff0000);
                this.red = true;
            }
        }
        else {
            if (this.red) {
                this.red = false;
                this.drawRectl(0x0000ff);
            }
        }
    }
    destroy() {
        this.rect1.destroy();
    }
    drawRectl(color) {
        this.rect1.clear();
        this.rect1.lineStyle(1, color, 1);
        this.rect1.drawRect(0, 0, this.trans.Width, this.trans.Height);
        this.rect1.endFill();
    }
}
exports.BoxRenderer = BoxRenderer;

},{}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectRender_1 = require("./GameObjectRender");
class BulletRender extends GameObjectRender_1.GameObjectRender {
    constructor() {
        super();
    }
    setObject(bullet) {
        super.setObject(bullet);
        this.bulletReference = bullet;
    }
    update() {
        super.update();
    }
}
exports.BulletRender = BulletRender;

},{"./GameObjectRender":5}],5:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
class GameObjectRender extends PIXI.Container {
    constructor() {
        super();
    }
    setObject(gameObjectReference) {
        this.objectReference = gameObjectReference;
        this.sprite = new PIXI.Sprite(PIXI.utils.TextureCache[this.objectReference.SpriteName]);
        this.addChild(this.sprite);
        // this.sprite.anchor.set(-0.5, -0.5);
    }
    update() {
        if (!this.sprite) {
            return;
        }
        let transform = this.objectReference.Transform;
        this.x = transform.X;
        this.y = transform.Y;
        this.sprite.width = transform.Width;
        this.sprite.height = transform.Height;
        if (this.sprite.texture != PIXI.utils.TextureCache[this.objectReference.SpriteName]) {
            this.sprite.texture = PIXI.utils.TextureCache[this.objectReference.SpriteName];
        }
        this.sprite.rotation = this.objectReference.Transform.Rotation;
    }
    destroy() {
        this.sprite.destroy();
    }
}
exports.GameObjectRender = GameObjectRender;

},{}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectRender_1 = require("./GameObjectRender");
class PlayerRender extends GameObjectRender_1.GameObjectRender {
    constructor() {
        super();
    }
    setObject(player) {
        super.setObject(player);
        this.playerReference = player;
        this.nameText = new PIXI.Text(this.playerReference.Name, {
            fontFamily: "Arial",
            fontSize: "12px",
            fill: "#ffffff"
        });
        this.nameText.anchor.set(0.5, 2.75);
        this.sprite.addChild(this.nameText);
        this.hpBar = new PIXI.Graphics;
        this.hpBar.beginFill(0xFF0000);
        this.hpBar.drawRect(-20, -50, 40, 8);
        this.sprite.addChild(this.hpBar);
    }
    update() {
        super.update();
        this.nameText.text = this.playerReference.Name;
        this.hpBar.scale.x = this.playerReference.HP / 100;
    }
}
exports.PlayerRender = PlayerRender;

},{"./GameObjectRender":5}],9:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectsHolder_1 = require("../../Common/utils/game/GameObjectsHolder");
const GameObjectRender_1 = require("./GameObjectRender");
const PlayerRender_1 = require("./PlayerRender");
const BulletRender_1 = require("./BulletRender");
const BoxRenderer_1 = require("./BoxRenderer");
class Renderer extends GameObjectsHolder_1.GameObjectsHolder {
    constructor(afterCreateCallback) {
        super();
        this.renderer =
            PIXI.autoDetectRenderer(1024, 576, {
                view: document.getElementById("game-canvas"),
                antialias: false,
                transparent: false,
                resolution: 1
            });
        this.rootContainer = new PIXI.Container();
        this.renderer.render(this.rootContainer);
        this.renderObjects = new Map();
        this.renderCells = new Map();
        PIXI.loader
            .add('bunny', 'resources/images/bunny.png')
            .add('dyzma', 'resources/images/dyzma.jpg')
            .add('panda', 'resources/images/panda.png')
            .add('bullet', 'resources/images/bullet.png')
            .add('fireball', 'resources/images/fireball.png')
            .add('bluebolt', 'resources/images/bluebolt.png')
            .load(afterCreateCallback);
    }
    update() {
        this.renderObjects.forEach((gameObjectRender) => {
            gameObjectRender.update();
        });
        this.renderCells.forEach((boxRenderer) => {
            boxRenderer.update();
        });
        this.renderer.render(this.rootContainer);
    }
    addGameObject(gameObject) {
        super.addGameObject(gameObject);
        let gameObjectRender;
        let type = gameObject.ID[0];
        if (type == "P") {
            gameObjectRender = new PlayerRender_1.PlayerRender();
        }
        else if (type == "B") {
            gameObjectRender = new BulletRender_1.BulletRender();
        }
        else {
            gameObjectRender = new GameObjectRender_1.GameObjectRender();
        }
        gameObjectRender.setObject(gameObject);
        this.renderObjects.set(gameObject, gameObjectRender);
        this.rootContainer.addChild(gameObjectRender);
    }
    addCell(cell) {
        let boxRenderer = new BoxRenderer_1.BoxRenderer();
        boxRenderer.setObject(cell);
        this.renderCells.set(cell, boxRenderer);
        this.rootContainer.addChild(boxRenderer);
    }
    removeGameObject(gameObject) {
        super.removeGameObject(gameObject);
        this.renderObjects.get(gameObject).destroy();
        this.renderObjects.delete(gameObject);
    }
}
exports.Renderer = Renderer;

},{"../../Common/utils/game/GameObjectsHolder":25,"./BoxRenderer":3,"./BulletRender":4,"./GameObjectRender":5,"./PlayerRender":8}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const InputSnapshot_1 = require("../../Common/input/InputSnapshot");
const Transform_1 = require("../../Common/utils/game/Transform");
const InputMap_1 = require("./InputMap");
class InputHandler {
    constructor() {
        this.lastDirection = 0;
        this.pressedKeys = new Set();
        this.releasedKeys = new Set();
        this.clickPosition = null;
        this.snapshotCallbacks = new Array();
        document.addEventListener("keydown", this.keyPressed.bind(this));
        document.addEventListener("keyup", this.keyReleased.bind(this));
        window.addEventListener("mousedown", this.mouseClick.bind(this));
        //this.phaserInput.onDown.add(this.mouseClick, this);
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
        let canvas = document.getElementById("game-canvas");
        let rect = canvas.getBoundingClientRect();
        this.clickPosition = new Transform_1.Transform(mouseEvent.x - rect.left, mouseEvent.y - rect.top);
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

},{"../../Common/input/InputSnapshot":18,"../../Common/utils/game/Transform":28,"./InputMap":11}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameClient_1 = require("./GameClient");
const CommonConfig_1 = require("../Common/CommonConfig");
CommonConfig_1.CommonConfig.ORIGIN = CommonConfig_1.Origin.CLIENT;
window.onload = () => {
    let client = new GameClient_1.GameClient();
};

},{"../Common/CommonConfig":15,"./GameClient":2}],13:[function(require,module,exports){
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

},{"../../Common/net/SocketMsgs":20,"../graphic/HtmlHandlers/DebugWindowHtmlHandler":7}],14:[function(require,module,exports){
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

},{"../../Common/net/SocketMsgs":20}],15:[function(require,module,exports){
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

},{}],16:[function(require,module,exports){
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

},{}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectsHolder_1 = require("./utils/game/GameObjectsHolder");
const CommonConfig_1 = require("./CommonConfig");
const SpacialGrid_1 = require("./utils/physics/SpacialGrid");
class Game extends GameObjectsHolder_1.GameObjectsHolder {
    constructor() {
        super();
        this.tickrate = 30;
        this.spacialGrid = new SpacialGrid_1.SpacialGrid(1024, 576, 60);
        console.log("create game instance");
    }
    update(delta) {
        this.gameObjectsMapById.forEach((object) => {
            object.update(delta);
        });
        if (CommonConfig_1.CommonConfig.ORIGIN == CommonConfig_1.Origin.SERVER) {
            this.spacialGrid.rebuildGrid();
            this.spacialGrid.checkCollisions();
        }
    }
    addGameObject(gameObject) {
        this.spacialGrid.addObject(gameObject);
        super.addGameObject(gameObject);
    }
    removeGameObject(gameObject) {
        this.spacialGrid.removeObject(gameObject);
        super.removeGameObject(gameObject);
    }
    stopGameLoop() {
        clearTimeout(this.timeoutId);
    }
    //TEST
    get Cells() {
        return this.spacialGrid.Cells;
    }
}
exports.Game = Game;

},{"./CommonConfig":15,"./utils/game/GameObjectsHolder":25,"./utils/physics/SpacialGrid":29}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
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
        this.gameObjectsMapById.forEach((gameObject, id) => {
            let objectUpdate = gameObject.serialize(complete).slice(1);
            if (objectUpdate != '') {
                serializedObjects += '$' + id + '-' + objectUpdate;
            }
        });
        serializedObjects = serializedObjects.slice(1);
        return serializedObjects;
    }
    getObject(id) {
        return this.gameObjectsMapById.get(id);
    }
}
exports.NetObjectsManager = NetObjectsManager;

},{"../utils/game/GameObjectsHolder":25}],20:[function(require,module,exports){
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

},{}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
const GameObjectTypes_1 = require("./GameObjectTypes");
const ChangesDict_1 = require("./ChangesDict");
class Bullet extends GameObject_1.GameObject {
    constructor(transform) {
        super(transform);
        this.lifeSpan = 300;
        this.id = this.Type + this.id;
        if (Math.floor(Math.random() * 2)) {
            this.spriteName = "bluebolt";
            this.velocity = 1.4;
        }
        else {
            this.spriteName = "fireball";
            this.velocity = 0.7;
        }
        this.lifeSpan = 5000;
        this.changes.add(ChangesDict_1.ChangesDict.VELOCITY);
        this.changes.add(ChangesDict_1.ChangesDict.LIFE_SPAN);
        this.sFunc = new Map(function* () { yield* Bullet.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map(function* () { yield* Bullet.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.Bullet.toString();
    }
    onCollisionEnter(gameObject) {
        if (gameObject.ID != this.owner) {
            if (!(gameObject.Type == "B" && gameObject.owner == this.owner)) {
                this.destroy();
            }
        }
    }
    get Owner() {
        return this.owner;
    }
    set Owner(value) {
        this.owner = value;
    }
    serverUpdate(delta) {
        super.serverUpdate(delta);
        this.lifeSpan -= delta;
        if (this.lifeSpan <= 0) {
            this.destroy();
        }
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
        let sinAngle = Math.sin(this.transform.Rotation);
        let cosAngle = Math.cos(this.transform.Rotation);
        this.transform.X += cosAngle * this.velocity * delta;
        this.transform.Y += sinAngle * this.velocity * delta;
        //this.changes.add(ChangesDict.POSITION);
    }
    static serializeLifeSpan(bullet) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.LIFE_SPAN) + bullet.lifeSpan;
    }
    static deserializeLifeSpan(bullet, data) {
        bullet.lifeSpan = parseInt(data);
    }
}
Bullet.SerializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.LIFE_SPAN, Bullet.serializeLifeSpan]
]);
Bullet.DeserializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.LIFE_SPAN, Bullet.deserializeLifeSpan]
]);
exports.Bullet = Bullet;

},{"./ChangesDict":22,"./GameObject":23,"./GameObjectTypes":24}],22:[function(require,module,exports){
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
ChangesDict.ROTATION = 'R';
exports.ChangesDict = ChangesDict;

},{}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ChangesDict_1 = require("./ChangesDict");
const CommonConfig_1 = require("../../CommonConfig");
class GameObject {
    constructor(transform) {
        this.id = (GameObject.NEXT_ID++).toString();
        this.velocity = 10;
        this.forceComplete = true;
        this.transform = transform;
        this.changes = new Set();
        this.sFunc = GameObject.SerializeFunctions;
        this.dFunc = GameObject.DeserializeFunctions;
        this.spriteName = "bunny";
        this.destroyListeners = new Set();
    }
    forceCompleteUpdate() {
        this.forceComplete = true;
    }
    update(delta) {
        this.Transform.Moved = false;
        if (CommonConfig_1.CommonConfig.ORIGIN == CommonConfig_1.Origin.SERVER) {
            this.serverUpdate(delta);
        }
        this.commonUpdate(delta);
    }
    commonUpdate(delta) {
    }
    serverUpdate(delta) {
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
    get Transform() {
        return this.transform;
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
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.POSITION) + gameObject.Transform.X.toString() + ',' + gameObject.Transform.Y.toString();
    }
    static deserializePosition(gameObject, data) {
        let x = data.split(',')[0];
        let y = data.split(',')[1];
        gameObject.transform.X = parseFloat(x);
        gameObject.transform.Y = parseFloat(y);
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
    static serializeRotation(gameObject) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.ROTATION) + gameObject.Transform.Rotation;
    }
    static deserializeRotation(gameObject, data) {
        gameObject.Transform.Rotation = parseFloat(data);
    }
}
GameObject.NEXT_ID = 0;
GameObject.SerializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.POSITION, GameObject.serializePosition],
    [ChangesDict_1.ChangesDict.SPRITE, GameObject.serializeSpriteName],
    [ChangesDict_1.ChangesDict.VELOCITY, GameObject.serializeVelocity],
    [ChangesDict_1.ChangesDict.ROTATION, GameObject.serializeRotation],
]);
GameObject.DeserializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.POSITION, GameObject.deserializePosition],
    [ChangesDict_1.ChangesDict.SPRITE, GameObject.deserializeSpriteName],
    [ChangesDict_1.ChangesDict.VELOCITY, GameObject.deserializeVelocity],
    [ChangesDict_1.ChangesDict.ROTATION, GameObject.deserializeRotation],
]);
exports.GameObject = GameObject;

},{"../../CommonConfig":15,"./ChangesDict":22}],24:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var GameObjectType;
(function (GameObjectType) {
    GameObjectType[GameObjectType["GameObject"] = 'G'] = "GameObject";
    GameObjectType[GameObjectType["Player"] = 'P'] = "Player";
    GameObjectType[GameObjectType["Bullet"] = 'B'] = "Bullet";
})(GameObjectType = exports.GameObjectType || (exports.GameObjectType = {}));

},{}],25:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class GameObjectsHolder {
    //protected gameObjectsArray: Array<GameObject> = new Array<GameObject>();
    constructor() {
        this.gameObjectsMapById = new Map();
    }
    onDestroy(id) {
        this.removeGameObjectById(id);
    }
    addGameObject(gameObject) {
        gameObject.addDestroyListener(this.onDestroy.bind(this));
        this.gameObjectsMapById.set(gameObject.ID, gameObject);
        //this.gameObjectsArray.push(gameObject);
    }
    removeGameObject(gameObject) {
        this.gameObjectsMapById.delete(gameObject.ID);
        // for (let idx; (idx = this.gameObjectsArray.indexOf(gameObject)) != -1;) {
        //     this.gameObjectsArray.splice(idx, 1);
        // }
    }
    removeGameObjectById(id) {
        if (this.gameObjectsMapById.has(id)) {
            this.removeGameObject(this.gameObjectsMapById.get(id));
        }
    }
    getGameObject(id) {
        return this.gameObjectsMapById.get(id);
    }
    has(id) {
        return this.gameObjectsMapById.has(id);
    }
}
exports.GameObjectsHolder = GameObjectsHolder;

},{}],26:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Player_1 = require("./Player");
const Transform_1 = require("./Transform");
const Bullet_1 = require("./Bullet");
//TODO maybe make this facrory as singleton??????
class ObjectsFactory {
    constructor() {
        throw new Error("Cannot instatiate this class");
    }
    static CreateGameObject(id, data) {
        let type = id.substr(0, 1);
        let position = new Transform_1.Transform(0, 0);
        let gameObject = null;
        if (type == "P") {
            gameObject = new Player_1.Player('DEFAULT', position);
        }
        else if (type == "B") {
            gameObject = new Bullet_1.Bullet(position);
        }
        else {
            throw "Unknown object type";
        }
        if (gameObject) {
            if (data) {
                gameObject.deserialize(data.split('#'));
            }
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

},{"./Bullet":21,"./Player":27,"./Transform":28}],27:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
const GameObjectTypes_1 = require("./GameObjectTypes");
const ChangesDict_1 = require("./ChangesDict");
const ObjectsFactory_1 = require("./ObjectsFactory");
class Player extends GameObject_1.GameObject {
    constructor(name, transform) {
        super(transform);
        this.moveDirection = 0;
        this.id = this.Type + this.id;
        this.sFunc = new Map(function* () { yield* Player.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map(function* () { yield* Player.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
        this.name = name;
        this.hp = 100;
        this.velocity = 0.3;
        this.transform.Width = 40;
        this.transform.Height = 64;
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.Player.toString();
    }
    onCollisionEnter(gameObject) {
        if (gameObject.Type == GameObjectTypes_1.GameObjectType.Bullet.toString()) {
            if (gameObject.Owner == this.ID) {
                return;
            }
            this.hp -= 10;
            this.changes.add(ChangesDict_1.ChangesDict.HP);
        }
    }
    setInput(commands) {
        commands.forEach((value, command) => {
            if (command == "D") {
                this.moveDirection = parseInt(value);
            }
            else if (command == "C") {
                for (let i = 0; i < 1; i++) {
                    let bullet = ObjectsFactory_1.ObjectsFactory.CreateGameObject("B");
                    bullet.Owner = this.ID;
                    let centerX = this.transform.X + this.transform.Width / 2;
                    let centerY = this.transform.Y + this.transform.Height / 2;
                    let clickX = parseFloat(value.split(';')[0]);
                    let clickY = parseFloat(value.split(';')[1]);
                    let deltaX = clickX - centerX;
                    let deltaY = clickY - centerY;
                    let angle = Math.atan2(deltaY, deltaX);
                    if (angle < 0)
                        angle = angle + 2 * Math.PI;
                    bullet.Transform.Rotation = angle;
                    //bullet.Transform.Rotation = Math.floor(Math.random() * 360);
                    console.log(Math.sin(deltaY));
                    bullet.Transform.X = centerX - bullet.Transform.Width / 2 * Math.sin(deltaY);
                    bullet.Transform.Y = centerY;
                    ;
                }
            }
        });
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
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
        this.transform.X += xFactor * this.velocity * delta;
        this.transform.Y += yFactor * this.velocity * delta;
        if (this.moveDirection != 0) {
            this.changes.add(ChangesDict_1.ChangesDict.POSITION);
        }
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
    set Name(name) {
        this.name = name;
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

},{"./ChangesDict":22,"./GameObject":23,"./GameObjectTypes":24,"./ObjectsFactory":26}],28:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Transform {
    constructor(x, y, width, height) {
        this.rotation = 0;
        this.x = x || 0;
        this.y = y || 0;
        this.width = width || 32;
        this.height = height || 32;
        this.moved = false;
    }
    get Moved() {
        return this.moved;
    }
    set Moved(moved) {
        this.moved = moved;
    }
    get X() {
        return this.x;
    }
    set X(x) {
        this.moved = true;
        this.x = x;
    }
    get Y() {
        return this.y;
    }
    set Y(y) {
        this.moved = true;
        this.y = y;
    }
    set Width(width) {
        this.width = width;
    }
    get Width() {
        return this.width;
    }
    set Height(height) {
        this.height = height;
    }
    get Height() {
        return this.height;
    }
    set Rotation(rotation) {
        this.rotation = rotation;
    }
    get Rotation() {
        return this.rotation;
    }
    deserialize(input) {
        this.x = input.x;
        this.y = input.y;
        return this;
    }
    clone(position) {
        this.x = position.x;
        this.y = position.y;
        return new Transform(position.x, position.y);
    }
}
exports.Transform = Transform;

},{}],29:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Transform_1 = require("../game/Transform");
let collisions = 0;
class Cell {
    constructor(transform) {
        this.objects = new Array();
        this.transform = transform;
    }
    get Transform() {
        return this.transform;
    }
    addObject(gameObject) {
        this.objects.push(gameObject);
    }
    clear() {
        this.objects.splice(0, this.objects.length);
    }
    isEmpty() {
        return this.objects.length <= 0;
    }
    // checkForMovedObjects() {
    //     for(let i = 0; i < this.objects.length; i++) {
    //         if(this.objects[i].Transform.Moved) {
    //             if(!rectOverlap(this.objects[i].Transform, this.transform)) {
    //                 this.removeObject(this.objects[i]);
    //             }
    //         }
    //     }
    // }
    // removeObject(gameObject: GameObject) {
    //     for (let idx; (idx = this.objects.indexOf(gameObject)) != -1;) {
    //         this.objects.splice(idx, 1);
    //     }
    // }
    checkCollisions() {
        for (let i = 0; i < this.objects.length; i++) {
            for (let j = i + 1; j < this.objects.length; j++) {
                let o1 = this.objects[i];
                let o2 = this.objects[j];
                if (o1 != o2 && rectOverlap(o1.Transform, o2.Transform)) {
                    o1.onCollisionEnter(o2);
                    o2.onCollisionEnter(o1);
                }
            }
        }
    }
}
exports.Cell = Cell;
class SpacialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cellsX = Math.ceil(width / cellSize);
        this.cellsY = Math.ceil(height / cellSize);
        this.gameObjects = new Array();
        this.cells = new Array();
        for (let y = 0; y < this.cellsY; y++) {
            for (let x = 0; x < this.cellsX; x++) {
                let transform = new Transform_1.Transform(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                let cell = new Cell(transform);
                this.cells.push(cell);
            }
        }
    }
    rebuildGrid() {
        this.cells.forEach((cell) => {
            cell.clear();
        });
        this.gameObjects.forEach((gameObject) => {
            let xs = gameObject.Transform.X / this.cellSize;
            let xe = Math.floor(xs + (gameObject.Transform.Width / this.cellSize));
            xs = Math.floor(xs);
            let ys = gameObject.Transform.Y / this.cellSize;
            let ye = Math.floor(ys + (gameObject.Transform.Height / this.cellSize));
            ys = Math.floor(ys);
            for (let i = xs; i <= xe; i++) {
                if (i >= this.cellsX || i < 0)
                    continue;
                for (let j = ys; j <= ye; j++) {
                    if (j >= this.cellsY || j < 0)
                        continue;
                    let idx = (j * this.cellsX) + i;
                    if (this.cells[idx]) {
                        this.cells[idx].addObject(gameObject);
                    }
                }
            }
        });
    }
    checkCollisions() {
        this.cells.forEach((cell) => {
            cell.checkCollisions();
        });
        if (collisions > 0) {
            //console.log(collisions);
        }
        collisions = 0;
    }
    addObject(gameObject) {
        this.gameObjects.push(gameObject);
    }
    removeObject(gameObject) {
        if (this.gameObjects.indexOf(gameObject) != -1) {
            this.gameObjects.splice(this.gameObjects.indexOf(gameObject));
        }
    }
    get Cells() {
        return this.cells;
    }
}
exports.SpacialGrid = SpacialGrid;
function rectOverlap(A, B) {
    collisions++;
    return (A.X < B.X + B.Width && A.X + A.Width > B.X && A.Y < B.Y + B.Height && A.Height + A.Y > B.Y);
}

},{"../game/Transform":28}]},{},[12]);
