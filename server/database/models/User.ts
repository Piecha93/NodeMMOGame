export interface IUser {
    username: string;
    passwordHash?: string;
    /** Read only during migration; successful authentication removes this field. */
    password?: string;
}
