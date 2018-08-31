export class AverageCounter {
    private history: Array<number> = [];
    readonly historyMaxSize: number;

    constructor(historySize: number) {
        this.historyMaxSize = historySize;
    }

    add(val: number) {
        this.history.push(val);
        while(this.history.length > this.historyMaxSize) this.history.splice(0, 1);
    }

    calculate(val?: number): number {
        if(val) {
            this.add(val);
        }
        let avg: number = 0;
        this.history.forEach((val: number) => {
            avg += val;
        });
        avg /= this.history.length;

        return avg;
    }
}