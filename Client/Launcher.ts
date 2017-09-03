import {GameClient} from "./GameClient";
import {CommonConfig, Origin} from "../Common/CommonConfig";

CommonConfig.ORIGIN = Origin.CLIENT;

window.onload = () => {
    new GameClient();
};



