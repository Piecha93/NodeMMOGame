export class Types {
    // static IdToClass: Map<string, string>;
    // static ClassToId: Map<string, string>;

    static ClassToId = new Map<string, string>([
            ["Player", "P"],
            ["Enemy", "E"],
            ["Bullet", "B"],
            ["Obstacle", "O"],
        ]);

    static IdToClass = Types.reverseMap(Types.ClassToId);

    private static reverseMap<T, R>(map: Map<T, R>) {
        let reverseMap: Map<R, T> = new Map<R, T>();
        map.forEach((val: R, key: T) => {
            reverseMap.set(val, key);
        });

        return reverseMap;
    }
}