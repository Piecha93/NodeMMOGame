export class DeltaTimer {
    private currentTime: number;
    private delta: number;
    private lastUpdate: number = new Date().getTime();


    public getDelta(): number {
        this.currentTime = new Date().getTime();
        this.delta = this.currentTime - this.lastUpdate;
        this.lastUpdate = this.currentTime;

        return this.delta;
    };
}