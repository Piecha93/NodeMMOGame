export class AverageCounter {
    private history: Array<number> = [];
    private historySize: number;

    constructor(historySize: number) {
        this.historySize = historySize;
    }

    add(val: number) {
        this.history.push(val);
        if(this.history.length > 30) this.history.splice(0, 1);
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