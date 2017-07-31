/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {Transform} from "../../Common/utils/physics/Transform";
import {Cell} from "../../Common/utils/physics/SpacialGrid";
import Graphics = PIXI.Graphics;

export class RectRenderer extends PIXI.Container {
    protected cell: Cell;
    protected trans: Transform;

    spriteRed: PIXI.Sprite;
    spriteBlue: PIXI.Sprite;

    protected red: boolean = false;

    constructor() {
        super();
    }

    static textureRed: PIXI.Texture = null;
    static textureBlue: PIXI.Texture = null;

    public setObject(cell: Cell) {
        this.cell = cell;
        this.trans = cell.Transform;


        if(RectRenderer.textureRed == null) {
            let rect1: PIXI.Graphics = new Graphics();

            rect1.clear();
            rect1.lineStyle(2, 0xff0000);
            rect1.drawRect(0, 0, this.trans.Width, this.trans.Height);
            rect1.endFill();

            RectRenderer.textureRed = rect1.generateCanvasTexture();

            rect1.clear();
            rect1.lineStyle(2, 0x0000ff);
            rect1.drawRect(0, 0, this.trans.Width, this.trans.Height);
            rect1.endFill();

            RectRenderer.textureBlue = rect1.generateCanvasTexture();
        }

        this.x = this.trans.X;
        this.y = this.trans.Y;

        this.spriteRed = new PIXI.Sprite(RectRenderer.textureRed);
        this.spriteBlue = new PIXI.Sprite(RectRenderer.textureBlue);

        let id: PIXI.Text = new PIXI.Text(this.cell.id.toString(), {
            fontFamily: "Arial",
            fontSize: "12px",
            fill: "#ffffff"
        });
        this.addChild(id);
    }

    public update() {
        if(this.cell.isEmpty()) {
            if(!this.red) {
                this.removeChild(this.spriteBlue);
                this.addChild(this.spriteRed);
                this.red = true;
            }
        } else {
            if(this.red) {
                this.red = false;
                this.removeChild(this.spriteRed);
                this.addChild(this.spriteBlue);
            }
        }
    }

    public destroy() {
        // this.sp.destroy()
    }
}
