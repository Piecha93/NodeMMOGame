import { ExpeditionState, isExpeditionState } from "../../shared/gameplay/Expedition";

export interface ExpeditionView {
    readonly objective: string;
    readonly guidance: string;
    readonly bearing: string;
    readonly distance: string;
}

/** Counts down for presentation only. Only the server starts or clears a wave. */
export function expeditionView(state: ExpeditionState, elapsedMs = 0): ExpeditionView {
    const seconds = Math.ceil(Math.max(0, state.stageRemainingMs - elapsedMs) / 1000);
    if (state.waveStage === "complete")
        return {
            objective: "Polana obroniona!",
            guidance: "Szósta fala za wami. Dobra robota, drużyno.",
            bearing: "✓",
            distance: "6 / 6 fal",
        };
    if (state.waveStage === "combat")
        return {
            objective: `Fala ${state.wave} / ${state.total}`,
            guidance: "Pokonajcie wszystkich napastników. Potem 20 sekund na łup i zakupy.",
            bearing: String(state.enemiesRemaining),
            distance: "przeciwników",
        };
    return {
        objective:
            state.waveStage === "preparing"
                ? "Rozejrzyjcie się po polanie"
                : `Fala ${state.wave} odparta · chwila oddechu`,
        guidance:
            state.waveStage === "preparing"
                ? "Pierwsza fala za chwilę. Celuj kursorem, strzelaj LPM; PPM uderza falą mocy dookoła ciebie."
                : "+30 zdrowia na przerwę. Zbierzcie łup, wydajcie monety i wybierzcie ulepszenia.",
        bearing: `${seconds} s`,
        distance: state.waveStage === "preparing" ? "do pierwszej fali" : `do fali ${state.wave + 1}`,
    };
}

