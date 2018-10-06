export class TicksCounter {
    private ticks: number;

    private constructor() {
        this.ticks = 0;
    }

    public update() {
        this.ticks++;
    }

    get LastTickNumber(): number {
        return this.ticks;
    }

    private static instance: TicksCounter = null;

    static get Instance(): TicksCounter {
        if(!TicksCounter.instance) {
            TicksCounter.instance = new TicksCounter();
        }

        return TicksCounter.instance;
    }
}