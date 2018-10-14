import {Transform} from "../../shared/game_utils/physics/Transform";
import {GameObject} from "../../shared/game_utils/game/objects/GameObject";
import {Result} from "detect-collisions";
import {DebugWindowHtmlHandler} from "../graphic/HtmlHandlers/DebugWindowHtmlHandler";

export class Cursor extends GameObject {
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

    protected commonCollision(gameObject: GameObject, result: Result) {
        DebugWindowHtmlHandler.Instance.CursorObjectSpan = gameObject.ID;
    }
}

