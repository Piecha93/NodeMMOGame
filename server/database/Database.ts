import mongoose, {Connection, Model} from "mongoose";

import {ServerConfig} from "../ServerConfig";
import {IItem} from "./models/Item";
import {IUser} from "./models/User";

export interface IUserModel extends IUser, mongoose.Document {}
export interface IItemModel extends IItem, mongoose.Document {}

export class Database {
    private connection?: Connection;
    private userModel?: Model<IUserModel>;

    private constructor() {
        if (!ServerConfig.DATABASE_URL) {
            console.warn("MONGODB_URI is not set; registered-user login is disabled. Guest login remains available.");
            return;
        }

        this.connection = mongoose.createConnection(ServerConfig.DATABASE_URL, {
            serverSelectionTimeoutMS: 5000,
        });
        this.connection.on("error", (error) => {
            console.error("Database connection error:", error.message);
        });
        this.connection.once("open", () => {
            console.log("Connected to database");
        });

        const userSchema = new mongoose.Schema<IUserModel>({
            password: String,
            username: {type: String, index: {unique: true}},
        });

        this.userModel = this.connection.model<IUserModel>("User", userSchema);
    }

    async findUserByName(username: string): Promise<IUserModel | null> {
        if (!this.userModel) {
            return null;
        }

        return this.userModel.findOne({username}).exec();
    }

    async findUserById(id: string): Promise<IUserModel | null> {
        if (!this.userModel) {
            return null;
        }

        return this.userModel.findById(id).exec();
    }

    get DB(): Connection | undefined {
        return this.connection;
    }

    private static instance: Database;

    static get Instance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }

        return Database.instance;
    }
}
