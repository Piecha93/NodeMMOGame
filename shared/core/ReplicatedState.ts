import { WorldContext } from "./WorldContext";

/** Domain-side replication bookkeeping; wire codecs live at the application edge. */
export abstract class ReplicatedState {
    private runtimeContext: WorldContext | undefined;
    protected forceComplete = true;
    protected readonly changes = new Set<string>();
    protected readonly deserializedFields = new Set<string>();
    protected lastUpdateTick = 0;

    get Runtime(): WorldContext {
        // Factories attach their world immediately after construction. Standalone
        // objects still get an independent default context when they request it.
        return (this.runtimeContext ??= new WorldContext());
    }

    protected get runtime(): WorldContext {
        return this.Runtime;
    }

    protected set runtime(runtime: WorldContext) {
        this.runtimeContext = runtime;
    }

    protected replicatedChildren(): readonly ReplicatedState[] {
        return [];
    }

    setRuntime(runtime: WorldContext): void {
        this.runtimeContext = runtime;
        for (const child of this.replicatedChildren()) child.setRuntime(runtime);
    }

    addChange(change: string): void {
        if (this.runtimeContext?.isServer ?? true) this.changes.add(change);
    }

    hasChange(change: string): boolean {
        return (this.runtimeContext?.isServer ?? true) ? this.changes.has(change) : this.deserializedFields.has(change);
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
