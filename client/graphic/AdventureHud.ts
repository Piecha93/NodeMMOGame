import {
    AdventureState,
    isAdventureState,
    UpgradeId,
    UPGRADES,
    WeaponId,
    WEAPONS,
} from "../../shared/gameplay/Adventure";

type Adventurer = AdventureState["players"][number];
type PendingChoice = { kind: "upgrade"; id: UpgradeId; rank: number } | { kind: "weapon"; id: WeaponId };

/** Displays server-owned progression. A click only requests a change; no stats are predicted here. */
export class AdventureHud {
    private state: AdventureState | null = null;
    private localPlayerId = "";
    private disposed = false;
    private failed = false;
    private active = true;
    private pending: PendingChoice | null = null;
    private pendingTimeout: ReturnType<typeof setTimeout> | null = null;
    private lastLevel = 0;
    private lastRound = 0;
    private readonly listeners: Array<{ element: HTMLButtonElement; listener: () => void }> = [];

    constructor(
        private readonly root: HTMLElement,
        private readonly onUpgrade: (id: UpgradeId) => void,
        private readonly onWeapon: (id: WeaponId) => void,
    ) {
        for (const upgrade of UPGRADES) {
            const element = this.upgradeButton(upgrade.id);
            if (!element) continue;
            const listener = () => {
                const player = this.self();
                if (!player || this.disposed || this.failed || !this.active || this.pending || !player.points) return;
                if (player.upgrades[upgrade.id] >= upgrade.maxRank) return;
                this.beginRequest({ kind: "upgrade", id: upgrade.id, rank: player.upgrades[upgrade.id] });
                this.onUpgrade(upgrade.id);
            };
            element.addEventListener("click", listener);
            this.listeners.push({ element, listener });
        }
        for (const weapon of WEAPONS) {
            const element = this.weaponButton(weapon.id);
            if (!element) continue;
            const listener = () => {
                const player = this.self();
                if (!player || this.disposed || this.failed || !this.active || this.pending) return;
                if (player.level < weapon.unlockLevel || player.weapon === weapon.id) return;
                this.beginRequest({ kind: "weapon", id: weapon.id });
                this.onWeapon(weapon.id);
            };
            element.addEventListener("click", listener);
            this.listeners.push({ element, listener });
        }
        this.render();
    }

    public static create(onUpgrade: (id: UpgradeId) => void, onWeapon: (id: WeaponId) => void): AdventureHud | null {
        if (typeof document === "undefined") return null;
        const root = document.getElementById("adventure-hud");
        return root ? new AdventureHud(root, onUpgrade, onWeapon) : null;
    }

    public setLocalPlayerId(id: string): void {
        if (this.disposed || this.localPlayerId === id) return;
        this.localPlayerId = id;
        this.lastLevel = 0;
        this.clearRequest();
        this.render();
    }

    public setActive(active: boolean): void {
        if (this.disposed || this.active === active) return;
        this.active = active;
        if (!active) this.clearRequest();
        this.render();
    }

    public update(value: unknown): value is AdventureState {
        if (this.disposed || this.failed || !isAdventureState(value)) return false;
        if (this.state && value.round < this.state.round) return false;
        const nextPlayer = value.players.find((player) => player.id === this.localPlayerId);
        if (
            this.pending &&
            (value.round !== this.state?.round ||
                !nextPlayer ||
                (this.pending.kind === "weapon"
                    ? nextPlayer.weapon === this.pending.id
                    : nextPlayer.upgrades[this.pending.id] !== this.pending.rank))
        )
            this.clearRequest();
        this.state = value;
        this.render();
        return true;
    }

    public setConnectionError(message: string): void {
        if (this.disposed || this.failed) return;
        this.failed = true;
        this.clearRequest();
        this.text("notice", message.slice(0, 256));
        this.render();
    }

    private self(): Adventurer | undefined {
        return this.state?.players.find((player) => player.id === this.localPlayerId);
    }

    private beginRequest(choice: PendingChoice): void {
        this.pending = choice;
        this.pendingTimeout = setTimeout(() => {
            this.pendingTimeout = null;
            this.pending = null;
            if (!this.disposed && !this.failed) {
                this.render();
                this.text("notice", "Nie otrzymaliśmy potwierdzenia. Możesz spróbować ponownie.");
            }
        }, 1500);
        this.render();
    }

    private clearRequest(): void {
        if (this.pendingTimeout !== null) clearTimeout(this.pendingTimeout);
        this.pendingTimeout = null;
        this.pending = null;
    }

