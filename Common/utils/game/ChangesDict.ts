export class ChangesDict {
    //GameObject
    public static VELOCITY = 'V';
    public static SPRITE = 'S';
    public static POSITION = 'P';
    public static SIZE = 'Z';

    //Player
    public static HP = 'H';
    public static MAX_HP = 'M';
    public static NAME = 'N';

    //Bullet
    public static LIFE_SPAN = 'L';
    public static ROTATION = 'R';
    public static OWNER = 'O';


    public static buildTag(char: string) {
        return '#' + char + ':';
    }
}