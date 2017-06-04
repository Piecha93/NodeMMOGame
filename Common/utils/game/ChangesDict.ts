export class ChangesDict {
    //GameObject
    public static VELOCITY = 'V';
    public static SPRITE = 'S';
    public static POSITION = 'P';

    //Player
    public static HP = 'H';
    public static NAME = 'N';

    //Bullet
    public static LIFE_SPAN = 'L';
    public static DIRECTION_ANGLE = 'A';


    public static buildTag(char: string) {
        return '#' + char + ':';
    }
}