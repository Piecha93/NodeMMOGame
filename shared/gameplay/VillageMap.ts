/** The same deterministic layout drives terrain, cover, and authoritative collision. */
export const VILLAGE_TILE_SIZE = 32;

export type VillageTileKind = "grass" | "path" | "water" | "bridge";
export type VillagePropKind =
    | "house_red"
    | "house_blue"
    | "house_moss"
    | "pine"
    | "oak"
    | "rock"
    | "flowers"
    | "stump"
    | "fence";

export interface VillageRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export interface VillageProp {
    readonly id: string;
    readonly kind: VillagePropKind;
    /** Sprite bounds; collision is the visible ground footprint below the roof/canopy. */
    readonly bounds: VillageRect;
    readonly collision?: VillageRect;
}

export interface VillageTile {
    readonly kind: VillageTileKind;
    readonly variant: number;
    /** Land neighbours of water: north=1, east=2, south=4, west=8. */
    readonly shore: number;
}

const STREAM: VillageRect = { x: 1088, y: 128, width: 64, height: 1280 };
const BRIDGE: VillageRect = { x: 1088, y: 576, width: 64, height: 160 };
const POND: readonly VillageRect[] = [
    { x: 928, y: 800, width: 160, height: 32 },
    { x: 864, y: 832, width: 224, height: 128 },
    { x: 928, y: 960, width: 160, height: 32 },
];

