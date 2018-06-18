import {CommonConfig, Origin} from "../common/CommonConfig";
import {GameClient} from "./GameClient";

CommonConfig.ORIGIN = Origin.CLIENT;

window.onload = () => {
    new GameClient();
};



