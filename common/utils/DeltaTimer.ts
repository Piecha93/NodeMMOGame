export class DeltaTimer {
    private currentTime: number;
    private delta: number;
    private lastUpdate: number = DeltaTimer.getTimestamp();


    public getDelta(): number {
        this.currentTime = DeltaTimer.getTimestamp();
        this.delta = this.currentTime - this.lastUpdate;
        this.lastUpdate = this.currentTime;

        return this.delta;
    };

    static getTimestamp(): number {
        return Date.now();
    }
}