import * as mongoose from "mongoose";
import {Connection, Model, Schema} from "mongoose";
import {IUser} from "./models/User";

let url = "mongodb://test:test@ds129352.mlab.com:29352/node-mmo-game";
// let url = "mongodb://localhost:27017";

interface IUserModel extends IUser, mongoose.Document { }

export class Database {
    private connection: Connection;

    private userModel: Model<IUserModel>;

    constructor() {
        this.connection = mongoose.createConnection(url);
        this.connection.on('error', console.error.bind(console, 'connection error:'));

        this.connection.once('open', () => {
            console.log("Connected to database");
        });

        let userSchema = new mongoose.Schema({
            password: String,
            username: String
        });

        this.userModel = this.connection.model<IUserModel>("User", userSchema);
    }

    findUser(username: string, callback: Function) {
        this.userModel.findOne({username: username}, (err, docs) => {
            callback(docs);
        })
    }

    get DB(): Connection {
        return this.connection;
    }
}


