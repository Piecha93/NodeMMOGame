export function getUTF8Size(value: string): number {
    return new TextEncoder().encode(value).byteLength;
}
