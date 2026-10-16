export enum ResourceType {
    SPRITE,
    ANIMATION,
    OCTAGONAL_ANIMATION,
}

export interface ResourceDefinition {
    readonly name: string;
    readonly path: string;
    readonly type: ResourceType;
}

export const RESOURCE_MANIFEST = [
    { name: "none", path: "/resources/images/none.png", type: ResourceType.SPRITE },
    { name: "wall", path: "/resources/images/wall.png", type: ResourceType.SPRITE },
    { name: "bunny", path: "/resources/images/bunny.png", type: ResourceType.SPRITE },
    { name: "dyzma", path: "/resources/images/dyzma.jpg", type: ResourceType.SPRITE },
    { name: "kamis", path: "/resources/images/kamis.jpg", type: ResourceType.SPRITE },
    { name: "michau", path: "/resources/images/michau.png", type: ResourceType.SPRITE },
    { name: "panda", path: "/resources/images/panda.png", type: ResourceType.SPRITE },
    { name: "bullet", path: "/resources/images/bullet.png", type: ResourceType.SPRITE },
    { name: "fireball", path: "/resources/images/fireball.png", type: ResourceType.SPRITE },
    { name: "bluebolt", path: "/resources/images/bluebolt.png", type: ResourceType.SPRITE },
    { name: "hp_potion", path: "/resources/images/hp_potion.png", type: ResourceType.SPRITE },
    { name: "portal", path: "/resources/images/portal.png", type: ResourceType.SPRITE },
    { name: "white", path: "/resources/images/white.png", type: ResourceType.SPRITE },
    { name: "doors_open", path: "/resources/images/doors_open.png", type: ResourceType.SPRITE },
    { name: "doors_closed", path: "/resources/images/doors_closed.png", type: ResourceType.SPRITE },
    { name: "flame", path: "/resources/animations/flame/flame.json", type: ResourceType.ANIMATION },
    {
        name: "template_idle",
        path: "/resources/animations/actor_animations/template/idle.json",
        type: ResourceType.OCTAGONAL_ANIMATION,
    },
    {
        name: "template_run",
        path: "/resources/animations/actor_animations/template/run.json",
        type: ResourceType.OCTAGONAL_ANIMATION,
    },
    { name: "terrain", path: "/resources/maps/terrain.png", type: ResourceType.SPRITE },
] as const satisfies readonly ResourceDefinition[];

const OCTAGONAL_DIRECTIONS: ReadonlySet<string> = new Set(["U", "UR", "R", "DR", "D", "DL", "L", "UL"]);

export function validateResourceManifest(definitions: readonly ResourceDefinition[]): void {
    const names = new Set<string>();

    for (const definition of definitions) {
        if (definition.name.length === 0) {
            throw new Error("Resource names cannot be empty");
        }
        if (!definition.path.startsWith("/resources/")) {
            throw new Error(`Resource '${definition.name}' must use an absolute /resources/ path`);
        }
        if (names.has(definition.name)) {
            throw new Error(`Duplicate resource name: ${definition.name}`);
        }

        names.add(definition.name);
    }
}

export function getAnimationFrameGroup(type: ResourceType, resourceName: string, frameName: string): string | null {
    if (type === ResourceType.ANIMATION) {
        return resourceName;
    }
    if (type !== ResourceType.OCTAGONAL_ANIMATION) {
        return null;
    }

    const direction = frameName.split("_")[1];
    return direction !== undefined && OCTAGONAL_DIRECTIONS.has(direction) ? direction : null;
}

validateResourceManifest(RESOURCE_MANIFEST);
