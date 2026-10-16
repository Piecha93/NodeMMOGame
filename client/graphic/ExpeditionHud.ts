import { ExpeditionState, isExpeditionState } from "../../shared/gameplay/Expedition";

export interface ExpeditionView {
    readonly objective: string;
    readonly guidance: string;
    readonly bearing: string;
    readonly distance: string;
}

const DIRECTIONS = ["→ E", "↘ SE", "↓ S", "↙ SW", "← W", "↖ NW", "↑ N", "↗ NE"] as const;

/** A presentation-only compass: progress and outcomes always come from the server. */
export function expeditionView(state: ExpeditionState, position?: readonly [number, number]): ExpeditionView {
    const returning = state.collected === state.total;
    const camps = state.camps.filter((camp) => camp.status !== "collected");
    const nearest = position
        ? [...camps].sort(
              (a, b) =>
                  Math.hypot(a.x - position[0], a.y - position[1]) - Math.hypot(b.x - position[0], b.y - position[1]),
          )[0]
        : camps[0];
    const target = returning ? state.home : nearest;
    const objective = returning ? "Wróćcie wszyscy do obozu" : "Odzyskajcie 3 rdzenie";
    const guidance = returning
        ? "Wszystkie rdzenie są wasze. Zbierzcie całą żywą drużynę w świetlistym kręgu."
        : nearest
          ? `${nearest.name} · ${nearest.status === "guarded" ? `strażnicy: ${nearest.guardsRemaining}` : "rdzeń odsłonięty — podejdź bliżej"}`
          : "Czekamy na sygnał z wyprawy…";
    if (!position || !target) return { objective, guidance, bearing: "◇", distance: "—" };
    const dx = target.x - position[0];
    const dy = target.y - position[1];
    const direction = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
    return {
        objective,
        guidance,
        bearing: DIRECTIONS[direction] ?? "◇",
        distance: `${Math.round(Math.hypot(dx, dy))} kroków`,
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
            this.restart.textContent = "Przygotowujemy wyprawę…";
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
        this.text("round", `Wyprawa ${value.round}`);
        this.renderParty(value);
        const camps = this.root.querySelector<HTMLElement>("[data-expedition='camps']");
        if (camps) {
            camps.replaceChildren(
                ...value.camps.map((camp) => {
                    const item = this.root.ownerDocument.createElement("li");
                    item.dataset.status = camp.status;
                    const name = this.root.ownerDocument.createElement("span");
                    name.textContent = camp.name;
                    const status = this.root.ownerDocument.createElement("span");
                    status.className = "camp-status";
                    status.textContent =
                        camp.status === "collected"
                            ? "✓ odzyskany"
                            : camp.status === "ready"
                              ? "◇ do zebrania"
                              : `${camp.guardsRemaining} strażników`;
                    item.append(name, status);
                    return item;
                }),
            );
        }
        const finished = value.phase === "won" || value.phase === "lost";
        this.hidden("result", !finished);
        this.text("result-title", value.phase === "won" ? "Wróciliście z ruin" : "Ruiny zatrzymały was na dłużej");
        this.text(
            "result-copy",
            value.phase === "won"
                ? `Trzy rdzenie bezpiecznie w obozie. Pokonani strażnicy: ${value.kills}. Gotowi na kolejną wyprawę?`
                : `Czas minął. Odzyskane rdzenie: ${value.collected} z ${value.total}. Spróbujcie inną drogą.`,
        );
        if (this.restart) {
            this.restart.disabled = !finished || this.restartPending;
            this.restart.textContent = this.restartPending ? "Przygotowujemy wyprawę…" : "Jeszcze jedna wyprawa";
        }
        this.update();
        return true;
    }

    public update(position?: readonly [number, number]): void {
        if (this.disposed || this.connectionFailed || !this.state) return;
        const state = this.state;
        const elapsed = state.phase === "active" ? Math.max(0, this.clock() - this.receivedAt) : 0;
        this.text("timer", expeditionTime(state.remainingMs - elapsed));
        const view = expeditionView(state, position);
        this.text("objective", state.phase === "waiting" ? "Zbieramy drużynę" : view.objective);
        this.text("guidance", view.guidance);
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
        this.text("objective", "Wyprawa niedostępna");
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
