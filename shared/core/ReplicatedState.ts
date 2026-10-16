import { WorldContext } from "./WorldContext";

/** Domain-side replication bookkeeping; wire codecs live at the application edge. */
export abstract class ReplicatedState {
    protected runtime: WorldContext = new WorldContext();
    protected forceComplete = true;
    protected readonly changes = new Set<string>();
    protected readonly deserializedFields = new Set<string>();
    protected lastUpdateTick = 0;

    get Runtime(): WorldContext {
        return this.runtime;
    }

    protected replicatedChildren(): readonly ReplicatedState[] {
        return [];
    }

    setRuntime(runtime: WorldContext): void {
        this.runtime = runtime;
        for (const child of this.replicatedChildren()) child.setRuntime(runtime);
    }

    addChange(change: string): void {
        if (this.runtime.isServer) this.changes.add(change);
    }

    hasChange(change: string): boolean {
        return this.runtime.isServer ? this.changes.has(change) : this.deserializedFields.has(change);
    }

    forceCompleteUpdate(): void {
        this.forceComplete = true;
    }

    commitReplicationChanges(): void {
        this.forceComplete = false;
        this.changes.clear();
        for (const child of this.replicatedChildren()) child.commitReplicationChanges();
    }

    get DeserializedFields(): Set<string> {
        return this.deserializedFields;
    }
    get LastUpdateTick(): number {
        return this.lastUpdateTick;
    }
}
