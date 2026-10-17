import { parentPort, workerData } from "node:worker_threads";
import { createCollisionReplayKernel } from "./collision-replay-kernel.mjs";

if (!parentPort) throw new Error("Collision replay worker requires a parent");
const replay = createCollisionReplayKernel(workerData.definitions);
parentPort.on("message", (message) => {
    if (message.type !== "run") throw new Error("Unknown collision replay request");
    const output = replay(message.input);
    parentPort.postMessage({ id: message.id, output }, [output.buffer]);
});
parentPort.postMessage({ type: "ready" });
