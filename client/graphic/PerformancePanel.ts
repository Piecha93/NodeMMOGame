import {
    isPerformanceState,
    PerformanceEvents,
    PerformanceState,
    validatePerformanceConfiguration,
} from "../../shared/gameplay/Performance";

interface PerformanceSocket {
    emit(event: string, value: unknown): unknown;
    on(event: string, listener: (value: unknown) => void): unknown;
    off(event: string, listener: (value: unknown) => void): unknown;
}

export class PerformancePanel {
    private disposed = false;
    private connectionFailed = false;
    private state: PerformanceState | null = null;
    private elapsed = 0;
    private frames = 0;
    private nextRequestAt = 0;
    private readonly form: HTMLFormElement | null;
    private readonly clearButton: HTMLButtonElement | null;
    private readonly stateHandler = (value: unknown) => {
        if (!this.disposed && !this.connectionFailed && isPerformanceState(value)) {
            this.state = value;
            this.render();
        }
    };
    private readonly submitHandler = (event: Event) => {
        event.preventDefault();
        this.configure(false);
    };
    private readonly clearHandler = () => this.configure(true);

    constructor(
        private readonly socket: PerformanceSocket,
        private readonly root: HTMLElement,
        private readonly clock: () => number = () => performance.now(),
    ) {
        this.form = root.querySelector<HTMLFormElement>("[data-performance-form]");
        this.clearButton = root.querySelector<HTMLButtonElement>("[data-performance-clear]");
        this.form?.addEventListener("submit", this.submitHandler);
        this.clearButton?.addEventListener("click", this.clearHandler);
        socket.on(PerformanceEvents.STATE, this.stateHandler);
    }

    private configure(clear: boolean): void {
        if (this.disposed || this.connectionFailed || this.clock() < this.nextRequestAt) return;
        const count = this.root.querySelector<HTMLSelectElement>("[name=count]");
        const distribution = this.root.querySelector<HTMLSelectElement>("[name=distribution]");
        const scenario = this.root.querySelector<HTMLSelectElement>("[name=scenario]");
        const setup = validatePerformanceConfiguration({
            count: clear ? 0 : Number(count?.value),
            distribution: distribution?.value,
            scenario: scenario?.value,
        });
        this.nextRequestAt = this.clock() + 1000;
        this.socket.emit(PerformanceEvents.CONFIGURE, setup);
        this.text("status", clear ? "Czyszczenie poligonu…" : "Ładowanie populacji…");
    }

    updateFrame(deltaMs: number, renderedCount: number, knownCount: number): void {
        if (this.disposed || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
        this.elapsed += deltaMs;
        this.frames++;
        if (this.elapsed < 250) return;
        this.text("fps", `${Math.round((this.frames * 1000) / this.elapsed)}`);
        this.text("rendered", String(renderedCount));
        this.text("known", String(knownCount));
        this.elapsed = 0;
        this.frames = 0;
        const disabled = this.connectionFailed || this.clock() < this.nextRequestAt;
        for (const button of this.root.querySelectorAll<HTMLButtonElement>("button")) button.disabled = disabled;
    }

    showConnectionError(message: string): void {
        if (this.disposed || this.connectionFailed) return;
        this.connectionFailed = true;
        this.text("status", message);
        for (const control of this.root.querySelectorAll<HTMLButtonElement | HTMLSelectElement>("button, select"))
            control.disabled = true;
    }

    private render(): void {
        const state = this.state;
        if (!state) return;
        this.text("enemies", `${state.enemies} / ${state.count}`);
        this.text("objects", String(state.objects));
        this.text("chunks", `${state.activeChunks} / ${state.totalChunks}`);
        this.text(
            "tick",
            state.tickSamples
                ? `${state.tickP50Ms.toFixed(2)} / ${state.tickP95Ms.toFixed(2)} ms`
                : "Zbieranie próbek…",
        );
        this.text("budget", `${state.tickBudgetMs.toFixed(2)} ms`);
        this.text("dropped", `${Math.round(state.droppedTimeMs)} ms`);
        this.text("traffic", `${(state.snapshotBytesPerSecond / 1024).toFixed(1)} KiB/s`);
        this.text(
            "status",
            state.pending
                ? `Tworzenie: ${state.enemies} / ${state.count}`
                : state.count
                  ? "Test aktywny · możesz chodzić i strzelać"
                  : "Wybierz obciążenie i kliknij Załaduj",
        );
    }

    private text(key: string, value: string): void {
        const target = this.root.querySelector<HTMLElement>(`[data-performance="${key}"]`);
        if (target) target.textContent = value;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.socket.off(PerformanceEvents.STATE, this.stateHandler);
        this.form?.removeEventListener("submit", this.submitHandler);
        this.clearButton?.removeEventListener("click", this.clearHandler);
        this.state = null;
    }
}
