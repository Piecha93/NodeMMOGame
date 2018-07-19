export function maskByteSize(num: number) {
    return Math.ceil(num / 8);
}

export function setBit(val: number, bitIndex: number): number {
    val |= (1 << bitIndex);
    return val;
}