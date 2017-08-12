import * as mongoose from "mongoose";
import {Connection} from "mongoose";

let url = "mongodb://test:test@ds129352.mlab.com:29352/node-mmo-game";
// let url = "mongodb://localhost:27017";

export class Database {
    private db: Connection;

    constructor() {
        this.db = mongoose.createConnection(url);
        this.db.on('error', console.error.bind(console, 'connection error:'));

        this.db.once('open', () => {
            console.log("Connected to database");
        });

        // this.mongoClient.connect(url, (err, db) => {
        //     console.log("bbb");
        //     if (err) throw err;
        //     this.connection = db;
        //
        //     this.connection.createCollection("users", (err, res) => {
        //         if (err) throw err;
        //     });
        //
        //     this.connection.createCollection("items", (err, res) => {
        //         if (err) throw err;
        //     });
        //     console.log("aaa");
        //     console.log(this.connection.serverConfig);
        // });
    }

    //insertUser(name: string, password: string) {
    //     let user = { name: name, password: password};
    //     this.connection.collection("users").insertOne(user, (err, res) => {
    //         if (err) throw err;
    //         console.log("user added to database");
    //     });
    // }
    //
    // findUser(name: string) {
    //         this.connection.collection("users").findOne({}, (err, result) => {
    //             if (err) throw err;
    //             console.log(result);
    //         });
    // }
    //
    get DB(): Connection {
        return this.db;
    }
}


