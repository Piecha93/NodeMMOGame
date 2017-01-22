/// <reference path="../libs/@types/phaser.d.ts" />

export class Renderer {
    private phaser: Phaser.Game;

    constructor() {
        this.phaser = new Phaser.Game(800, 600, Phaser.AUTO, 'content', { preload: this.preload.bind(this), create: this.create.bind(this) });
        if(this.phaser == null) {
            console.log("KURWA MAĆ");
        } else {
            console.log("XD" + this.phaser.antialias);
        }
    }

    private preload() {
        this.phaser.load.image('bunny', 'resources/images/bunny.png');
    }

    private create() {
        let logo = this.phaser.add.sprite(this.phaser.world.centerX, this.phaser.world.centerY, 'bunny');
        logo.anchor.setTo(0.5, 0.5);
    }
}