import {Assets, Spritesheet, Texture} from "pixi.js";
import {getAnimationFrameGroup, ResourceType} from "./ResourceManifest";

export {ResourceType} from "./ResourceManifest";

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

        if(this.type == ResourceType.OCTAGONAL_ANIMATION) {
            this.textures.set("U", []);
            this.textures.set("UR", []);
            this.textures.set("R", []);
            this.textures.set("DR", []);
            this.textures.set("D", []);
            this.textures.set("DL", []);
            this.textures.set("L", []);
            this.textures.set("UL", []);
        } else if(type == ResourceType.ANIMATION) {
            this.textures.set(this.name, []);
        }
    }
}

export class ResourcesLoader {
    private static instance: ResourcesLoader;

    private resources: Map<string, Resource> = new Map<string, Resource>();
    private resourcePaths: Map<string, string> = new Map<string, string>();

    private constructor() {

    }

    static get Instance(): ResourcesLoader {
        if(ResourcesLoader.instance) {
            return ResourcesLoader.instance;
        } else {
            ResourcesLoader.instance = new ResourcesLoader;
            return ResourcesLoader.instance;
        }
    }

    registerResource(name: string, path: string, type: ResourceType): void {
        if (this.resources.has(name)) {
            throw new Error(`Resource '${name}' is already registered`);
        }
        this.resources.set(name, new Resource(name, type));
        this.resourcePaths.set(name, path);
    }

    async load(): Promise<void> {
        await Promise.all(Array.from(this.resources.entries()).map(async ([name, resource]) => {
            const path = this.resourcePaths.get(name);
            if (!path) {
                throw new Error(`Resource '${name}' has no registered path`);
            }

            if (resource.type === ResourceType.SPRITE) {
                resource.texture = await Assets.load<Texture>(path);
                return;
            }

            const spritesheet = await Assets.load<Spritesheet>(path);
            this.collectAnimationTextures(resource, spritesheet);
        }));
    }

    getResource(name: string) : Resource {
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
