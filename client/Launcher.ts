import {SharedConfig, Origin} from "../shared/SharedConfig";
import {GameClient} from "./GameClient";

SharedConfig.ORIGIN = Origin.CLIENT;

window.onload = () => {
    new GameClient();
};



