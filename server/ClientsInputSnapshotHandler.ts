import {Player} from "../shared/game_utils/game/objects/Player";
import {InputSnapshot} from "../shared/input/InputSnapshot";
import {INPUT_COMMAND} from "../shared/input/InputCommands";
import {GameObject} from "../shared/game_utils/game/objects/GameObject";
import {GameObjectsManager} from "../shared/game_utils/factory/GameObjectsManager";

export class ClientsInputSnapshotHandler {
    private playersLastSnapshots: Map<Player, InputSnapshot> = new Map<Player, InputSnapshot>();

    constructor() {
    }

    public setSnapshot(player: Player, snapshotData: string) {
        let snapshot: InputSnapshot = new InputSnapshot(snapshotData);

        player.setInput(snapshot);

        this.playersLastSnapshots.set(player, snapshot);

        player.addDestroyListener((destroyedObject: Player) => {
            this.playersLastSnapshots.delete(destroyedObject);
        });

        if(snapshot.Commands.has(INPUT_COMMAND.INTERACT)) {
            let gameObject: GameObject =
                GameObjectsManager.GetGameObjectById(snapshot.Commands.get(INPUT_COMMAND.INTERACT)) as GameObject;

            if(gameObject && player.Transform.distanceTo(gameObject.Transform) < 75) {
                gameObject.interact();
            }
        }

        this.playersLastSnapshots.set(player, snapshot);
    }

    public getPlayerLastSnapshot(player: Player): InputSnapshot {
        return this.playersLastSnapshots.get(player);
    }
}