import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { VILLAGE_PROPS, VillagePropKind } from "../../shared/gameplay/VillageMap";
import { ResourcesLoader } from "./ResourcesLoader";

/** Recorded alpha bounds with a small transparent margin; the original PNG is untouched. */
export const VILLAGE_PROP_FRAMES: Readonly<
    Record<Exclude<VillagePropKind, "fence">, readonly [number, number, number, number]>
> = {
    house_red: [20, 117, 375, 409],
    house_blue: [411, 121, 374, 408],
    house_moss: [793, 128, 411, 406],
    pine: [1197, 56, 310, 484],
    oak: [17, 585, 396, 382],
    rock: [428, 713, 362, 254],
    flowers: [828, 738, 325, 238],
    stump: [1190, 742, 323, 228],
};

/** One static scene assembled from eight reusable transparent props. */
export class VillageScenery extends Container {
    private readonly frames: Texture[] = [];
    private readonly props: Container[] = [];

    constructor() {
        super();
        const atlas = ResourcesLoader.Instance.getResource("village_props").texture;
        if (!atlas) throw new Error("Missing village environment atlas");
        const textures = new Map<VillagePropKind, Texture>();
        for (const [kind, [x, y, width, height]] of Object.entries(VILLAGE_PROP_FRAMES)) {
            if (x < 0 || y < 0 || x + width > atlas.width || y + height > atlas.height)
                throw new Error("Invalid village prop frame");
            const texture = new Texture({ source: atlas.source, frame: new Rectangle(x, y, width, height) });
            this.frames.push(texture);
            textures.set(kind as VillagePropKind, texture);
        }
        for (const prop of [...VILLAGE_PROPS].sort(
            (a, b) => a.bounds.y + a.bounds.height - b.bounds.y - b.bounds.height,
        )) {
            const { bounds, collision } = prop;
            const wrapper = new Container();
            wrapper.zIndex = collision ? collision.y + collision.height : bounds.y + bounds.height;
            this.addChild(wrapper);
            this.props.push(wrapper);
            // A ground footprint remains visible even below a roof or tree crown.
            if (collision) {
                const shadow = new Graphics()
                    .roundRect(collision.x - 4, collision.y - 2, collision.width + 8, collision.height + 4, 6)
                    .fill({ color: 0x17362b, alpha: 0.18 });
                wrapper.addChild(shadow);
            }
            if (prop.kind === "fence") {
                const fence = new Graphics();
                fence.rect(bounds.x, bounds.y + 7, bounds.width, 5).fill(0x986f47);
                fence.rect(bounds.x, bounds.y + 16, bounds.width, 4).fill(0x765735);
                for (let x = bounds.x; x < bounds.x + bounds.width; x += 24)
                    fence.roundRect(x, bounds.y, 7, bounds.height, 2).fill(0xb48b57);
                wrapper.addChild(fence);
                continue;
            }
            const texture = textures.get(prop.kind);
            if (!texture) throw new Error(`Missing village sprite: ${prop.kind}`);
            const sprite = new Sprite(texture);
            sprite.position.set(bounds.x, bounds.y);
            sprite.width = bounds.width;
            sprite.height = bounds.height;
            wrapper.addChild(sprite);
        }
    }

    /** Props share the actor depth layer while ground chunks remain cached below them. */
    public attachTo(parent: Container): void {
        for (const prop of this.props) parent.addChild(prop);
    }

    public override destroy(options?: Parameters<Container["destroy"]>[0]): void {
        if (this.destroyed) return;
        for (const prop of this.props) if (!prop.destroyed) prop.destroy({ children: true });
        this.props.length = 0;
        super.destroy(options ?? { children: true });
        for (const texture of this.frames) texture.destroy(false);
        this.frames.length = 0;
    }
}
