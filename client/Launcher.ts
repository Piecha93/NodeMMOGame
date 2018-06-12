import {GameClient} from "./GameClient";
import {CommonConfig, Origin} from "../common/CommonConfig";

CommonConfig.ORIGIN = Origin.CLIENT;

window.onload = () => {
    new GameClient();
};