    private render(): void {
        const player = this.self();
        const unavailable = this.disposed || this.failed || !this.active || !player;
        if (player && this.state) {
            const levelUp = this.lastRound === this.state.round && this.lastLevel > 0 && player.level > this.lastLevel;
            this.lastRound = this.state.round;
            this.lastLevel = player.level;
            this.text("level", String(player.level));
            this.text("xp", player.xpToNext === 0 ? "MAKSYMALNY POZIOM" : `${player.xp} / ${player.xpToNext} PD`);
            const progress = this.field<HTMLProgressElement>("xp-bar");
            if (progress) {
                progress.max = Math.max(1, player.xpToNext);
                progress.value = player.xpToNext === 0 ? progress.max : player.xp;
                progress.setAttribute(
                    "aria-valuetext",
                    player.xpToNext === 0
                        ? "Maksymalny poziom"
                        : `${player.xp} z ${player.xpToNext} punktów doświadczenia`,
                );
            }
            this.text("coins", String(player.coins));
            this.text(
                "points",
                player.points
                    ? `${player.points} ${player.points === 1 ? "punkt" : player.points <= 4 ? "punkty" : "punktów"} rozwoju`
                    : "ROZWÓJ BOHATERA",
            );
            this.root.dataset.points = String(player.points > 0 && this.active);
            this.text("wave", `Fala ${this.state.wave}`);
            this.text(
                "wave-time",
                this.state.nextWaveInMs > 0
                    ? `Następna za ${Math.ceil(this.state.nextWaveInMs / 1000)} s`
                    : "Przeciwnicy w ruinach",
            );
            if (!this.failed)
                this.text(
                    "notice",
                    !this.active
                        ? "Rozwój wróci z kolejną wyprawą."
                        : this.pending
                          ? "Czekamy na potwierdzenie…"
                          : levelUp
                            ? `Poziom ${player.level}! Wybierz ulepszenie poniżej.`
                            : player.points
                              ? "Masz punkty rozwoju. Wybierz ulepszenie."
                              : "Zbieraj łup po przeciwnikach · PD i monety dla drużyny",
                );
        }
        for (const weapon of WEAPONS) {
            const button = this.weaponButton(weapon.id);
            if (!button) continue;
            const locked = !player || player.level < weapon.unlockLevel;
            const selected = player?.weapon === weapon.id;
            button.disabled = unavailable || locked || Boolean(this.pending);
            button.setAttribute("aria-pressed", String(selected));
            button.setAttribute(
                "aria-label",
                `${weapon.name}${locked ? ` · od poziomu ${weapon.unlockLevel}` : selected ? " · wybrana broń" : " · wybierz broń"}`,
            );
            button.title = `${weapon.description}${locked ? ` Odblokowanie: poziom ${weapon.unlockLevel}.` : ""}`;
            button.dataset.locked = String(locked);
            const label = button.querySelector<HTMLElement>("[data-weapon-detail]");
            if (label)
                label.textContent = locked ? `POZIOM ${weapon.unlockLevel}` : selected ? "W EKWIPUNKU" : "WYBIERZ";
        }
        for (const upgrade of UPGRADES) {
            const button = this.upgradeButton(upgrade.id);
            if (!button) continue;
            const rank = player?.upgrades[upgrade.id] ?? 0;
            const maxed = rank >= upgrade.maxRank;
            button.disabled = unavailable || !player?.points || maxed || Boolean(this.pending);
            button.title = upgrade.description;
            button.setAttribute(
                "aria-label",
                `${upgrade.name} · ${rank} z ${upgrade.maxRank}${maxed ? " · maksimum" : " · koszt 1 punkt rozwoju"}`,
            );
            const label = button.querySelector<HTMLElement>("[data-upgrade-rank]");
            if (label) label.textContent = maxed ? "MAX" : `${rank} / ${upgrade.maxRank}`;
        }
    }

    private field<T extends HTMLElement = HTMLElement>(name: string): T | null {
        return this.root.querySelector<T>(`[data-adventure='${name}']`);
    }

    private weaponButton(id: WeaponId): HTMLButtonElement | null {
        return this.root.querySelector<HTMLButtonElement>(`[data-adventure-weapon='${id}']`);
    }

    private upgradeButton(id: UpgradeId): HTMLButtonElement | null {
        return this.root.querySelector<HTMLButtonElement>(`[data-adventure-upgrade='${id}']`);
    }

    private text(name: string, value: string): void {
        const field = this.field(name);
        if (field && field.textContent !== value) field.textContent = value;
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.clearRequest();
        for (const { element, listener } of this.listeners) element.removeEventListener("click", listener);
        this.listeners.length = 0;
        this.render();
        this.state = null;
    }
}
