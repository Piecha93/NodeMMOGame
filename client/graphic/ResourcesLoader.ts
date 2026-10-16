import { Assets, Spritesheet, Texture } from "pixi.js";
import { getAnimationFrameGroup, ResourceType } from "./ResourceManifest";

export { ResourceType } from "./ResourceManifest";

export class Resource {
    readonly name: string;
    readonly type: ResourceType;
    texture: Texture | null;
    textures: Map<string, Texture[]>;

    constructor(name: string, type: ResourceType) {
        this.name = name;
        this.type = type;

        this.texture = null;
        this.textures = new Map<string, Texture[]>();

        if (this.type == ResourceType.OCTAGONAL_ANIMATION) {
            this.textures.set("U", []);
            this.textures.set("UR", []);
            this.textures.set("R", []);
            this.textures.set("DR", []);
            this.textures.set("D", []);
            this.textures.set("DL", []);
            this.textures.set("L", []);
            this.textures.set("UL", []);
        } else if (type == ResourceType.ANIMATION) {
            this.textures.set(this.name, []);
        }
    }
}

export class ResourcesLoader {
    private static instance: ResourcesLoader;

    private resources: Map<string, Resource> = new Map<string, Resource>();
    private resourcePaths: Map<string, string> = new Map<string, string>();
    private readonly loads = new Map<string, Promise<void>>();

    private constructor() {}

    static get Instance(): ResourcesLoader {
        if (ResourcesLoader.instance) {
            return ResourcesLoader.instance;
        } else {
            ResourcesLoader.instance = new ResourcesLoader();
            return ResourcesLoader.instance;
        }
    }

    registerResource(name: string, path: string, type: ResourceType): void {
        const existing = this.resources.get(name);
        if (existing) {
            if (existing.type === type && this.resourcePaths.get(name) === path) return;
            throw new Error(`Resource '${name}' is already registered with a different definition`);
        }
        this.resources.set(name, new Resource(name, type));
        this.resourcePaths.set(name, path);
    }

    async load(): Promise<void> {
        await Promise.all(
            Array.from(this.resources.entries()).map(([name, resource]) => {
                const existing = this.loads.get(name);
                if (existing) return existing;
                const path = this.resourcePaths.get(name);
                if (!path) {
                    throw new Error(`Resource '${name}' has no registered path`);
                }
                const load = this.loadResource(resource, path).catch((error: unknown) => {
                    this.loads.delete(name);
                    throw error;
                });
                this.loads.set(name, load);
                return load;
            }),
        );
    }

    private async loadResource(resource: Resource, path: string): Promise<void> {
        if (resource.type === ResourceType.SPRITE) {
            resource.texture = await Assets.load<Texture>(path);
            return;
        }
        const spritesheet = await Assets.load<Spritesheet>(path);
        for (const frames of resource.textures.values()) frames.length = 0;
        this.collectAnimationTextures(resource, spritesheet);
    }

    getResource(name: string): Resource {
        const resource = this.resources.get(name);
        if (!resource) {
            throw new Error(`Unknown resource: ${name}`);
        }

        return resource;
    }

    private collectAnimationTextures(resource: Resource, spritesheet: Spritesheet): void {
        for (const [frameName, texture] of Object.entries(spritesheet.textures)) {
            const group = getAnimationFrameGroup(resource.type, resource.name, frameName);
            if (!group) {
                throw new Error(`Cannot determine animation group for frame '${frameName}' in '${resource.name}'`);
            }

            const textures = resource.textures.get(group);
            if (!textures) {
                throw new Error(`Animation group '${group}' is not registered for '${resource.name}'`);
            }

            textures.push(texture);
        }
    }
}
