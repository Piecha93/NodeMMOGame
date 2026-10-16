import { GameClient } from "./GameClient";

window.addEventListener(
    "load",
    () => {
        new GameClient();
    },
    { once: true },
);
