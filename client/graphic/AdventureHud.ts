import {
    AdventureState,
    isAdventureState,
    PurchaseId,
    UpgradeId,
    UPGRADES,
    WeaponId,
    WEAPONS,
} from "../../shared/gameplay/Adventure";

type Adventurer = AdventureState["players"][number];
type PendingChoice =
    | { kind: "upgrade"; id: UpgradeId; rank: number }
    | { kind: "weapon"; id: WeaponId }
    | { kind: "purchase"; id: PurchaseId; coins: number };

const SHOP = [
    { id: "heal", name: "Opatrunek", description: "+60 zdrowia", cost: 6 },
    { id: "training", name: "Trening", description: "+20 doświadczenia", cost: 10 },
] as const;

/** Displays server-owned progression. A click only requests a change; no stats are predicted here. */
export class AdventureHud {
    private state: AdventureState | null = null;
    private localPlayerId = "";
    private disposed = false;
    private failed = false;
    private active = true;
    private health: { hp: number; maxHp: number } | null = null;
    private pending: PendingChoice | null = null;
    private pendingTimeout: ReturnType<typeof setTimeout> | null = null;
    private lastLevel = 0;
    private lastRound = 0;
    private readonly listeners: Array<{ element: HTMLButtonElement; listener: () => void }> = [];

    constructor(
        private readonly root: HTMLElement,
        private readonly onUpgrade: (id: UpgradeId) => void,
        private readonly onWeapon: (id: WeaponId) => void,
        private readonly onPurchase: (id: PurchaseId) => void = () => {},
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
        for (const purchase of SHOP) {
            const element = this.purchaseButton(purchase.id);
            if (!element) continue;
            const listener = () => {
                const player = this.self();
                if (!player || this.disposed || this.failed || !this.active || this.pending || !this.isShopOpen())
                    return;
                if (player.coins < purchase.cost || (purchase.id === "training" && player.xpToNext === 0)) return;
                if (purchase.id === "heal" && !this.canHeal()) return;
                this.beginRequest({ kind: "purchase", id: purchase.id, coins: player.coins });
                this.onPurchase(purchase.id);
            };
            element.addEventListener("click", listener);
            this.listeners.push({ element, listener });
        }
        this.render();
    }

    public static create(
        onUpgrade: (id: UpgradeId) => void,
        onWeapon: (id: WeaponId) => void,
        onPurchase: (id: PurchaseId) => void = () => {},
    ): AdventureHud | null {
        if (typeof document === "undefined") return null;
        const root = document.getElementById("adventure-hud");
        return root ? new AdventureHud(root, onUpgrade, onWeapon, onPurchase) : null;
    }

    public setLocalPlayerId(id: string): void {
        if (this.disposed || this.localPlayerId === id) return;
        this.localPlayerId = id;
        this.health = null;
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

    public setHealth(hp: number, maxHp: number): void {
        if (this.disposed || !Number.isFinite(hp) || !Number.isFinite(maxHp) || hp < 0 || maxHp < 1 || hp > maxHp)
            return;
        this.health = { hp, maxHp };
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
                    : this.pending.kind === "purchase"
                      ? nextPlayer.coins < this.pending.coins || value.stage === "combat" || value.stage === "complete"
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

    private isShopOpen(): boolean {
        return this.state?.stage === "preparing" || this.state?.stage === "rest";
    }

    private canHeal(): boolean {
        return !!this.health && this.health.hp > 0 && this.health.hp < this.health.maxHp;
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
        const shop = this.field("shop");
        if (shop) shop.hidden = !this.isShopOpen() || !this.active || this.failed || this.disposed;
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
            this.text("wave", this.state.wave === 0 ? "Przygotowanie" : `Fala ${this.state.wave} / 6`);
            this.text(
                "wave-time",
                this.state.nextWaveInMs > 0
                    ? `Następna za ${Math.ceil(this.state.nextWaveInMs / 1000)} s`
                    : this.state.stage === "combat"
                      ? `Pozostało: ${this.state.remainingEnemies}`
                      : "Polana obroniona",
            );
            if (!this.failed)
                this.text(
                    "notice",
                    !this.active
                        ? "Rozwój wróci z kolejną obroną."
                        : this.pending
                          ? "Czekamy na potwierdzenie…"
                          : levelUp
                            ? `Poziom ${player.level}! Wybierz ulepszenie poniżej.`
                            : player.points
                              ? "Masz punkty rozwoju. Wybierz ulepszenie."
                              : this.isShopOpen()
                                ? "Wydaj monety na zdrowie lub trening. Sklep zamknie się z początkiem fali."
                                : "Zbieraj łup · PD i monety dla drużyny",
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
        for (const purchase of SHOP) {
            const button = this.purchaseButton(purchase.id);
            if (!button) continue;
            button.disabled =
                unavailable ||
                !this.isShopOpen() ||
                !player ||
                player.coins < purchase.cost ||
                Boolean(this.pending) ||
                (purchase.id === "training" ? player.xpToNext === 0 : !this.canHeal());
            button.setAttribute("aria-label", `${purchase.name} · ${purchase.description} · ${purchase.cost} monet`);
            button.title =
                purchase.id === "heal"
                    ? "Dla żywego, rannego bohatera. Pełne zdrowie nie zużywa monet."
                    : "Doświadczenie dla twojego bohatera. Maksymalny poziom nie zużywa monet.";
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

    private purchaseButton(id: PurchaseId): HTMLButtonElement | null {
        return this.root.querySelector<HTMLButtonElement>(`[data-adventure-purchase='${id}']`);
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
