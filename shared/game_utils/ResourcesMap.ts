
export class ResourcesMap {
    static NameToId: Map<string, number> = new Map<string, number>();

    static IdToName: Map<number, string> = new Map<number, string>();

    private static shortIdCounter: number = 0;

    static RegisterResource(name: string) {
        ResourcesMap.NameToId.set(name, this.shortIdCounter);
        ResourcesMap.IdToName.set(this.shortIdCounter++, name);
    }
}

ResourcesMap.RegisterResource('none');
ResourcesMap.RegisterResource('wall');
ResourcesMap.RegisterResource('bunny');
ResourcesMap.RegisterResource('dyzma');
ResourcesMap.RegisterResource('kamis');
ResourcesMap.RegisterResource('michau');
ResourcesMap.RegisterResource('panda');
ResourcesMap.RegisterResource('bullet');
ResourcesMap.RegisterResource('fireball');
ResourcesMap.RegisterResource('bluebolt');
ResourcesMap.RegisterResource('hp_potion');
ResourcesMap.RegisterResource('portal');
ResourcesMap.RegisterResource('white');
ResourcesMap.RegisterResource('flame');
ResourcesMap.RegisterResource('template');
ResourcesMap.RegisterResource('terrain');
ResourcesMap.RegisterResource('doors_closed');
ResourcesMap.RegisterResource('doors_open');
