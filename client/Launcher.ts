import { GameClient } from "./GameClient";

window.addEventListener(
    "load",
    () => {
        const performanceMode = new URLSearchParams(window.location.search).get("mode") === "performance";
        new GameClient({ performanceMode });
    },
    { once: true },
);
