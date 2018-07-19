
export enum ResourceType {
    SPRITE,
    ANIMATION,
    OCTAGONAL_ANIMATION
}

export class Resource {
    name: string;
    type: ResourceType;
    textures: Map<string, Array<PIXI.Texture> >;

    constructor(name: string, type: ResourceType) {
        this.name = name;
        this.type = type;

        this.textures = new Map<string, Array<PIXI.Texture> >();

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

    private resources: Map<string, Resource>;

    private constructor() {
        this.create();
    }

    static get Instance(): ResourcesLoader {
        if(ResourcesLoader.instance) {
            return ResourcesLoader.instance;
        } else {
            ResourcesLoader.instance = new ResourcesLoader;
            return ResourcesLoader.instance;
        }
    }

    private create() {
        this.resources = new Map<string, Resource>();
    }

    registerResource(name: string, path: string, type: ResourceType) {
        PIXI.loader.add(name, path);

        this.resources.set(name, new Resource(name, type));
    }

    load(callback: Function) {
        PIXI.loader.load(() => {
            this.postprocessResources();
            callback();
        })
    }

    getResource(name: string) : Resource {
        return this.resources.get(name);
    }

    private postprocessResources() {
        this.resources.forEach((resource: Resource, name: string) => {
            for(let frame in PIXI.loader.resources[name].data.frames) {
                if (resource.type == ResourceType.OCTAGONAL_ANIMATION) {
                    let animationDirection: string = frame.split('_')[1];
                    resource.textures.get(animationDirection).push(PIXI.Texture.fromFrame(frame));
                } else if (resource.type == ResourceType.ANIMATION) {
                    resource.textures.get(resource.name).push(PIXI.Texture.fromFrame(frame));
                }
            }
        });
    }
}