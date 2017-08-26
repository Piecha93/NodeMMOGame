import {GameClient} from "./GameClient";
import {CommonConfig, Origin} from "../Common/CommonConfig";
import {Types} from "../Common/utils/game/GameObjectTypes";

CommonConfig.ORIGIN = Origin.CLIENT;
Types.Init();

window.onload = () => {
    let client: GameClient = new GameClient();
};



