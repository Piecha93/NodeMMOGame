/// <reference path="../../node_modules/@types/pixi.js/index.d.ts" />

import {Transform} from "../../Common/utils/game/Transform";
import {Cell} from "../../Common/utils/physics/SpacialGrid";

export class BoxRenderer extends PIXI.Container {
    protected cell: Cell;
    protected trans: Transform;

    protected rect1: PIXI.Graphics;

    protected red: boolean = false;

    constructor() {
        super();
    }

    public setObject(cell: Cell) {
        this.cell = cell;
        this.trans = cell.Transform;

        this.rect1 = new PIXI.Graphics();

        this.x = this.trans.X;
        this.y = this.trans.Y;
        
        this.addChild(this.rect1);
    }

    public update() {
        if(this.cell.isEmpty()) {
            if(!this.red) {
                this.drawRectl(0xff0000);
                this.red = true;
            }
        } else {
            if(this.red) {
                this.red = false;
                this.drawRectl(0x0000ff);
            }
        }
    }

    public destroy() {
        this.rect1.destroy()
    }

    private drawRectl(color) {
        this.rect1.clear();
        this.rect1.lineStyle(1, color, 1);
        this.rect1.drawRect(0, 0, this.trans.Width, this.trans.Height);
        this.rect1.endFill();
    }

}
