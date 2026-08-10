import {SharedConfig, Origin} from "../shared/SharedConfig";
import {GameClient} from "./GameClient";
import {registerGameObjectPrefabs} from "../shared/game_utils/factory/RegisterGameObjectPrefabs";

SharedConfig.ORIGIN = Origin.CLIENT;
registerGameObjectPrefabs();

window.onload = () => {
    new GameClient();
};


