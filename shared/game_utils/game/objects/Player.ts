import { INPUT_COMMAND, MouseKeys } from "../../../input/InputCommands";
import { Transform } from "../../physics/Transform";
import { Actor } from "./Actor";
import { ChangesDict } from "../../../core/ChangeKeys";

import { InputSnapshot } from "../../../input/InputSnapshot";
import { MagicWand } from "../weapons/MagicWand";
import { ObjectsSpawner } from "../weapons/ObjectsSpawner";
import { Collider } from "../../physics/Collider";
import { GameObject } from "./GameObject";
import { Doors } from "./Doors";
import { Collision } from "../../physics/Collision";

export class Player extends Actor {
    private respawnPosition: readonly [number, number];
    private respawnAtMs: number | null = null;
    private protectedUntilMs = -Infinity;
    private static readonly RESPAWN_DELAY_MS = 3000;
    private static readonly RESPAWN_GRACE_MS = 3000;
    private static onlyServerActions: Set<INPUT_COMMAND> = new Set<INPUT_COMMAND>([
        INPUT_COMMAND.LEFT_MOUSE,
        INPUT_COMMAND.RIGHT_MOUSE,
        INPUT_COMMAND.MIDDLE_MOUSE,
        INPUT_COMMAND.TEST,
    ]);

    constructor(transform: Transform) {
        super(transform);
        this.respawnPosition = [...transform.Position];

        let collider: Collider = this.addCollider([transform.ScaleX * 2, transform.ScaleY * 2]);
        collider.IsTriger = true;

        this.velocity = 0.25;

        this.weapon = new MagicWand();
        this.isChunkActivateTriger = true;
        this.isChunkFullUpdateTriger = true;
    }

    serverOnTriggerEnter(collision: Collision) {
        let gameObject: GameObject = collision.ColliderB.Parent;

        if (gameObject instanceof Doors) {
            (gameObject as Doors).open();
        }
    }

    serverOnTriggerExit(collision: Collision) {
        let gameObject: GameObject = collision.ColliderB.Parent;

        if (gameObject instanceof Doors) {
            (gameObject as Doors).open();
        }
    }

    private lastInputSnapshot: InputSnapshot | null = null;

    public setInput(inputSnapshot: InputSnapshot) {
        if (this.HP <= 0) {
            this.clearInput();
            return;
        }
        let inputCommands: Map<INPUT_COMMAND, string> = inputSnapshot.Commands;

        inputCommands.forEach((value: string, key: INPUT_COMMAND) => {
            if (this.Runtime.isClient && Player.onlyServerActions.has(key)) return;

            if (key == INPUT_COMMAND.HORIZONTAL) {
                this.Horizontal = parseFloat(value);
                this.lastInputSnapshot = inputSnapshot;
            } else if (key == INPUT_COMMAND.VERTICAL) {
                this.Vertical = parseFloat(value);
                this.lastInputSnapshot = inputSnapshot;
            } else if (key == INPUT_COMMAND.LEFT_MOUSE) {
                this.mouseClickAction(value, MouseKeys.LEFT);
            } else if (key == INPUT_COMMAND.RIGHT_MOUSE) {
                this.mouseClickAction(value, MouseKeys.RIGHT);
            } else if (key == INPUT_COMMAND.MIDDLE_MOUSE) {
                this.mouseClickAction(value, MouseKeys.MIDDLE);
            } else if (key == INPUT_COMMAND.SWITCH_WEAPON) {
                if (this.Runtime.config.enableDebugActions) {
                    this.switchWeaponAction();
                }
            } else if (key == INPUT_COMMAND.TEST) {
                if (this.Runtime.config.enableDebugActions) {
                    this.testAction();
                }
            }
        });
    }

    private mouseClickAction(position: string, clickButton: number) {
        const [x, y] = position.split(",").map(Number);
        if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) return;
        this.weapon?.use(this, [x, y], clickButton);
    }

    private switchWeaponAction() {
        if (this.weapon instanceof ObjectsSpawner) {
            this.weapon = new MagicWand();
        } else {
            this.weapon = new ObjectsSpawner();
        }
    }

    private testAction() {
        // this.invisible = !this.invisible;
        // this.addChange("INV");
        this.velocity += 0.8;
        if (this.velocity > 2) {
            this.velocity = 0.25;
        }
        this.addChange(ChangesDict.VELOCITY);
    }

    protected commonUpdate(delta: number) {
        super.commonUpdate(delta);

        if (this.lastInputSnapshot) {
            this.lastInputSnapshot.setSnapshotDelta();
        }

        this.updatePosition(delta);
    }

    protected serverUpdate(delta: number) {
        super.serverUpdate(delta);
        if (!this.Runtime.config.cooperative || this.HP > 0) return;
        this.respawnAtMs ??= this.Runtime.timeMs + Player.RESPAWN_DELAY_MS;
        if (this.Runtime.timeMs >= this.respawnAtMs) this.respawn();
    }

    public configureRespawn(position: readonly [number, number]): void {
        if (!position.every(Number.isFinite)) throw new RangeError("Invalid respawn position");
        this.respawnPosition = [...position];
    }

    public respawn(position: readonly [number, number] = this.respawnPosition): void {
        if (!position.every(Number.isFinite)) throw new RangeError("Invalid respawn position");
        this.configureVitals(this.MaxHP);
        this.clearInput();
        this.Transform.X = position[0];
        this.Transform.Y = position[1];
        this.updateColliders();
        this.respawnAtMs = null;
        this.protectedUntilMs = this.Runtime.timeMs + Player.RESPAWN_GRACE_MS;
    }

    public override hit(power: number): void {
        if (this.Runtime.config.performanceMode) return;
        if (this.Runtime.timeMs < this.protectedUntilMs) return;
        const wasAlive = this.HP > 0;
        super.hit(power);
        if (wasAlive && this.HP === 0) {
            this.clearInput();
            if (this.Runtime.config.cooperative) {
                this.respawnAtMs = this.Runtime.timeMs + Player.RESPAWN_DELAY_MS;
            }
        }
    }

    private clearInput(): void {
        this.Horizontal = 0;
        this.Vertical = 0;
        this.lastInputSnapshot = null;
    }

    get RespawnInMs(): number {
        return this.respawnAtMs === null ? 0 : Math.max(0, this.respawnAtMs - this.Runtime.timeMs);
    }

    override get CombatTeam(): "players" {
        return "players";
    }

    override hasStableCombatTeam(): boolean {
        return (
            this.constructor === Player &&
            Object.getPrototypeOf(this) === Player.prototype &&
            !Object.getOwnPropertyDescriptor(this, "CombatTeam") &&
            Object.getOwnPropertyDescriptor(Player.prototype, "CombatTeam")?.get === playerCombatTeamGetter
        );
    }
}

const playerCombatTeamGetter = Object.getOwnPropertyDescriptor(Player.prototype, "CombatTeam")?.get;
