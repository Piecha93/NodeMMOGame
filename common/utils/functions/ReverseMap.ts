export function reverseMap<T, R>(map: Map<T, R>) {
    let reverseMap: Map<R, T> = new Map<R, T>();
    map.forEach((val: R, key: T) => {
        reverseMap.set(val, key);
    });

    return reverseMap;
}