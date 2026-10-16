export class ResourcesMap {
    static NameToId: Map<string, number> = new Map<string, number>();

    static IdToName: Map<number, string> = new Map<number, string>();

    private static shortIdCounter: number = 0;

    static RegisterResource(name: string, id: number = this.shortIdCounter) {
        if (this.NameToId.has(name) || this.IdToName.has(id) || !Number.isInteger(id) || id < 0 || id > 65535) {
            throw new Error("Duplicate or invalid resource ID");
        }
        this.NameToId.set(name, id);
        this.IdToName.set(id, name);
        this.shortIdCounter = Math.max(this.shortIdCounter, id + 1);
    }
}

// These v1 IDs are a compatibility contract; additions receive explicit IDs.
export const LEGACY_RESOURCE_IDS = Object.freeze({
    none: 0,
    wall: 1,
    bunny: 2,
    dyzma: 3,
    kamis: 4,
    michau: 5,
    panda: 6,
    bullet: 7,
    fireball: 8,
    bluebolt: 9,
    hp_potion: 10,
    portal: 11,
    white: 12,
    flame: 13,
    template: 14,
    terrain: 15,
    doors_closed: 16,
    doors_open: 17,
} as const);
Object.entries(LEGACY_RESOURCE_IDS).forEach(([name, id]) => ResourcesMap.RegisterResource(name, id));
