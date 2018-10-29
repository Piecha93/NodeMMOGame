import {Transform} from "../../shared/game_utils/physics/Transform";
import {GameObject} from "../../shared/game_utils/game/objects/GameObject";
import {Result} from "detect-collisions";
import {DebugWindowHtmlHandler} from "../graphic/HtmlHandlers/DebugWindowHtmlHandler";

export class Cursor extends GameObject {

    private onObjectId: string = null;
    private interactMessage: string = "";

    constructor(transform: Transform) {
        super(transform);

        this.invisible = true;
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);
    }

    destroy() {
        super.destroy();
    }

    protected sharedOnCollisionStay(gameObject: GameObject, result: Result) {
        DebugWindowHtmlHandler.Instance.CursorObjectSpan = gameObject.ID;

        this.onObjectId = gameObject.ID;

        if(gameObject.InteractPopUpMessage != null) {
            this.interactMessage = gameObject.InteractPopUpMessage;
            DebugWindowHtmlHandler.Instance.CursorObjectSpan = gameObject.ID + " " + gameObject.InteractPopUpMessage;
        } else {
            this.interactMessage = null;
        }
    }

    protected sharedOnCollisionExit(gameObject: GameObject) {
        this.interactMessage = null;
        DebugWindowHtmlHandler.Instance.CursorObjectSpan = gameObject.ID + " " + gameObject.InteractPopUpMessage;
    }

    public move(x: number, y: number) {
        this.Transform.X = x;
        this.Transform.Y = y;

        this.onObjectId = null;
        this.interactMessage = null;
    }

    get OnObjectId(): string {
        return this.onObjectId;
    }

    get InteractMessage(): string {
        return this.interactMessage;
    }
}