export function expeditionTime(milliseconds: number): string {
    const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export class ExpeditionHud {
    private state: ExpeditionState | null = null;
    private localPlayerId = "";
    private receivedAt = 0;
    private restartPending = false;
    private connectionFailed = false;
    private disposed = false;
    private readonly restart: HTMLButtonElement | null;
    private readonly debugToggle: HTMLButtonElement | null;
    private readonly restartHandler = () => {
        if (
            this.disposed ||
            this.connectionFailed ||
            this.restartPending ||
            !this.state ||
            !["won", "lost"].includes(this.state.phase)
        )
            return;
        this.restartPending = true;
        if (this.restart) {
            this.restart.disabled = true;
            this.restart.textContent = "Przygotowujemy polanę…";
        }
        this.restartRound();
    };
    private readonly debugHandler = () => {
        const debug = this.root.ownerDocument.getElementById("debug-window");
        if (debug) {
            debug.hidden = !debug.hidden;
            this.debugToggle?.setAttribute("aria-pressed", String(!debug.hidden));
        }
    };

    constructor(
        private readonly root: HTMLElement,
        private readonly restartRound: () => void,
        private readonly clock: () => number = () => performance.now(),
    ) {
        this.restart = root.querySelector<HTMLButtonElement>("[data-expedition='restart']");
        this.debugToggle = root.querySelector<HTMLButtonElement>("[data-expedition='debug']");
        this.restart?.addEventListener("click", this.restartHandler);
        this.debugToggle?.addEventListener("click", this.debugHandler);
    }

    public static create(restartRound: () => void): ExpeditionHud | null {
        if (typeof document === "undefined") return null;
        const root = document.getElementById("expedition-hud");
        return root ? new ExpeditionHud(root, restartRound) : null;
    }

    public setLocalPlayer(id: string): void {
        this.localPlayerId = id;
        if (this.state) this.renderParty(this.state);
    }

    public receive(value: unknown): value is ExpeditionState {
        if (this.disposed || this.connectionFailed || !isExpeditionState(value)) return false;
        if (this.state?.round !== value.round || this.state.phase !== value.phase) this.restartPending = false;
        this.state = value;
        this.receivedAt = this.clock();
        this.root.dataset.phase = value.phase;
        this.text("progress", `${value.collected} / ${value.total}`);
        this.text("kills", String(value.kills));
        this.text("round", `Obrona ${value.round}`);
        this.renderParty(value);
        const finished = value.phase === "won" || value.phase === "lost";
        this.hidden("result", !finished);
        this.text("result-title", value.phase === "won" ? "Polana jest wasza" : "Tym razem zabrakło czasu");
        this.text(
            "result-copy",
            value.phase === "won"
                ? `Odpartych fal: ${value.collected} z ${value.total}. Pokonani przeciwnicy: ${value.kills}. Jeszcze jedna runda?`
                : `Odpartych fal: ${value.collected} z ${value.total}. Pokonani przeciwnicy: ${value.kills}. Spróbujcie innego zestawu ulepszeń.`,
        );
        if (this.restart) {
            this.restart.disabled = !finished || this.restartPending;
            this.restart.textContent = this.restartPending ? "Przygotowujemy polanę…" : "Jeszcze jedna obrona";
        }
        this.update();
        return true;
    }

    public update(_position?: readonly [number, number]): void {
        if (this.disposed || this.connectionFailed || !this.state) return;
        const state = this.state;
        const elapsed = state.phase === "active" ? Math.max(0, this.clock() - this.receivedAt) : 0;
        this.text("timer", expeditionTime(state.remainingMs - elapsed));
        const view = expeditionView(state, elapsed);
        this.text("objective", state.phase === "waiting" ? "Zbieramy drużynę" : view.objective);
        this.text(
            "guidance",
            state.phase === "lost" ? "Czas na nową próbę. Wybierzcie ulepszenia pasujące do broni." : view.guidance,
        );
        this.text("bearing", view.bearing);
        this.text("distance", view.distance);
        const self = state.party.find((player) => player.id === this.localPlayerId);
        const respawning = state.phase === "active" && self !== undefined && self.hp === 0;
        this.hidden("respawn", !respawning);
        this.text("respawn-time", String(Math.max(1, Math.ceil(((self?.respawnInMs ?? 0) - elapsed) / 1000))));
    }

    public showConnectionError(message: string): void {
        if (this.disposed || this.connectionFailed) return;
        this.connectionFailed = true;
        this.text("result-label", "POŁĄCZENIE Z OBOZEM");
        this.text("result-title", "Nie możemy ruszyć dalej");
        this.text("result-copy", message.slice(0, 256));
        this.text("objective", "Obrona niedostępna");
        this.text("guidance", "Wróć do wejścia, aby spróbować ponownie.");
        this.text("timer", "—");
        this.hidden("respawn", true);
        this.hidden("restart", true);
        this.hidden("leave", false);
        this.hidden("result", false);
        if (this.restart) this.restart.disabled = true;
    }

    private renderParty(state: ExpeditionState): void {
        const party = this.root.querySelector<HTMLElement>("[data-expedition='party']");
        if (!party) return;
        party.replaceChildren(
            ...state.party.map((player) => {
                const item = this.root.ownerDocument.createElement("li");
                item.className = player.id === this.localPlayerId ? "party-member party-self" : "party-member";
                const name = this.root.ownerDocument.createElement("span");
                name.textContent = `${player.name}${player.id === this.localPlayerId ? " · Ty" : ""}`;
                const health = this.root.ownerDocument.createElement("meter");
                health.min = 0;
                health.max = Math.max(1, player.maxHp);
                health.value = player.hp;
                health.setAttribute("aria-label", `${player.name}: ${player.hp} / ${player.maxHp} zdrowia`);
                const label = this.root.ownerDocument.createElement("small");
                label.textContent = player.hp === 0 ? "powrót do obozu…" : `${player.hp} / ${player.maxHp}`;
                item.append(name, health, label);
                return item;
            }),
        );
    }

    private text(name: string, value: string): void {
        const element = this.root.querySelector<HTMLElement>(`[data-expedition='${name}']`);
        if (element && element.textContent !== value) element.textContent = value;
    }

    private hidden(name: string, value: boolean): void {
        const element = this.root.querySelector<HTMLElement>(`[data-expedition='${name}']`);
        if (element) element.hidden = value;
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.restart?.removeEventListener("click", this.restartHandler);
        this.debugToggle?.removeEventListener("click", this.debugHandler);
        this.state = null;
    }
}
