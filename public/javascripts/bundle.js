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

},{"../Common/net/SocketMsgs":24,"./graphic/HtmlHandlers/ChatHtmlHandler":9}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ClientConfig {
}
ClientConfig.TICKRATE = 1 / 64 * 1000;
ClientConfig.INPUT_SNAPSHOT_TIMER = 1 / 5 * 1000;
exports.ClientConfig = ClientConfig;

},{}],3:[function(require,module,exports){
"use strict";
/// <reference path="../node_modules/@types/socket.io-client/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const World_1 = require("../Common/World");
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
const ClientConfig_1 = require("./ClientConfig");
class GameClient {
    constructor() {
        this.netObjectMenager = NetObjectsManager_1.NetObjectsManager.Instance;
        this.player = null;
        this.connect();
        this.inputSender = new InputSender_1.InputSender(this.socket);
        this.heartBeatSender = new HeartBeatSender_1.HeartBeatSender(this.socket);
        this.chat = new Chat_1.Chat(this.socket);
        this.renderer = new Renderer_1.Renderer(() => {
            this.inputHandler = new InputHandler_1.InputHandler();
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
            let worldInfo = data['world'].split(',');
            let width = Number(worldInfo[0]);
            let height = Number(worldInfo[1]);
            this.world = new World_1.World(width, height);
            this.renderer.setMap();
            ObjectsFactory_1.ObjectsFactory.HolderSubscribers.push(this.renderer);
            ObjectsFactory_1.ObjectsFactory.HolderSubscribers.push(this.world);
            ObjectsFactory_1.ObjectsFactory.HolderSubscribers.push(this.netObjectMenager);
            this.updateGame(data);
            this.player = this.world.getGameObject(data['id']);
            this.renderer.CameraFollower = this.player;
            this.heartBeatSender.startSendingHeartbeats();
            this.startGame();
            // this.world.Cells.forEach((cell: Cell) => {
            //     this.renderer.addCell(cell);
            // });
            this.socket.on(SocketMsgs_1.SocketMsgs.UPDATE_GAME, this.updateGame.bind(this));
            this.socket.on(SocketMsgs_1.SocketMsgs.ERROR, (err) => {
                console.log(err);
            });
        });
    }
    startGame() {
        let timer = new DeltaTimer_1.DeltaTimer;
        let deltaHistory = new Array();
        setInterval(() => {
            let delta = timer.getDelta();
            this.world.update(delta);
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
        }, ClientConfig_1.ClientConfig.TICKRATE);
    }
    updateGame(data) {
        if (data['update'] == null) {
            return;
        }
        let update = data['update'].split('$');
        //console.log(update);
        for (let object in update) {
            let splitObject = update[object].split('=');
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

},{"../Client/net/InputSender":18,"../Common/DeltaTimer":20,"../Common/World":21,"../Common/net/NetObjectsManager":23,"../Common/net/SocketMsgs":24,"../Common/utils/game/ObjectsFactory":32,"./Chat":1,"./ClientConfig":2,"./graphic/HtmlHandlers/DebugWindowHtmlHandler":10,"./graphic/Renderer":12,"./input/InputHandler":14,"./net/HeartBeatSender":17}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectAnimationRender_1 = require("../../Client/graphic/GameObjectAnimationRender");
class BulletRender extends GameObjectAnimationRender_1.GameObjectAnimationRender {
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
    destroy() {
        super.destroy();
    }
}
exports.BulletRender = BulletRender;

},{"../../Client/graphic/GameObjectAnimationRender":6}],5:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const Renderer_1 = require("../../Client/graphic/Renderer");
class Camera extends PIXI.Container {
    constructor(follower) {
        super();
        this.dt = 0.1;
        this.Follower = follower;
        this.position.set(Renderer_1.Renderer.WIDTH / 2, Renderer_1.Renderer.HEIGHT / 2);
    }
    set Follower(follower) {
        this.follower = follower;
        this.pivot = new PIXI.Point(follower.x, follower.y);
        this.update();
    }
    update() {
        this.pivot.x = (this.follower.x - this.pivot.x) * this.dt + this.pivot.x;
        this.pivot.y = (this.follower.y - this.pivot.y) * this.dt + this.pivot.y;
    }
}
exports.Camera = Camera;

},{"../../Client/graphic/Renderer":12}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectRender_1 = require("./GameObjectRender");
class GameObjectAnimationRender extends GameObjectRender_1.GameObjectRender {
    constructor() {
        super();
        this.textures = new Array();
    }
    setObject(gameObject) {
        super.setObject(gameObject);
        for (let i = 0; i < 4; i++) {
            let texture = PIXI.Texture.fromFrame(this.objectReference.SpriteName + '_' + (i) + '.png');
            this.textures.push(texture);
        }
        this.animation = new PIXI.extras.AnimatedSprite(this.textures);
        this.addChild(this.animation);
        this.animation.animationSpeed = 0.5;
        this.animation.play();
        this.animation.width = this.objectReference.Transform.Width;
        this.animation.height = this.objectReference.Transform.Height;
        this.animation.anchor.set(0.5, 0.5);
    }
    update() {
        super.update();
    }
    destroy() {
        super.destroy();
        this.animation.destroy();
    }
}
exports.GameObjectAnimationRender = GameObjectAnimationRender;

},{"./GameObjectRender":7}],7:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
class GameObjectRender extends PIXI.Container {
    constructor() {
        super();
        this.dt = 0.6;
    }
    setObject(gameObjectReference) {
        this.objectReference = gameObjectReference;
    }
    update() {
        let transform = this.objectReference.Transform;
        if (Math.abs(transform.X - this.x) > 50) {
            this.x = transform.X;
        }
        else {
            this.x = (transform.X - this.x) * this.dt + this.x;
        }
        if (Math.abs(transform.Y - this.y) > 50) {
            this.y = transform.Y;
        }
        else {
            this.y = (transform.Y - this.y) * this.dt + this.y;
        }
        this.rotation = this.objectReference.Transform.Rotation;
    }
    destroy() {
        super.destroy();
    }
}
exports.GameObjectRender = GameObjectRender;

},{}],8:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectRender_1 = require("../../Client/graphic/GameObjectRender");
class GameObjectSpriteRender extends GameObjectRender_1.GameObjectRender {
    constructor() {
        super();
    }
    setObject(gameObjectReference) {
        this.objectReference = gameObjectReference;
        this.sprite = new PIXI.Sprite(PIXI.utils.TextureCache[this.objectReference.SpriteName]);
        this.addChild(this.sprite);
        let transform = this.objectReference.Transform;
        this.sprite.width = transform.Width;
        this.sprite.height = transform.Height;
        this.sprite.anchor.set(0.5, 0.5);
    }
    update() {
        super.update();
        if (this.sprite.texture != PIXI.utils.TextureCache[this.objectReference.SpriteName]) {
            this.sprite.texture = PIXI.utils.TextureCache[this.objectReference.SpriteName];
        }
    }
    destroy() {
        super.destroy();
    }
}
exports.GameObjectSpriteRender = GameObjectSpriteRender;

},{"../../Client/graphic/GameObjectRender":7}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
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

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectSpriteRender_1 = require("../../Client/graphic/GameObjectSpriteRender");
class PlayerRender extends GameObjectSpriteRender_1.GameObjectSpriteRender {
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
        this.nameText.anchor.set(0.5, 4.5);
        this.addChild(this.nameText);
        this.hpBar = new PIXI.Graphics;
        this.hpBar.beginFill(0xFF0000);
        this.hpBar.drawRect(-this.objectReference.Transform.Width / 2, -this.objectReference.Transform.Height / 2, this.objectReference.Transform.Width, 7);
        this.sprite.addChild(this.hpBar);
    }
    update() {
        super.update();
        this.nameText.text = this.playerReference.Name;
        this.hpBar.scale.x = this.playerReference.HP / this.playerReference.MaxHP;
    }
    destroy() {
        super.destroy();
    }
}
exports.PlayerRender = PlayerRender;

},{"../../Client/graphic/GameObjectSpriteRender":8}],12:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectsHolder_1 = require("../../Common/utils/game/GameObjectsHolder");
const PlayerRender_1 = require("./PlayerRender");
const BulletRender_1 = require("./BulletRender");
const Camera_1 = require("./Camera");
const GameObjectSpriteRender_1 = require("./GameObjectSpriteRender");
const TileMap_1 = require("./TileMap");
class Renderer extends GameObjectsHolder_1.GameObjectsHolder {
    constructor(afterCreateCallback) {
        super();
        this.renderer =
            PIXI.autoDetectRenderer(Renderer.WIDTH, Renderer.HEIGHT, {
                view: document.getElementById("game-canvas"),
                antialias: false,
                transparent: false,
                resolution: 1
            });
        this.rootContainer = new PIXI.Container();
        this.camera = new Camera_1.Camera(new PIXI.Point(333, 333));
        this.camera.addChild(this.rootContainer);
        this.renderObjects = new Map();
        PIXI.loader
            .add('none', 'resources/images/none.png')
            .add('bunny', 'resources/images/bunny.png')
            .add('dyzma', 'resources/images/dyzma.jpg')
            .add('kamis', 'resources/images/kamis.jpg')
            .add('panda', 'resources/images/panda.png')
            .add('bullet', 'resources/images/bullet.png')
            .add('fireball', 'resources/images/fireball.png')
            .add('bluebolt', 'resources/images/bluebolt.png')
            .add('flame', 'resources/animations/flame/flame.json')
            .add('terrain', 'resources/maps/terrain.png')
            .load(afterCreateCallback);
        document.addEventListener("keydown", (event) => {
            if (event.keyCode == 72) {
                this.hideNotVisibleObjects();
            }
        });
    }
    hideNotVisibleObjects() {
        this.renderObjects.forEach((obj) => {
            obj.visible = this.isInCameraView(obj);
        });
        this.map.children.forEach((obj) => {
            obj.visible = this.isInCameraView(obj);
        });
    }
    isInCameraView(object) {
        let buffor = 100;
        let cameraX = this.camera.pivot.x - Renderer.WIDTH / 2 - buffor;
        let cameraY = this.camera.pivot.y - Renderer.HEIGHT / 2 - buffor;
        return (object.x < cameraX + Renderer.WIDTH + 2 * buffor) &&
            (object.y < cameraY + Renderer.HEIGHT + 2 * buffor) &&
            (cameraX < object.x + object.width) &&
            (cameraY < object.y + object.height);
    }
    update() {
        // this.hideNotVisibleObjects();
        this.renderObjects.forEach((gameObjectRender) => {
            gameObjectRender.update();
        });
        this.camera.update();
        this.renderer.render(this.camera);
    }
    setMap(map) {
        this.map = new TileMap_1.TileMap();
        this.rootContainer.addChild(this.map);
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
            gameObjectRender = new GameObjectSpriteRender_1.GameObjectSpriteRender();
        }
        gameObjectRender.setObject(gameObject);
        this.renderObjects.set(gameObject, gameObjectRender);
        this.rootContainer.addChild(gameObjectRender);
    }
    set CameraFollower(gameObject) {
        this.camera.Follower = this.renderObjects.get(gameObject).position;
    }
    removeGameObject(gameObject) {
        super.removeGameObject(gameObject);
        this.renderObjects.get(gameObject).destroy();
        this.renderObjects.delete(gameObject);
    }
}
Renderer.HEIGHT = 576;
Renderer.WIDTH = 1024;
exports.Renderer = Renderer;

},{"../../Common/utils/game/GameObjectsHolder":31,"./BulletRender":4,"./Camera":5,"./GameObjectSpriteRender":8,"./PlayerRender":11,"./TileMap":13}],13:[function(require,module,exports){
"use strict";
/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
class TileMap extends PIXI.Container {
    constructor(map) {
        super();
        this.map = [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ];
        let texture = new PIXI.Texture(PIXI.utils.TextureCache['terrain'], new PIXI.Rectangle(6 * 32, 12 * 32, 32, 32));
        for (let i = 0; i < 100; i++) {
            for (let j = 0; j < 100; j++) {
                let sprite = new PIXI.Sprite(texture);
                sprite.x = i * 32;
                sprite.y = j * 32;
                this.addChild(sprite);
            }
        }
    }
    update() {
    }
    destroy() {
        super.destroy();
    }
}
exports.TileMap = TileMap;
// things = [];
//
// for(var i: number = 0; i < 10; i++) {
//     this.things[i] = [];
//     for(var j: number = 0; j< 10; j++) {
//         this.things[i][j] = new Thing();
//     }
// } 

},{}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const InputSnapshot_1 = require("../../Common/input/InputSnapshot");
const Transform_1 = require("../../Common/utils/physics/Transform");
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
            let angle = this.parseClick();
            inputSnapshot.append("C", angle);
            this.clickPosition = null;
        }
        this.releasedKeys.clear();
        return inputSnapshot;
    }
    parseClick() {
        let canvas = document.getElementById("game-canvas");
        let centerX = canvas.width / 2;
        let centerY = canvas.height / 2;
        let deltaX = this.clickPosition.X - centerX;
        let deltaY = this.clickPosition.Y - centerY;
        let angle = Math.atan2(deltaY, deltaX);
        if (angle < 0)
            angle = angle + 2 * Math.PI;
        return angle.toString();
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

},{"../../Common/input/InputSnapshot":22,"../../Common/utils/physics/Transform":36,"./InputMap":15}],15:[function(require,module,exports){
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

},{}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameClient_1 = require("./GameClient");
const CommonConfig_1 = require("../Common/CommonConfig");
CommonConfig_1.CommonConfig.ORIGIN = CommonConfig_1.Origin.CLIENT;
window.onload = () => {
    let client = new GameClient_1.GameClient();
};

},{"../Common/CommonConfig":19,"./GameClient":3}],17:[function(require,module,exports){
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
        if (this.heartBeats.has(id)) {
            let ping = new Date().getTime() - this.heartBeats.get(id);
            //console.log('hbr ' + ping);
            DebugWindowHtmlHandler_1.DebugWindowHtmlHandler.Instance.Ping = ping.toString();
            if (this.isRunning) {
                setTimeout(() => this.startSendingHeartbeats(), 1 / this.rate * 1000);
            }
            this.heartBeats.delete(id);
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

},{"../../Common/net/SocketMsgs":24,"../graphic/HtmlHandlers/DebugWindowHtmlHandler":10}],18:[function(require,module,exports){
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

},{"../../Common/net/SocketMsgs":24}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
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

},{}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectsHolder_1 = require("./utils/game/GameObjectsHolder");
const SpacialGrid_1 = require("./utils/physics/SpacialGrid");
class World extends GameObjectsHolder_1.GameObjectsHolder {
    constructor(width, height) {
        super();
        this.width = width;
        this.height = height;
        this.spacialGrid = new SpacialGrid_1.SpacialGrid(this.width, this.height, 90);
        console.log("create game instance");
    }
    update(delta) {
        this.gameObjectsMapById.forEach((object) => {
            object.update(delta);
        });
        //  if(CommonConfig.ORIGIN == Origin.SERVER) {
        this.spacialGrid.rebuildGrid();
        this.spacialGrid.checkCollisions();
        //}
    }
    addGameObject(gameObject) {
        this.spacialGrid.addObject(gameObject);
        super.addGameObject(gameObject);
    }
    removeGameObject(gameObject) {
        this.spacialGrid.removeObject(gameObject);
        super.removeGameObject(gameObject);
    }
    //TEST
    get Cells() {
        return this.spacialGrid.Cells;
    }
    get Width() {
        return this.width;
    }
    get Height() {
        return this.height;
    }
    deserialize(world) {
    }
    serialize() {
        return this.width.toString() + ',' + this.height.toString();
    }
}
exports.World = World;

},{"./utils/game/GameObjectsHolder":31,"./utils/physics/SpacialGrid":35}],22:[function(require,module,exports){
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

},{}],23:[function(require,module,exports){
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
                serializedObjects += '$' + id + '=' + objectUpdate;
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

},{"../utils/game/GameObjectsHolder":31}],24:[function(require,module,exports){
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
SocketMsgs.ERROR = 'err';
exports.SocketMsgs = SocketMsgs;

},{}],25:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
const GameObjectTypes_1 = require("./GameObjectTypes");
const ChangesDict_1 = require("./ChangesDict");
class Actor extends GameObject_1.GameObject {
    constructor(name, transform) {
        super(transform);
        this.id = this.Type + this.id;
        this.sFunc = new Map(function* () { yield* Actor.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map(function* () { yield* Actor.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
        this.name = name;
        this.maxHp = 200;
        this.hp = this.maxHp;
        this.velocity = 0.3;
        this.transform.Width = 40;
        this.transform.Height = 64;
        this.spriteName = "bunny";
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.Actor.toString();
    }
    serverCollision(gameObject, response) {
        if (gameObject.Type == GameObjectTypes_1.GameObjectType.Bullet.toString()) {
            let bullet = gameObject;
            if (bullet.Owner == this.ID) {
                return;
            }
            this.hit(bullet.Power);
        }
    }
    commonCollision(gameObject, response) {
        if (gameObject.Type == GameObjectTypes_1.GameObjectType.Obstacle.toString()) {
            this.transform.X += response.overlapV.x * 1.2;
            this.transform.Y += response.overlapV.y * 1.2;
        }
    }
    hit(power) {
        this.hp -= power;
        if (this.hp < 0) {
            this.hp = 0;
        }
        this.changes.add(ChangesDict_1.ChangesDict.HP);
    }
    get MaxHP() {
        return this.maxHp;
    }
    get HP() {
        return this.hp;
    }
    get Name() {
        return this.name;
    }
    set Name(name) {
        this.name = name;
        this.changes.add(ChangesDict_1.ChangesDict.NAME);
    }
    static serializeMaxHp(actor) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.MAX_HP) + actor.maxHp.toString();
    }
    static deserializeMaxHp(actor, data) {
        actor.maxHp = parseInt(data);
    }
    static serializeHp(actor) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.HP) + actor.HP.toString();
    }
    static deserializeHp(actor, data) {
        actor.hp = parseInt(data);
    }
    static serializeName(actor) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.NAME) + actor.name;
    }
    static deserializeName(actor, data) {
        actor.name = data;
    }
}
Actor.SerializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.MAX_HP, Actor.serializeMaxHp],
    [ChangesDict_1.ChangesDict.HP, Actor.serializeHp],
    [ChangesDict_1.ChangesDict.NAME, Actor.serializeName],
]);
Actor.DeserializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.MAX_HP, Actor.deserializeMaxHp],
    [ChangesDict_1.ChangesDict.HP, Actor.deserializeHp],
    [ChangesDict_1.ChangesDict.NAME, Actor.deserializeName],
]);
exports.Actor = Actor;

},{"./ChangesDict":27,"./GameObject":29,"./GameObjectTypes":30}],26:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
const GameObjectTypes_1 = require("./GameObjectTypes");
const ChangesDict_1 = require("./ChangesDict");
class Bullet extends GameObject_1.GameObject {
    constructor(transform) {
        super(transform);
        this.lifeSpan = 50;
        this.power = 10;
        this.id = this.Type + this.id;
        if (Math.floor(Math.random() * 2)) {
            this.spriteName = "bluebolt";
            this.velocity = 1.4;
        }
        else {
            this.spriteName = "fireball";
            this.velocity = 0.7;
        }
        this.spriteName = "flame";
        this.velocity = 0.7;
        this.transform.Width = 30;
        this.transform.Height = 20;
        this.lifeSpan = 5000;
        this.changes.add(ChangesDict_1.ChangesDict.VELOCITY);
        this.changes.add(ChangesDict_1.ChangesDict.LIFE_SPAN);
        this.sFunc = new Map(function* () { yield* Bullet.SerializeFunctions; yield* this.sFunc; }.bind(this)());
        this.dFunc = new Map(function* () { yield* Bullet.DeserializeFunctions; yield* this.dFunc; }.bind(this)());
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.Bullet.toString();
    }
    serverCollision(gameObject, response) {
        super.serverCollision(gameObject, response);
        if (gameObject.Type == GameObjectTypes_1.GameObjectType.Bullet.toString()) {
            if (gameObject.owner != this.owner) {
                this.destroy();
            }
        }
        if (gameObject.Type == GameObjectTypes_1.GameObjectType.Player.toString()) {
            if (gameObject.ID != this.owner) {
                this.destroy();
            }
        }
    }
    commonCollision(gameObject, response) {
        super.commonCollision(gameObject, response);
        if (gameObject.Type == GameObjectTypes_1.GameObjectType.Obstacle.toString()) {
            this.transform.X += response.overlapV.x * 1.2;
            this.transform.Y += response.overlapV.y * 1.2;
            if (response.overlapN.x) {
                this.Transform.Rotation = Math.PI - this.Transform.Rotation;
            }
            else {
                this.Transform.Rotation = 2 * Math.PI - this.Transform.Rotation;
            }
            this.changes.add(ChangesDict_1.ChangesDict.ROTATION);
            this.changes.add(ChangesDict_1.ChangesDict.POSITION);
        }
    }
    get Power() {
        return this.power;
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
    static serializeOwner(bullet) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.OWNER) + bullet.owner;
    }
    static deserializeOwner(bullet, data) {
        bullet.owner = data;
    }
}
Bullet.SerializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.LIFE_SPAN, Bullet.serializeLifeSpan],
    [ChangesDict_1.ChangesDict.OWNER, Bullet.serializeOwner]
]);
Bullet.DeserializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.LIFE_SPAN, Bullet.deserializeLifeSpan],
    [ChangesDict_1.ChangesDict.OWNER, Bullet.deserializeOwner]
]);
exports.Bullet = Bullet;

},{"./ChangesDict":27,"./GameObject":29,"./GameObjectTypes":30}],27:[function(require,module,exports){
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
ChangesDict.SIZE = 'Z';
//Player
ChangesDict.HP = 'H';
ChangesDict.MAX_HP = 'M';
ChangesDict.NAME = 'N';
//Bullet
ChangesDict.LIFE_SPAN = 'L';
ChangesDict.ROTATION = 'R';
ChangesDict.OWNER = 'O';
exports.ChangesDict = ChangesDict;

},{}],28:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectTypes_1 = require("./GameObjectTypes");
const ObjectsFactory_1 = require("./ObjectsFactory");
const Actor_1 = require("./Actor");
const ChangesDict_1 = require("./ChangesDict");
class Enemy extends Actor_1.Actor {
    constructor(name, transform) {
        super(name, transform);
        this.timeFromLastShot = 1000;
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.Player.toString();
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
        let rotation = Math.random() * 10;
        let sinAngle = Math.sin(rotation);
        let cosAngle = Math.cos(rotation);
        this.transform.X += cosAngle * this.velocity * delta;
        this.transform.Y += sinAngle * this.velocity * delta;
        this.changes.add(ChangesDict_1.ChangesDict.POSITION);
    }
    serverUpdate(delta) {
        if (this.HP <= 0) {
            this.destroy();
            return;
        }
        this.timeFromLastShot -= delta;
        if (this.timeFromLastShot <= 0) {
            this.timeFromLastShot = 1000;
            for (let i = 0; i < 10; i++) {
                let bullet = ObjectsFactory_1.ObjectsFactory.CreateGameObject("B");
                bullet.Owner = this.ID;
                bullet.Transform.Rotation = Math.floor(Math.random() * 360);
                bullet.Transform.X = this.transform.X;
                bullet.Transform.Y = this.transform.Y;
            }
        }
    }
}
exports.Enemy = Enemy;

},{"./Actor":25,"./ChangesDict":27,"./GameObjectTypes":30,"./ObjectsFactory":32}],29:[function(require,module,exports){
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
        this.spriteName = "none";
        this.destroyListeners = new Set();
    }
    onCollisionEnter(gameObject, response) {
        if (CommonConfig_1.CommonConfig.ORIGIN == CommonConfig_1.Origin.SERVER) {
            this.serverCollision(gameObject, response);
        }
        this.commonCollision(gameObject, response);
    }
    serverCollision(gameObject, response) {
    }
    commonCollision(gameObject, response) {
    }
    forceCompleteUpdate() {
        this.forceComplete = true;
    }
    update(delta) {
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
        // console.log("Object destroyed " + this.ID);
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
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.POSITION)
            + gameObject.Transform.X.toPrecision(4)
            + ',' + gameObject.Transform.Y.toPrecision(4);
    }
    static deserializePosition(gameObject, data) {
        let x = data.split(',')[0];
        let y = data.split(',')[1];
        gameObject.transform.X = parseFloat(x);
        gameObject.transform.Y = parseFloat(y);
    }
    static serializeSize(gameObject) {
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.SIZE)
            + gameObject.Transform.Width + ',' + gameObject.Transform.Height;
    }
    static deserializeSize(gameObject, data) {
        let w = data.split(',')[0];
        let h = data.split(',')[1];
        gameObject.transform.Width = parseFloat(w);
        gameObject.transform.Height = parseFloat(h);
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
        return ChangesDict_1.ChangesDict.buildTag(ChangesDict_1.ChangesDict.ROTATION) + gameObject.Transform.Rotation.toPrecision(4);
    }
    static deserializeRotation(gameObject, data) {
        gameObject.Transform.Rotation = parseFloat(data);
    }
}
GameObject.NEXT_ID = 0;
GameObject.SerializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.POSITION, GameObject.serializePosition],
    [ChangesDict_1.ChangesDict.SIZE, GameObject.serializeSize],
    [ChangesDict_1.ChangesDict.SPRITE, GameObject.serializeSpriteName],
    [ChangesDict_1.ChangesDict.VELOCITY, GameObject.serializeVelocity],
    [ChangesDict_1.ChangesDict.ROTATION, GameObject.serializeRotation],
]);
GameObject.DeserializeFunctions = new Map([
    [ChangesDict_1.ChangesDict.POSITION, GameObject.deserializePosition],
    [ChangesDict_1.ChangesDict.SIZE, GameObject.deserializeSize],
    [ChangesDict_1.ChangesDict.SPRITE, GameObject.deserializeSpriteName],
    [ChangesDict_1.ChangesDict.VELOCITY, GameObject.deserializeVelocity],
    [ChangesDict_1.ChangesDict.ROTATION, GameObject.deserializeRotation],
]);
exports.GameObject = GameObject;

},{"../../CommonConfig":19,"./ChangesDict":27}],30:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var GameObjectType;
(function (GameObjectType) {
    GameObjectType[GameObjectType["GameObject"] = 'G'] = "GameObject";
    GameObjectType[GameObjectType["Actor"] = 'A'] = "Actor";
    GameObjectType[GameObjectType["Player"] = 'P'] = "Player";
    GameObjectType[GameObjectType["Enemy"] = 'E'] = "Enemy";
    GameObjectType[GameObjectType["Bullet"] = 'B'] = "Bullet";
    GameObjectType[GameObjectType["Obstacle"] = 'O'] = "Obstacle";
})(GameObjectType = exports.GameObjectType || (exports.GameObjectType = {}));

},{}],31:[function(require,module,exports){
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

},{}],32:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Player_1 = require("./Player");
const Transform_1 = require("../physics/Transform");
const Bullet_1 = require("./Bullet");
const Obstacle_1 = require("./Obstacle");
const Enemy_1 = require("./Enemy");
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
        else if (type == "E") {
            gameObject = new Enemy_1.Enemy("MONSTER", position);
        }
        else if (type == "B") {
            gameObject = new Bullet_1.Bullet(position);
        }
        else if (type == "O") {
            gameObject = new Obstacle_1.Obstacle(position);
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
            // console.log("New object " + gameObject.ID);
        }
        return gameObject;
    }
}
ObjectsFactory.HolderSubscribers = new Array();
ObjectsFactory.DestroySubscribers = new Array();
exports.ObjectsFactory = ObjectsFactory;

},{"../physics/Transform":36,"./Bullet":26,"./Enemy":28,"./Obstacle":33,"./Player":34}],33:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObject_1 = require("./GameObject");
const GameObjectTypes_1 = require("./GameObjectTypes");
class Obstacle extends GameObject_1.GameObject {
    get Type() {
        return GameObjectTypes_1.GameObjectType.Obstacle.toString();
    }
    //private lifeSpan: number = -1;
    constructor(transform) {
        super(transform);
        this.id = this.Type + this.id;
    }
    onCollisionEnter(gameObject) {
    }
    serverUpdate(delta) {
        super.serverUpdate(delta);
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
        //this.changes.add(ChangesDict.POSITION);
    }
}
exports.Obstacle = Obstacle;

},{"./GameObject":29,"./GameObjectTypes":30}],34:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameObjectTypes_1 = require("./GameObjectTypes");
const ChangesDict_1 = require("./ChangesDict");
const ObjectsFactory_1 = require("./ObjectsFactory");
const Actor_1 = require("./Actor");
class Player extends Actor_1.Actor {
    constructor(name, transform) {
        super(name, transform);
        this.moveDirection = 0;
        this.inputCommands = new Map();
    }
    get Type() {
        return GameObjectTypes_1.GameObjectType.Player.toString();
    }
    setInput(commands) {
        this.inputCommands = commands;
    }
    commonUpdate(delta) {
        super.commonUpdate(delta);
        if (this.inputCommands.has("D")) {
            this.moveDirection = parseInt(this.inputCommands.get("D"));
            this.inputCommands.delete("D");
        }
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
        if (this.moveDirection != 0) {
            this.transform.X += xFactor * this.velocity * delta;
            this.transform.Y += yFactor * this.velocity * delta;
            this.changes.add(ChangesDict_1.ChangesDict.POSITION);
        }
    }
    serverUpdate(delta) {
        if (this.inputCommands.has("C")) {
            for (let i = 0; i < 1; i++) {
                let bullet = ObjectsFactory_1.ObjectsFactory.CreateGameObject("B");
                bullet.Owner = this.ID;
                bullet.Transform.Rotation = parseFloat(this.inputCommands.get("C"));
                //bullet.Transform.Rotation = Math.floor(Math.random() * 360);
                bullet.Transform.X = this.transform.X;
                bullet.Transform.Y = this.transform.Y;
            }
            this.inputCommands.delete("C");
        }
    }
    set Direction(direction) {
        if (direction >= 0 && direction <= 8) {
            this.moveDirection = direction;
        }
    }
    get Direction() {
        return this.moveDirection;
    }
}
exports.Player = Player;

},{"./Actor":25,"./ChangesDict":27,"./GameObjectTypes":30,"./ObjectsFactory":32}],35:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Transform_1 = require("./Transform");
const SAT = require("sat");
class Cell {
    constructor(transform) {
        this.objects = new Array();
        this.id = Cell.ID++;
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
    checkCollisions() {
        let response = new SAT.Response();
        for (let i = 0; i < this.objects.length; i++) {
            for (let j = i + 1; j < this.objects.length; j++) {
                let o1 = this.objects[i];
                let o2 = this.objects[j];
                response.clear();
                if (o1 != o2 && Transform_1.Transform.testCollision(o1.Transform, o2.Transform, response)) {
                    o1.onCollisionEnter(o2, response);
                    o2.onCollisionEnter(o1, response);
                }
            }
        }
    }
}
Cell.ID = 0;
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
            let xe = Math.floor(xs + (gameObject.Transform.Width / this.cellSize)) + 1;
            xs = Math.floor(xs) - 1;
            let ys = gameObject.Transform.Y / this.cellSize;
            let ye = Math.floor(ys + (gameObject.Transform.Height / this.cellSize)) + 1;
            ys = Math.floor(ys) - 1;
            for (let i = xs; i <= xe; i++) {
                if (i >= this.cellsX || i < 0)
                    continue;
                for (let j = ys; j <= ye; j++) {
                    if (j >= this.cellsY || j < 0)
                        continue;
                    let idx = (j * this.cellsX) + i;
                    if (Transform_1.Transform.testCollision(gameObject.Transform, this.cells[idx].Transform)) {
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
    }
    addObject(gameObject) {
        this.gameObjects.push(gameObject);
    }
    removeObject(gameObject) {
        if (this.gameObjects.indexOf(gameObject) != -1) {
            this.gameObjects.splice(this.gameObjects.indexOf(gameObject), 1);
        }
    }
    get Cells() {
        return this.cells;
    }
}
exports.SpacialGrid = SpacialGrid;

},{"./Transform":36,"sat":37}],36:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SAT = require("sat");
class Transform {
    constructor(x, y, width, height) {
        x = x || 0;
        y = y || 0;
        this.width = width || 32;
        this.height = height || 32;
        let w = this.Width / 2;
        let h = this.Height / 2;
        this.polygon = new SAT.Polygon(new SAT.Vector(x, y), [
            new SAT.Vector(-w, -h), new SAT.Vector(w, -h),
            new SAT.Vector(w, h), new SAT.Vector(-w, h)
        ]);
    }
    static testCollision(t1, t2, response) {
        let result;
        if (response) {
            result = SAT.testPolygonPolygon(t1.Polygon, t2.Polygon, response);
        }
        else {
            result = SAT.testPolygonPolygon(t1.Polygon, t2.Polygon);
        }
        return result;
    }
    rotate(angle) {
        this.Rotation += angle;
    }
    get Polygon() {
        return this.polygon;
    }
    get X() {
        return this.polygon.pos.x;
    }
    set X(x) {
        this.polygon.pos.x = x;
    }
    get Y() {
        return this.polygon.pos.y;
    }
    set Y(y) {
        this.polygon.pos.y = y;
    }
    set Width(width) {
        this.width = width;
        let w = this.Width / 2;
        let h = this.Height / 2;
        this.polygon = new SAT.Polygon(new SAT.Vector(this.X, this.Y), [
            new SAT.Vector(-w, -h), new SAT.Vector(w, -h),
            new SAT.Vector(w, h), new SAT.Vector(-w, h)
        ]);
    }
    get Width() {
        return this.width;
    }
    set Height(height) {
        this.height = height;
        let w = this.Width / 2;
        let h = this.Height / 2;
        this.polygon = new SAT.Polygon(new SAT.Vector(this.X, this.Y), [
            new SAT.Vector(-w, -h), new SAT.Vector(w, -h),
            new SAT.Vector(w, h), new SAT.Vector(-w, h)
        ]);
    }
    get Height() {
        return this.height;
    }
    set Rotation(angle) {
        this.polygon.setAngle(angle);
    }
    get Rotation() {
        return this.polygon.angle;
    }
}
exports.Transform = Transform;

},{"sat":37}],37:[function(require,module,exports){
// Version 0.6.0 - Copyright 2012 - 2016 -  Jim Riecken <jimr@jimr.ca>
//
// Released under the MIT License - https://github.com/jriecken/sat-js
//
// A simple library for determining intersections of circles and
// polygons using the Separating Axis Theorem.
/** @preserve SAT.js - Version 0.6.0 - Copyright 2012 - 2016 - Jim Riecken <jimr@jimr.ca> - released under the MIT License. https://github.com/jriecken/sat-js */

/*global define: false, module: false*/
/*jshint shadow:true, sub:true, forin:true, noarg:true, noempty:true, 
  eqeqeq:true, bitwise:true, strict:true, undef:true, 
  curly:true, browser:true */

// Create a UMD wrapper for SAT. Works in:
//
//  - Plain browser via global SAT variable
//  - AMD loader (like require.js)
//  - Node.js
//
// The quoted properties all over the place are used so that the Closure Compiler
// does not mangle the exposed API in advanced mode.
/**
 * @param {*} root - The global scope
 * @param {Function} factory - Factory that creates SAT module
 */
(function (root, factory) {
  "use strict";
  if (typeof define === 'function' && define['amd']) {
    define(factory);
  } else if (typeof exports === 'object') {
    module['exports'] = factory();
  } else {
    root['SAT'] = factory();
  }
}(this, function () {
  "use strict";

  var SAT = {};

  //
  // ## Vector
  //
  // Represents a vector in two dimensions with `x` and `y` properties.


  // Create a new Vector, optionally passing in the `x` and `y` coordinates. If
  // a coordinate is not specified, it will be set to `0`
  /** 
   * @param {?number=} x The x position.
   * @param {?number=} y The y position.
   * @constructor
   */
  function Vector(x, y) {
    this['x'] = x || 0;
    this['y'] = y || 0;
  }
  SAT['Vector'] = Vector;
  // Alias `Vector` as `V`
  SAT['V'] = Vector;


  // Copy the values of another Vector into this one.
  /**
   * @param {Vector} other The other Vector.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['copy'] = Vector.prototype.copy = function(other) {
    this['x'] = other['x'];
    this['y'] = other['y'];
    return this;
  };

  // Create a new vector with the same coordinates as this on.
  /**
   * @return {Vector} The new cloned vector
   */
  Vector.prototype['clone'] = Vector.prototype.clone = function() {
    return new Vector(this['x'], this['y']);
  };

  // Change this vector to be perpendicular to what it was before. (Effectively
  // roatates it 90 degrees in a clockwise direction)
  /**
   * @return {Vector} This for chaining.
   */
  Vector.prototype['perp'] = Vector.prototype.perp = function() {
    var x = this['x'];
    this['x'] = this['y'];
    this['y'] = -x;
    return this;
  };

  // Rotate this vector (counter-clockwise) by the specified angle (in radians).
  /**
   * @param {number} angle The angle to rotate (in radians)
   * @return {Vector} This for chaining.
   */
  Vector.prototype['rotate'] = Vector.prototype.rotate = function (angle) {
    var x = this['x'];
    var y = this['y'];
    this['x'] = x * Math.cos(angle) - y * Math.sin(angle);
    this['y'] = x * Math.sin(angle) + y * Math.cos(angle);
    return this;
  };

  // Reverse this vector.
  /**
   * @return {Vector} This for chaining.
   */
  Vector.prototype['reverse'] = Vector.prototype.reverse = function() {
    this['x'] = -this['x'];
    this['y'] = -this['y'];
    return this;
  };
  

  // Normalize this vector.  (make it have length of `1`)
  /**
   * @return {Vector} This for chaining.
   */
  Vector.prototype['normalize'] = Vector.prototype.normalize = function() {
    var d = this.len();
    if(d > 0) {
      this['x'] = this['x'] / d;
      this['y'] = this['y'] / d;
    }
    return this;
  };
  
  // Add another vector to this one.
  /**
   * @param {Vector} other The other Vector.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['add'] = Vector.prototype.add = function(other) {
    this['x'] += other['x'];
    this['y'] += other['y'];
    return this;
  };
  
  // Subtract another vector from this one.
  /**
   * @param {Vector} other The other Vector.
   * @return {Vector} This for chaiing.
   */
  Vector.prototype['sub'] = Vector.prototype.sub = function(other) {
    this['x'] -= other['x'];
    this['y'] -= other['y'];
    return this;
  };
  
  // Scale this vector. An independant scaling factor can be provided
  // for each axis, or a single scaling factor that will scale both `x` and `y`.
  /**
   * @param {number} x The scaling factor in the x direction.
   * @param {?number=} y The scaling factor in the y direction.  If this
   *   is not specified, the x scaling factor will be used.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['scale'] = Vector.prototype.scale = function(x,y) {
    this['x'] *= x;
    this['y'] *= y || x;
    return this; 
  };
  
  // Project this vector on to another vector.
  /**
   * @param {Vector} other The vector to project onto.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['project'] = Vector.prototype.project = function(other) {
    var amt = this.dot(other) / other.len2();
    this['x'] = amt * other['x'];
    this['y'] = amt * other['y'];
    return this;
  };
  
  // Project this vector onto a vector of unit length. This is slightly more efficient
  // than `project` when dealing with unit vectors.
  /**
   * @param {Vector} other The unit vector to project onto.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['projectN'] = Vector.prototype.projectN = function(other) {
    var amt = this.dot(other);
    this['x'] = amt * other['x'];
    this['y'] = amt * other['y'];
    return this;
  };
  
  // Reflect this vector on an arbitrary axis.
  /**
   * @param {Vector} axis The vector representing the axis.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['reflect'] = Vector.prototype.reflect = function(axis) {
    var x = this['x'];
    var y = this['y'];
    this.project(axis).scale(2);
    this['x'] -= x;
    this['y'] -= y;
    return this;
  };
  
  // Reflect this vector on an arbitrary axis (represented by a unit vector). This is
  // slightly more efficient than `reflect` when dealing with an axis that is a unit vector.
  /**
   * @param {Vector} axis The unit vector representing the axis.
   * @return {Vector} This for chaining.
   */
  Vector.prototype['reflectN'] = Vector.prototype.reflectN = function(axis) {
    var x = this['x'];
    var y = this['y'];
    this.projectN(axis).scale(2);
    this['x'] -= x;
    this['y'] -= y;
    return this;
  };
  
  // Get the dot product of this vector and another.
  /**
   * @param {Vector}  other The vector to dot this one against.
   * @return {number} The dot product.
   */
  Vector.prototype['dot'] = Vector.prototype.dot = function(other) {
    return this['x'] * other['x'] + this['y'] * other['y'];
  };
  
  // Get the squared length of this vector.
  /**
   * @return {number} The length^2 of this vector.
   */
  Vector.prototype['len2'] = Vector.prototype.len2 = function() {
    return this.dot(this);
  };
  
  // Get the length of this vector.
  /**
   * @return {number} The length of this vector.
   */
  Vector.prototype['len'] = Vector.prototype.len = function() {
    return Math.sqrt(this.len2());
  };
  
  // ## Circle
  //
  // Represents a circle with a position and a radius.

  // Create a new circle, optionally passing in a position and/or radius. If no position
  // is given, the circle will be at `(0,0)`. If no radius is provided, the circle will
  // have a radius of `0`.
  /**
   * @param {Vector=} pos A vector representing the position of the center of the circle
   * @param {?number=} r The radius of the circle
   * @constructor
   */
  function Circle(pos, r) {
    this['pos'] = pos || new Vector();
    this['r'] = r || 0;
  }
  SAT['Circle'] = Circle;
  
  // Compute the axis-aligned bounding box (AABB) of this Circle.
  //
  // Note: Returns a _new_ `Polygon` each time you call this.
  /**
   * @return {Polygon} The AABB
   */
  Circle.prototype['getAABB'] = Circle.prototype.getAABB = function() {
    var r = this['r'];
    var corner = this["pos"].clone().sub(new Vector(r, r));
    return new Box(corner, r*2, r*2).toPolygon();
  };

  // ## Polygon
  //
  // Represents a *convex* polygon with any number of points (specified in counter-clockwise order)
  //
  // Note: Do _not_ manually change the `points`, `angle`, or `offset` properties. Use the
  // provided setters. Otherwise the calculated properties will not be updated correctly.
  //
  // `pos` can be changed directly.

  // Create a new polygon, passing in a position vector, and an array of points (represented
  // by vectors relative to the position vector). If no position is passed in, the position
  // of the polygon will be `(0,0)`.
  /**
   * @param {Vector=} pos A vector representing the origin of the polygon. (all other
   *   points are relative to this one)
   * @param {Array.<Vector>=} points An array of vectors representing the points in the polygon,
   *   in counter-clockwise order.
   * @constructor
   */
  function Polygon(pos, points) {
    this['pos'] = pos || new Vector();
    this['angle'] = 0;
    this['offset'] = new Vector();
    this.setPoints(points || []);
  }
  SAT['Polygon'] = Polygon;
  
  // Set the points of the polygon.
  //
  // Note: The points are counter-clockwise *with respect to the coordinate system*.
  // If you directly draw the points on a screen that has the origin at the top-left corner
  // it will _appear_ visually that the points are being specified clockwise. This is just
  // because of the inversion of the Y-axis when being displayed.
  /**
   * @param {Array.<Vector>=} points An array of vectors representing the points in the polygon,
   *   in counter-clockwise order.
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['setPoints'] = Polygon.prototype.setPoints = function(points) {
    // Only re-allocate if this is a new polygon or the number of points has changed.
    var lengthChanged = !this['points'] || this['points'].length !== points.length;
    if (lengthChanged) {
      var i;
      var calcPoints = this['calcPoints'] = [];
      var edges = this['edges'] = [];
      var normals = this['normals'] = [];
      // Allocate the vector arrays for the calculated properties
      for (i = 0; i < points.length; i++) {
        calcPoints.push(new Vector());
        edges.push(new Vector());
        normals.push(new Vector());
      }
    }
    this['points'] = points;
    this._recalc();
    return this;
  };

  // Set the current rotation angle of the polygon.
  /**
   * @param {number} angle The current rotation angle (in radians).
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['setAngle'] = Polygon.prototype.setAngle = function(angle) {
    this['angle'] = angle;
    this._recalc();
    return this;
  };

  // Set the current offset to apply to the `points` before applying the `angle` rotation.
  /**
   * @param {Vector} offset The new offset vector.
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['setOffset'] = Polygon.prototype.setOffset = function(offset) {
    this['offset'] = offset;
    this._recalc();
    return this;
  };

  // Rotates this polygon counter-clockwise around the origin of *its local coordinate system* (i.e. `pos`).
  //
  // Note: This changes the **original** points (so any `angle` will be applied on top of this rotation).
  /**
   * @param {number} angle The angle to rotate (in radians)
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['rotate'] = Polygon.prototype.rotate = function(angle) {
    var points = this['points'];
    var len = points.length;
    for (var i = 0; i < len; i++) {
      points[i].rotate(angle);
    }
    this._recalc();
    return this;
  };

  // Translates the points of this polygon by a specified amount relative to the origin of *its own coordinate
  // system* (i.e. `pos`).
  //
  // This is most useful to change the "center point" of a polygon. If you just want to move the whole polygon, change
  // the coordinates of `pos`.
  //
  // Note: This changes the **original** points (so any `offset` will be applied on top of this translation)
  /**
   * @param {number} x The horizontal amount to translate.
   * @param {number} y The vertical amount to translate.
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype['translate'] = Polygon.prototype.translate = function (x, y) {
    var points = this['points'];
    var len = points.length;
    for (var i = 0; i < len; i++) {
      points[i].x += x;
      points[i].y += y;
    }
    this._recalc();
    return this;
  };


  // Computes the calculated collision polygon. Applies the `angle` and `offset` to the original points then recalculates the
  // edges and normals of the collision polygon.
  /**
   * @return {Polygon} This for chaining.
   */
  Polygon.prototype._recalc = function() {
    // Calculated points - this is what is used for underlying collisions and takes into account
    // the angle/offset set on the polygon.
    var calcPoints = this['calcPoints'];
    // The edges here are the direction of the `n`th edge of the polygon, relative to
    // the `n`th point. If you want to draw a given edge from the edge value, you must
    // first translate to the position of the starting point.
    var edges = this['edges'];
    // The normals here are the direction of the normal for the `n`th edge of the polygon, relative
    // to the position of the `n`th point. If you want to draw an edge normal, you must first
    // translate to the position of the starting point.
    var normals = this['normals'];
    // Copy the original points array and apply the offset/angle
    var points = this['points'];
    var offset = this['offset'];
    var angle = this['angle'];
    var len = points.length;
    var i;
    for (i = 0; i < len; i++) {
      var calcPoint = calcPoints[i].copy(points[i]);
      calcPoint.x += offset.x;
      calcPoint.y += offset.y;
      if (angle !== 0) {
        calcPoint.rotate(angle);
      }
    }
    // Calculate the edges/normals
    for (i = 0; i < len; i++) {
      var p1 = calcPoints[i];
      var p2 = i < len - 1 ? calcPoints[i + 1] : calcPoints[0];
      var e = edges[i].copy(p2).sub(p1);
      normals[i].copy(e).perp().normalize();
    }
    return this;
  };
  
  
  // Compute the axis-aligned bounding box. Any current state
  // (translations/rotations) will be applied before constructing the AABB.
  //
  // Note: Returns a _new_ `Polygon` each time you call this.
  /**
   * @return {Polygon} The AABB
   */
  Polygon.prototype["getAABB"] = Polygon.prototype.getAABB = function() {
    var points = this["calcPoints"];
    var len = points.length;
    var xMin = points[0]["x"];
    var yMin = points[0]["y"];
    var xMax = points[0]["x"];
    var yMax = points[0]["y"];
    for (var i = 1; i < len; i++) {
      var point = points[i];
      if (point["x"] < xMin) {
        xMin = point["x"];
      }
      else if (point["x"] > xMax) {
        xMax = point["x"];
      }
      if (point["y"] < yMin) {
        yMin = point["y"];
      }
      else if (point["y"] > yMax) {
        yMax = point["y"];
      }
    }
    return new Box(this["pos"].clone().add(new Vector(xMin, yMin)), xMax - xMin, yMax - yMin).toPolygon();
  };
  

  // ## Box
  //
  // Represents an axis-aligned box, with a width and height.


  // Create a new box, with the specified position, width, and height. If no position
  // is given, the position will be `(0,0)`. If no width or height are given, they will
  // be set to `0`.
  /**
   * @param {Vector=} pos A vector representing the bottom-left of the box (i.e. the smallest x and smallest y value).
   * @param {?number=} w The width of the box.
   * @param {?number=} h The height of the box.
   * @constructor
   */
  function Box(pos, w, h) {
    this['pos'] = pos || new Vector();
    this['w'] = w || 0;
    this['h'] = h || 0;
  }
  SAT['Box'] = Box;

  // Returns a polygon whose edges are the same as this box.
  /**
   * @return {Polygon} A new Polygon that represents this box.
   */
  Box.prototype['toPolygon'] = Box.prototype.toPolygon = function() {
    var pos = this['pos'];
    var w = this['w'];
    var h = this['h'];
    return new Polygon(new Vector(pos['x'], pos['y']), [
     new Vector(), new Vector(w, 0), 
     new Vector(w,h), new Vector(0,h)
    ]);
  };
  
  // ## Response
  //
  // An object representing the result of an intersection. Contains:
  //  - The two objects participating in the intersection
  //  - The vector representing the minimum change necessary to extract the first object
  //    from the second one (as well as a unit vector in that direction and the magnitude
  //    of the overlap)
  //  - Whether the first object is entirely inside the second, and vice versa.
  /**
   * @constructor
   */  
  function Response() {
    this['a'] = null;
    this['b'] = null;
    this['overlapN'] = new Vector();
    this['overlapV'] = new Vector();
    this.clear();
  }
  SAT['Response'] = Response;

  // Set some values of the response back to their defaults.  Call this between tests if
  // you are going to reuse a single Response object for multiple intersection tests (recommented
  // as it will avoid allcating extra memory)
  /**
   * @return {Response} This for chaining
   */
  Response.prototype['clear'] = Response.prototype.clear = function() {
    this['aInB'] = true;
    this['bInA'] = true;
    this['overlap'] = Number.MAX_VALUE;
    return this;
  };

  // ## Object Pools

  // A pool of `Vector` objects that are used in calculations to avoid
  // allocating memory.
  /**
   * @type {Array.<Vector>}
   */
  var T_VECTORS = [];
  for (var i = 0; i < 10; i++) { T_VECTORS.push(new Vector()); }
  
  // A pool of arrays of numbers used in calculations to avoid allocating
  // memory.
  /**
   * @type {Array.<Array.<number>>}
   */
  var T_ARRAYS = [];
  for (var i = 0; i < 5; i++) { T_ARRAYS.push([]); }

  // Temporary response used for polygon hit detection.
  /**
   * @type {Response}
   */
  var T_RESPONSE = new Response();

  // Tiny "point" polygon used for polygon hit detection.
  /**
   * @type {Polygon}
   */
  var TEST_POINT = new Box(new Vector(), 0.000001, 0.000001).toPolygon();

  // ## Helper Functions

  // Flattens the specified array of points onto a unit vector axis,
  // resulting in a one dimensional range of the minimum and
  // maximum value on that axis.
  /**
   * @param {Array.<Vector>} points The points to flatten.
   * @param {Vector} normal The unit vector axis to flatten on.
   * @param {Array.<number>} result An array.  After calling this function,
   *   result[0] will be the minimum value,
   *   result[1] will be the maximum value.
   */
  function flattenPointsOn(points, normal, result) {
    var min = Number.MAX_VALUE;
    var max = -Number.MAX_VALUE;
    var len = points.length;
    for (var i = 0; i < len; i++ ) {
      // The magnitude of the projection of the point onto the normal
      var dot = points[i].dot(normal);
      if (dot < min) { min = dot; }
      if (dot > max) { max = dot; }
    }
    result[0] = min; result[1] = max;
  }
  
  // Check whether two convex polygons are separated by the specified
  // axis (must be a unit vector).
  /**
   * @param {Vector} aPos The position of the first polygon.
   * @param {Vector} bPos The position of the second polygon.
   * @param {Array.<Vector>} aPoints The points in the first polygon.
   * @param {Array.<Vector>} bPoints The points in the second polygon.
   * @param {Vector} axis The axis (unit sized) to test against.  The points of both polygons
   *   will be projected onto this axis.
   * @param {Response=} response A Response object (optional) which will be populated
   *   if the axis is not a separating axis.
   * @return {boolean} true if it is a separating axis, false otherwise.  If false,
   *   and a response is passed in, information about how much overlap and
   *   the direction of the overlap will be populated.
   */
  function isSeparatingAxis(aPos, bPos, aPoints, bPoints, axis, response) {
    var rangeA = T_ARRAYS.pop();
    var rangeB = T_ARRAYS.pop();
    // The magnitude of the offset between the two polygons
    var offsetV = T_VECTORS.pop().copy(bPos).sub(aPos);
    var projectedOffset = offsetV.dot(axis);
    // Project the polygons onto the axis.
    flattenPointsOn(aPoints, axis, rangeA);
    flattenPointsOn(bPoints, axis, rangeB);
    // Move B's range to its position relative to A.
    rangeB[0] += projectedOffset;
    rangeB[1] += projectedOffset;
    // Check if there is a gap. If there is, this is a separating axis and we can stop
    if (rangeA[0] > rangeB[1] || rangeB[0] > rangeA[1]) {
      T_VECTORS.push(offsetV); 
      T_ARRAYS.push(rangeA); 
      T_ARRAYS.push(rangeB);
      return true;
    }
    // This is not a separating axis. If we're calculating a response, calculate the overlap.
    if (response) {
      var overlap = 0;
      // A starts further left than B
      if (rangeA[0] < rangeB[0]) {
        response['aInB'] = false;
        // A ends before B does. We have to pull A out of B
        if (rangeA[1] < rangeB[1]) { 
          overlap = rangeA[1] - rangeB[0];
          response['bInA'] = false;
        // B is fully inside A.  Pick the shortest way out.
        } else {
          var option1 = rangeA[1] - rangeB[0];
          var option2 = rangeB[1] - rangeA[0];
          overlap = option1 < option2 ? option1 : -option2;
        }
      // B starts further left than A
      } else {
        response['bInA'] = false;
        // B ends before A ends. We have to push A out of B
        if (rangeA[1] > rangeB[1]) { 
          overlap = rangeA[0] - rangeB[1];
          response['aInB'] = false;
        // A is fully inside B.  Pick the shortest way out.
        } else {
          var option1 = rangeA[1] - rangeB[0];
          var option2 = rangeB[1] - rangeA[0];
          overlap = option1 < option2 ? option1 : -option2;
        }
      }
      // If this is the smallest amount of overlap we've seen so far, set it as the minimum overlap.
      var absOverlap = Math.abs(overlap);
      if (absOverlap < response['overlap']) {
        response['overlap'] = absOverlap;
        response['overlapN'].copy(axis);
        if (overlap < 0) {
          response['overlapN'].reverse();
        }
      }      
    }
    T_VECTORS.push(offsetV); 
    T_ARRAYS.push(rangeA); 
    T_ARRAYS.push(rangeB);
    return false;
  }
  SAT['isSeparatingAxis'] = isSeparatingAxis;
  
  // Calculates which Voronoi region a point is on a line segment.
  // It is assumed that both the line and the point are relative to `(0,0)`
  //
  //            |       (0)      |
  //     (-1)  [S]--------------[E]  (1)
  //            |       (0)      |
  /**
   * @param {Vector} line The line segment.
   * @param {Vector} point The point.
   * @return  {number} LEFT_VORONOI_REGION (-1) if it is the left region,
   *          MIDDLE_VORONOI_REGION (0) if it is the middle region,
   *          RIGHT_VORONOI_REGION (1) if it is the right region.
   */
  function voronoiRegion(line, point) {
    var len2 = line.len2();
    var dp = point.dot(line);
    // If the point is beyond the start of the line, it is in the
    // left voronoi region.
    if (dp < 0) { return LEFT_VORONOI_REGION; }
    // If the point is beyond the end of the line, it is in the
    // right voronoi region.
    else if (dp > len2) { return RIGHT_VORONOI_REGION; }
    // Otherwise, it's in the middle one.
    else { return MIDDLE_VORONOI_REGION; }
  }
  // Constants for Voronoi regions
  /**
   * @const
   */
  var LEFT_VORONOI_REGION = -1;
  /**
   * @const
   */
  var MIDDLE_VORONOI_REGION = 0;
  /**
   * @const
   */
  var RIGHT_VORONOI_REGION = 1;
  
  // ## Collision Tests

  // Check if a point is inside a circle.
  /**
   * @param {Vector} p The point to test.
   * @param {Circle} c The circle to test.
   * @return {boolean} true if the point is inside the circle, false if it is not.
   */
  function pointInCircle(p, c) {
    var differenceV = T_VECTORS.pop().copy(p).sub(c['pos']);
    var radiusSq = c['r'] * c['r'];
    var distanceSq = differenceV.len2();
    T_VECTORS.push(differenceV);
    // If the distance between is smaller than the radius then the point is inside the circle.
    return distanceSq <= radiusSq;
  }
  SAT['pointInCircle'] = pointInCircle;

  // Check if a point is inside a convex polygon.
  /**
   * @param {Vector} p The point to test.
   * @param {Polygon} poly The polygon to test.
   * @return {boolean} true if the point is inside the polygon, false if it is not.
   */
  function pointInPolygon(p, poly) {
    TEST_POINT['pos'].copy(p);
    T_RESPONSE.clear();
    var result = testPolygonPolygon(TEST_POINT, poly, T_RESPONSE);
    if (result) {
      result = T_RESPONSE['aInB'];
    }
    return result;
  }
  SAT['pointInPolygon'] = pointInPolygon;

  // Check if two circles collide.
  /**
   * @param {Circle} a The first circle.
   * @param {Circle} b The second circle.
   * @param {Response=} response Response object (optional) that will be populated if
   *   the circles intersect.
   * @return {boolean} true if the circles intersect, false if they don't. 
   */
  function testCircleCircle(a, b, response) {
    // Check if the distance between the centers of the two
    // circles is greater than their combined radius.
    var differenceV = T_VECTORS.pop().copy(b['pos']).sub(a['pos']);
    var totalRadius = a['r'] + b['r'];
    var totalRadiusSq = totalRadius * totalRadius;
    var distanceSq = differenceV.len2();
    // If the distance is bigger than the combined radius, they don't intersect.
    if (distanceSq > totalRadiusSq) {
      T_VECTORS.push(differenceV);
      return false;
    }
    // They intersect.  If we're calculating a response, calculate the overlap.
    if (response) { 
      var dist = Math.sqrt(distanceSq);
      response['a'] = a;
      response['b'] = b;
      response['overlap'] = totalRadius - dist;
      response['overlapN'].copy(differenceV.normalize());
      response['overlapV'].copy(differenceV).scale(response['overlap']);
      response['aInB']= a['r'] <= b['r'] && dist <= b['r'] - a['r'];
      response['bInA'] = b['r'] <= a['r'] && dist <= a['r'] - b['r'];
    }
    T_VECTORS.push(differenceV);
    return true;
  }
  SAT['testCircleCircle'] = testCircleCircle;
  
  // Check if a polygon and a circle collide.
  /**
   * @param {Polygon} polygon The polygon.
   * @param {Circle} circle The circle.
   * @param {Response=} response Response object (optional) that will be populated if
   *   they interset.
   * @return {boolean} true if they intersect, false if they don't.
   */
  function testPolygonCircle(polygon, circle, response) {
    // Get the position of the circle relative to the polygon.
    var circlePos = T_VECTORS.pop().copy(circle['pos']).sub(polygon['pos']);
    var radius = circle['r'];
    var radius2 = radius * radius;
    var points = polygon['calcPoints'];
    var len = points.length;
    var edge = T_VECTORS.pop();
    var point = T_VECTORS.pop();
    
    // For each edge in the polygon:
    for (var i = 0; i < len; i++) {
      var next = i === len - 1 ? 0 : i + 1;
      var prev = i === 0 ? len - 1 : i - 1;
      var overlap = 0;
      var overlapN = null;
      
      // Get the edge.
      edge.copy(polygon['edges'][i]);
      // Calculate the center of the circle relative to the starting point of the edge.
      point.copy(circlePos).sub(points[i]);
      
      // If the distance between the center of the circle and the point
      // is bigger than the radius, the polygon is definitely not fully in
      // the circle.
      if (response && point.len2() > radius2) {
        response['aInB'] = false;
      }
      
      // Calculate which Voronoi region the center of the circle is in.
      var region = voronoiRegion(edge, point);
      // If it's the left region:
      if (region === LEFT_VORONOI_REGION) {
        // We need to make sure we're in the RIGHT_VORONOI_REGION of the previous edge.
        edge.copy(polygon['edges'][prev]);
        // Calculate the center of the circle relative the starting point of the previous edge
        var point2 = T_VECTORS.pop().copy(circlePos).sub(points[prev]);
        region = voronoiRegion(edge, point2);
        if (region === RIGHT_VORONOI_REGION) {
          // It's in the region we want.  Check if the circle intersects the point.
          var dist = point.len();
          if (dist > radius) {
            // No intersection
            T_VECTORS.push(circlePos); 
            T_VECTORS.push(edge);
            T_VECTORS.push(point); 
            T_VECTORS.push(point2);
            return false;
          } else if (response) {
            // It intersects, calculate the overlap.
            response['bInA'] = false;
            overlapN = point.normalize();
            overlap = radius - dist;
          }
        }
        T_VECTORS.push(point2);
      // If it's the right region:
      } else if (region === RIGHT_VORONOI_REGION) {
        // We need to make sure we're in the left region on the next edge
        edge.copy(polygon['edges'][next]);
        // Calculate the center of the circle relative to the starting point of the next edge.
        point.copy(circlePos).sub(points[next]);
        region = voronoiRegion(edge, point);
        if (region === LEFT_VORONOI_REGION) {
          // It's in the region we want.  Check if the circle intersects the point.
          var dist = point.len();
          if (dist > radius) {
            // No intersection
            T_VECTORS.push(circlePos); 
            T_VECTORS.push(edge); 
            T_VECTORS.push(point);
            return false;              
          } else if (response) {
            // It intersects, calculate the overlap.
            response['bInA'] = false;
            overlapN = point.normalize();
            overlap = radius - dist;
          }
        }
      // Otherwise, it's the middle region:
      } else {
        // Need to check if the circle is intersecting the edge,
        // Change the edge into its "edge normal".
        var normal = edge.perp().normalize();
        // Find the perpendicular distance between the center of the 
        // circle and the edge.
        var dist = point.dot(normal);
        var distAbs = Math.abs(dist);
        // If the circle is on the outside of the edge, there is no intersection.
        if (dist > 0 && distAbs > radius) {
          // No intersection
          T_VECTORS.push(circlePos); 
          T_VECTORS.push(normal); 
          T_VECTORS.push(point);
          return false;
        } else if (response) {
          // It intersects, calculate the overlap.
          overlapN = normal;
          overlap = radius - dist;
          // If the center of the circle is on the outside of the edge, or part of the
          // circle is on the outside, the circle is not fully inside the polygon.
          if (dist >= 0 || overlap < 2 * radius) {
            response['bInA'] = false;
          }
        }
      }
      
      // If this is the smallest overlap we've seen, keep it. 
      // (overlapN may be null if the circle was in the wrong Voronoi region).
      if (overlapN && response && Math.abs(overlap) < Math.abs(response['overlap'])) {
        response['overlap'] = overlap;
        response['overlapN'].copy(overlapN);
      }
    }
    
    // Calculate the final overlap vector - based on the smallest overlap.
    if (response) {
      response['a'] = polygon;
      response['b'] = circle;
      response['overlapV'].copy(response['overlapN']).scale(response['overlap']);
    }
    T_VECTORS.push(circlePos); 
    T_VECTORS.push(edge); 
    T_VECTORS.push(point);
    return true;
  }
  SAT['testPolygonCircle'] = testPolygonCircle;
  
  // Check if a circle and a polygon collide.
  //
  // **NOTE:** This is slightly less efficient than polygonCircle as it just
  // runs polygonCircle and reverses everything at the end.
  /**
   * @param {Circle} circle The circle.
   * @param {Polygon} polygon The polygon.
   * @param {Response=} response Response object (optional) that will be populated if
   *   they interset.
   * @return {boolean} true if they intersect, false if they don't.
   */
  function testCirclePolygon(circle, polygon, response) {
    // Test the polygon against the circle.
    var result = testPolygonCircle(polygon, circle, response);
    if (result && response) {
      // Swap A and B in the response.
      var a = response['a'];
      var aInB = response['aInB'];
      response['overlapN'].reverse();
      response['overlapV'].reverse();
      response['a'] = response['b'];
      response['b'] = a;
      response['aInB'] = response['bInA'];
      response['bInA'] = aInB;
    }
    return result;
  }
  SAT['testCirclePolygon'] = testCirclePolygon;
  
  // Checks whether polygons collide.
  /**
   * @param {Polygon} a The first polygon.
   * @param {Polygon} b The second polygon.
   * @param {Response=} response Response object (optional) that will be populated if
   *   they interset.
   * @return {boolean} true if they intersect, false if they don't.
   */
  function testPolygonPolygon(a, b, response) {
    var aPoints = a['calcPoints'];
    var aLen = aPoints.length;
    var bPoints = b['calcPoints'];
    var bLen = bPoints.length;
    // If any of the edge normals of A is a separating axis, no intersection.
    for (var i = 0; i < aLen; i++) {
      if (isSeparatingAxis(a['pos'], b['pos'], aPoints, bPoints, a['normals'][i], response)) {
        return false;
      }
    }
    // If any of the edge normals of B is a separating axis, no intersection.
    for (var i = 0;i < bLen; i++) {
      if (isSeparatingAxis(a['pos'], b['pos'], aPoints, bPoints, b['normals'][i], response)) {
        return false;
      }
    }
    // Since none of the edge normals of A or B are a separating axis, there is an intersection
    // and we've already calculated the smallest overlap (in isSeparatingAxis).  Calculate the
    // final overlap vector.
    if (response) {
      response['a'] = a;
      response['b'] = b;
      response['overlapV'].copy(response['overlapN']).scale(response['overlap']);
    }
    return true;
  }
  SAT['testPolygonPolygon'] = testPolygonPolygon;

  return SAT;
}));

},{}]},{},[16]);