function contains(rect: VillageRect, x: number, y: number): boolean {
    return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

function waterAt(x: number, y: number): boolean {
    return !contains(BRIDGE, x, y) && (contains(STREAM, x, y) || POND.some((rect) => contains(rect, x, y)));
}

function hash(x: number, y: number): number {
    let value = Math.imul(x ^ 0x6d2b79f5, 0x45d9f3b) ^ Math.imul(y ^ 0x51ed270b, 0x27d4eb2d);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return (value ^ (value >>> 16)) >>> 0;
}

export function villageTileAt(tileX: number, tileY: number): VillageTile {
    const x = tileX * VILLAGE_TILE_SIZE + VILLAGE_TILE_SIZE / 2;
    const y = tileY * VILLAGE_TILE_SIZE + VILLAGE_TILE_SIZE / 2;
    const variant = hash(tileX, tileY) % 4;
    if (waterAt(x, y)) {
        const shore =
            (waterAt(x, y - 32) ? 0 : 1) |
            (waterAt(x + 32, y) ? 0 : 2) |
            (waterAt(x, y + 32) ? 0 : 4) |
            (waterAt(x - 32, y) ? 0 : 8);
        return { kind: "water", variant, shore };
    }
    if (contains(BRIDGE, x, y)) return { kind: "bridge", variant, shore: 0 };
    const inVillage = x >= 128 && x < 1408 && y >= 128 && y < 1408;
    const plaza = (x - 640) ** 2 + (y - 640) ** 2 < 145 ** 2;
    const road = (y >= 608 && y < 704) || (x >= 608 && x < 704);
    const porch =
        (x >= 288 && x < 416 && y >= 416 && y < 640) ||
        (x >= 896 && x < 1024 && y >= 416 && y < 640) ||
        (x >= 352 && x < 480 && y >= 704 && y < 1024);
    return { kind: inVillage && (plaza || road || porch) ? "path" : "grass", variant, shore: 0 };
}

function prop(id: string, kind: VillagePropKind, bounds: VillageRect, collision?: VillageRect): VillageProp {
    return Object.freeze({
        id,
        kind,
        bounds: Object.freeze(bounds),
        ...(collision ? { collision: Object.freeze(collision) } : {}),
    });
}

export const VILLAGE_PROPS: readonly VillageProp[] = Object.freeze([
    prop(
        "red-cottage",
        "house_red",
        { x: 248, y: 224, width: 208, height: 224 },
        { x: 280, y: 320, width: 144, height: 104 },
    ),
    prop(
        "blue-cottage",
        "house_blue",
        { x: 856, y: 224, width: 208, height: 224 },
        { x: 888, y: 320, width: 144, height: 104 },
    ),
    prop(
        "moss-cottage",
        "house_moss",
        { x: 304, y: 960, width: 208, height: 224 },
        { x: 336, y: 1056, width: 144, height: 104 },
    ),
    prop("north-pine", "pine", { x: 560, y: 160, width: 104, height: 152 }, { x: 600, y: 272, width: 24, height: 32 }),
    prop("north-oak", "oak", { x: 712, y: 192, width: 144, height: 160 }, { x: 768, y: 304, width: 32, height: 32 }),
    prop("west-oak", "oak", { x: 144, y: 704, width: 144, height: 160 }, { x: 200, y: 816, width: 32, height: 32 }),
    prop("west-pine", "pine", { x: 160, y: 384, width: 104, height: 152 }, { x: 200, y: 496, width: 24, height: 32 }),
    prop(
        "south-pine",
        "pine",
        { x: 664, y: 1104, width: 104, height: 152 },
        { x: 704, y: 1216, width: 24, height: 32 },
    ),
    prop("south-oak", "oak", { x: 800, y: 1120, width: 144, height: 160 }, { x: 856, y: 1232, width: 32, height: 32 }),
    prop("east-pine", "pine", { x: 1264, y: 368, width: 104, height: 152 }, { x: 1304, y: 480, width: 24, height: 32 }),
    prop("east-oak", "oak", { x: 1232, y: 864, width: 144, height: 160 }, { x: 1288, y: 976, width: 32, height: 32 }),
    prop("rocks-west", "rock", { x: 304, y: 736, width: 104, height: 88 }, { x: 320, y: 768, width: 72, height: 40 }),
    prop("rocks-north", "rock", { x: 464, y: 208, width: 88, height: 72 }, { x: 480, y: 240, width: 56, height: 32 }),
    prop(
        "rocks-south",
        "rock",
        { x: 1008, y: 1088, width: 104, height: 88 },
        { x: 1024, y: 1120, width: 56, height: 40 },
    ),
    prop("stump-west", "stump", { x: 192, y: 976, width: 64, height: 64 }, { x: 208, y: 1008, width: 32, height: 24 }),
    prop("fence-west", "fence", { x: 288, y: 496, width: 96, height: 24 }, { x: 288, y: 508, width: 96, height: 12 }),
    prop("fence-east", "fence", { x: 928, y: 496, width: 96, height: 24 }, { x: 928, y: 508, width: 96, height: 12 }),
    prop("flowers-red", "flowers", { x: 424, y: 424, width: 42, height: 36 }),
    prop("flowers-blue", "flowers", { x: 844, y: 424, width: 42, height: 36 }),
    prop("flowers-pond", "flowers", { x: 824, y: 864, width: 48, height: 40 }),
    prop("flowers-bridge", "flowers", { x: 1160, y: 720, width: 48, height: 40 }),
    prop("flowers-south", "flowers", { x: 496, y: 1144, width: 48, height: 40 }),
]);

/** Merge identical water runs vertically: six solid bodies instead of hundreds of tiles. */
function waterObstacles(): VillageRect[] {
    const rectangles: VillageRect[] = [];
    const open = new Map<string, VillageRect>();
    for (let tileY = 4; tileY < 44; tileY++) {
        const next = new Map<string, VillageRect>();
        let tileX = 4;
        while (tileX < 44) {
            if (!waterAt(tileX * 32 + 16, tileY * 32 + 16)) {
                tileX++;
                continue;
            }
            const start = tileX;
            while (tileX < 44 && waterAt(tileX * 32 + 16, tileY * 32 + 16)) tileX++;
            const key = `${start}:${tileX}`;
            const previous = open.get(key);
            const rect = previous
                ? { ...previous, height: previous.height + 32 }
                : { x: start * 32, y: tileY * 32, width: (tileX - start) * 32, height: 32 };
            next.set(key, rect);
            open.delete(key);
        }
        rectangles.push(...open.values());
        open.clear();
        for (const [key, rect] of next) open.set(key, rect);
    }
    rectangles.push(...open.values());
    return rectangles;
}

export const VILLAGE_OBSTACLES: readonly VillageRect[] = Object.freeze(
    [...waterObstacles(), ...VILLAGE_PROPS.flatMap((entry) => (entry.collision ? [entry.collision] : []))].map(
        (entry) => Object.freeze(entry),
    ),
);

/** World-space actor centre and half-size, matching the axis-aligned physics bodies. */
export function isVillageWalkable(x: number, y: number, radius = 16): boolean {
    if (![x, y, radius].every(Number.isFinite) || radius < 0) return false;
    return VILLAGE_OBSTACLES.every(
        (rect) =>
            x + radius <= rect.x ||
            x - radius >= rect.x + rect.width ||
            y + radius <= rect.y ||
            y - radius >= rect.y + rect.height,
    );
}
