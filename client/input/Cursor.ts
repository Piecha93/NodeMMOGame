import {Transform} from "../../shared/game_utils/physics/Transform";
import {GameObject} from "../../shared/game_utils/game/objects/GameObject";
import {Collider} from "../../shared/game_utils/physics/Collider";
import {Result} from "detect-collisions";
import {DebugWindowHtmlHandler} from "../graphic/HtmlHandlers/DebugWindowHtmlHandler";
import {Collision} from "../../shared/game_utils/physics/Collision";


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

    protected sharedOnCollisionStay(collision: Collision) {
        let gameObject: GameObject = collision.ColliderB.Parent;
        DebugWindowHtmlHandler.Instance.CursorObjectSpan = gameObject.ID;

        this.onObjectId = gameObject.ID;

        if(gameObject.InteractPopUpMessage != null) {
            this.interactMessage = gameObject.InteractPopUpMessage;
            DebugWindowHtmlHandler.Instance.CursorObjectSpan = gameObject.ID + " " + gameObject.InteractPopUpMessage;
        } else {
            this.interactMessage = null;
        }
    }

    protected sharedOnCollisionExit(collision: Collision) {
        let gameObject: GameObject = collision.ColliderB.Parent;

        this.interactMessage = null;
        DebugWindowHtmlHandler.Instance.CursorObjectSpan = gameObject.ID + " " + gameObject.InteractPopUpMessage;
    }

    public move(x: number, y: number) {
        this.Transform.X = x;
        this.Transform.Y = y;

        this.onObjectId = null;
        this.interactMessage = null;

        this.update(0);
    }

    get OnObjectId(): string {
        return this.onObjectId;
    }

    get InteractMessage(): string {
        return this.interactMessage;
    }
}

