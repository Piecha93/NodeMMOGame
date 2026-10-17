import { parentPort, threadId } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { HostMessage, WorkerDiagnostics } from "../../server/workers/protocol";

if (!parentPort) throw new Error("The stalled-worker fixture must run in a worker thread");
const port = parentPort;
const diagnostic = (): WorkerDiagnostics => ({
    threadId,
    at: performance.now(),
    serverTick: 0,
    droppedTimeMs: 0,
    clients: 0,
    gameTimerActive: false,
    updateTimerActive: false,
    performance: {
        count: 0,
        distribution: "nearby",
        scenario: "static",
        enemies: 0,
        pending: 0,
        objects: 0,
        activeChunks: 0,
        totalChunks: 25,
        serverTick: 0,
        tickP50Ms: 0,
        tickP95Ms: 0,
        tickSamples: 0,
        tickBudgetMs: 15.625,
        droppedTimeMs: 0,
        snapshotBytesPerSecond: 0,
        simulationHz: 0,
        snapshotHz: 0,
        snapshotP95Ms: 0,
    },
});
port.on("message", (message: HostMessage | { type: "test:stall"; signal: SharedArrayBuffer }) => {
    if (message.type === "test:stall") {
        const signal = new Int32Array(message.signal);
        Atomics.store(signal, 1, 1);
        Atomics.notify(signal, 1);
        Atomics.wait(signal, 0, 0, 10_000);
    } else if (message.type === "request") port.postMessage({ type: "response", id: message.id, value: diagnostic() });
    else if (message.type === "delivery") port.postMessage({ type: "delivered", id: message.id });
    else if (message.type === "stop") {
        port.postMessage({ type: "stopped" });
        port.close();
    }
});
port.postMessage({ type: "ready" });
