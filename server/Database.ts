import {Db, MongoClient} from "mongodb";

let url = "mongodb://localhost:27017/mydb";


export class Database {
    private mongoClient: MongoClient = new MongoClient;
    private db: Db;

    constructor() {
        this.mongoClient.connect(url, (err, db) => {
            if (err) throw err;
            this.db = db;

            this.db.createCollection("users", (err, res) => {
                if (err) throw err;
            });

            this.db.createCollection("items", (err, res) => {
                if (err) throw err;
            });
        });
    }

    insertUser(name: string, password: string) {
        let user = { name: name, password: password};
        this.db.collection("users").insertOne(user, (err, res) => {
            if (err) throw err;
            console.log("user added to database");
        });
    }

    findUser(name: string) {
            this.db.collection("users").findOne({}, (err, result) => {
                if (err) throw err;
                console.log(result);
            });
    }

}


