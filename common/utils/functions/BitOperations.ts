export function byteSize(num: number) {
    return Math.ceil(num.toString(2).length / 8);
}

export function setBit(val: number, bitIndex: number): number {
    val |= (1 << bitIndex);
    return val;
}