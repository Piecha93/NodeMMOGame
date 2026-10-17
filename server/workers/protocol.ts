import type { PerformanceState } from "../../shared/gameplay/Performance";

/** Delivery ACKs only bound IPC memory; they are independent of simulation input ACKs. */
export type InboundCommand =
    | { readonly type: "connect"; readonly clientId: string; readonly userId: string; readonly displayName?: string }
    | { readonly type: "event"; readonly clientId: string; readonly event: string; readonly payload: unknown }
    | { readonly type: "disconnect"; readonly clientId: string };

export interface WorkerDiagnostics {
    readonly threadId: number;
    readonly serverTick: number;
    readonly at: number;
    readonly droppedTimeMs: number;
    readonly performance: PerformanceState;
    readonly clients: number;
    readonly gameTimerActive: boolean;
    readonly updateTimerActive: boolean;
    readonly measurement?: { readonly ticks: number; readonly samples: number };
}

export interface WorkerMeasurement {
    readonly started: WorkerDiagnostics;
    readonly ended: WorkerDiagnostics;
    readonly elapsedMs: number;
    readonly ticks: number;
    /** Bounded chronological sample, capped at 16,384 ticks. Aggregates cover all measured ticks. */
    readonly tickCpuMs: readonly number[];
    readonly minTickMs: number;
    readonly maxTickMs: number;
    readonly averageTickMs: number;
    readonly enemyMin: number;
    readonly enemyMax: number;
    /** Increase during this measurement, rather than the world's lifetime total. */
    readonly droppedTimeMs: number;
}

export type WorkerRequestAction = "inspect" | "beginMeasurement" | "endMeasurement";

export type HostMessage =
    | { readonly type: "delivery"; readonly id: number; readonly messages: readonly InboundCommand[] }
    | { readonly type: "received"; readonly id: number }
    | { readonly type: "request"; readonly id: number; readonly action: WorkerRequestAction }
    | { readonly type: "stop" };

export type WorldMessage =
    | { readonly type: "ready" }
    | { readonly type: "delivered"; readonly id: number }
    | {
          readonly type: "output";
          readonly id: number;
          readonly clientId: string;
          readonly event: string;
          readonly args: unknown[];
      }
    | { readonly type: "disconnect"; readonly clientId: string; readonly reason?: string }
    | { readonly type: "response"; readonly id: number; readonly value: WorkerDiagnostics | WorkerMeasurement }
    | { readonly type: "response-error"; readonly id: number; readonly error: string }
    | { readonly type: "stopped" };

/** Untrusted browser values must be small plain DTOs before structured cloning. */
export function dtoBytes(value: unknown, maxBytes = 64 * 1024): number {
    let bytes = 0;
    let nodes = 0;
    const visit = (item: unknown, depth: number): void => {
        if (++nodes > 2048 || depth > 8) throw new Error("Worker payload is too complex");
        if (item === null || item === undefined || typeof item === "boolean" || typeof item === "number") bytes += 8;
        else if (typeof item === "string") bytes += Buffer.byteLength(item, "utf8") + 8;
        else if (item instanceof ArrayBuffer) bytes += item.byteLength;
        else if (ArrayBuffer.isView(item)) bytes += item.byteLength;
        else if (Array.isArray(item)) {
            bytes += 8;
            for (const element of item) visit(element, depth + 1);
        } else if (typeof item === "object" && Object.getPrototypeOf(item) === Object.prototype) {
            bytes += 8;
            for (const [key, element] of Object.entries(item)) {
                bytes += Buffer.byteLength(key, "utf8") + 8;
                visit(element, depth + 1);
            }
        } else throw new Error("Worker payload must be a plain DTO");
        if (bytes > maxBytes) throw new Error("Worker payload exceeds byte limit");
    };
    visit(value, 0);
    return bytes;
}
