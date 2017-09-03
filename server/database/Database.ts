import * as mongoose from "mongoose";
import {Connection, Model, Schema} from "mongoose";
import {IUser} from "./models/User";
import {IItem} from "./models/Item";
import {ServerConfig} from "../ServerConfig";

// let url = "mongodb://localhost:27017";

export interface IUserModel extends IUser, mongoose.Document { }
export interface IItemModel extends IItem, mongoose.Document { }

export class Database {
    private connection: Connection;
    private userModel: Model<IUserModel>;
    private url: string = ServerConfig.DATABASE_URL;

    private constructor() {
        this.connection = mongoose.createConnection(this.url);
        this.connection.on('error', console.error.bind(console, 'connection error:'));

        this.connection.once('open', () => {
            console.log("Connected to database");
        });

        let userSchema = new mongoose.Schema({
            'password': String,
            'username': { type: String, index: { unique: true } },
        });

        this.userModel = this.connection.model<IUserModel>("User", userSchema);
    }

    findUserByName(username: string, callback: Function) {
        this.userModel.findOne({username: username}, (err, docs) => {
            callback(docs);
        })
    }

    findUserById(id: string, callback: Function) {
        this.userModel.findOne({_id: id}, (err, docs) => {
            callback(docs);
        })
    }

    get DB(): Connection {
        return this.connection;
    }

    private static instance: Database;

    static get Instance(): Database {
        if(Database.instance) {
            return Database.instance;
        } else {
            Database.instance = new Database;
            return Database.instance;
        }
    }
}