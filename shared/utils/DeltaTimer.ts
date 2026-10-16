export class DeltaTimer {
    private currentTime = 0;
    private delta = 0;
    private lastUpdate: number = DeltaTimer.getTimestamp();

    public getDelta(): number {
        this.currentTime = DeltaTimer.getTimestamp();
        this.delta = this.currentTime - this.lastUpdate;
        this.lastUpdate = this.currentTime;

        return this.delta;
    }

    static getTimestamp(): number {
        return Date.now();
    }
}
