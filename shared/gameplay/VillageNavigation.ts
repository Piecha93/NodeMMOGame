import { isVillageWalkable, VILLAGE_TILE_SIZE } from "./VillageMap";

type Position = readonly [number, number];

/** Uses the same footprint as map collision; diagonals never cut through cover. */
export function villageLineClear(from: Position, to: Position, radius = 16): boolean {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 12));
    if (steps > 1024) return false;
    for (let step = 1; step <= steps; step++) {
        if (!isVillageWalkable(from[0] + (dx * step) / steps, from[1] + (dy * step) / steps, radius)) return false;
    }
    return true;
}

/** A small bounded A* search is only used by adventure enemies behind scenery. */
export function villageWaypoint(from: Position, to: Position): [number, number] | null {
    if (villageLineClear(from, to)) return [...to];
    const size = VILLAGE_TILE_SIZE;
    const startX = Math.floor(from[0] / size);
    const startY = Math.floor(from[1] / size);
    const goalX = Math.floor(to[0] / size);
    const goalY = Math.floor(to[1] / size);
    const key = (x: number, y: number) => `${x},${y}`;
    type Node = { x: number; y: number; cost: number; estimate: number; parent: Node | null };
    const open: Node[] = [{ x: startX, y: startY, cost: 0, estimate: 0, parent: null }];
    const costs = new Map<string, number>([[key(startX, startY), 0]]);
    let visited = 0;
    while (open.length > 0 && visited++ < 768) {
        let best = 0;
        for (let index = 1; index < open.length; index++)
            if (open[index]!.estimate < open[best]!.estimate) best = index;
        const current = open.splice(best, 1)[0]!;
        if (current.cost !== costs.get(key(current.x, current.y))) continue;
        const center: Position = [(current.x + 0.5) * size, (current.y + 0.5) * size];
        // A player can stand against cover while their cell's centre is inside
        // its expanded footprint. Reach the actual position from a nearby cell.
        if (
            (current.x === goalX && current.y === goalY) ||
            (Math.hypot(center[0] - to[0], center[1] - to[1]) <= size * 1.5 && villageLineClear(center, to))
        ) {
            let next = current;
            while (next.parent?.parent) next = next.parent;
            const position: [number, number] = [(next.x + 0.5) * size, (next.y + 0.5) * size];
            return villageLineClear(from, position) ? position : null;
        }
        for (const [dx, dy] of [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
        ] as const) {
            const x = current.x + dx;
            const y = current.y + dy;
            if (Math.abs(x - startX) > 36 || Math.abs(y - startY) > 36) continue;
            const cost = current.cost + 1;
            if (cost >= (costs.get(key(x, y)) ?? Infinity) || !isVillageWalkable((x + 0.5) * size, (y + 0.5) * size))
                continue;
            costs.set(key(x, y), cost);
            open.push({ x, y, cost, estimate: cost + Math.abs(goalX - x) + Math.abs(goalY - y), parent: current });
        }
    }
    return null;
}
