import { Db, MongoClient } from "mongodb";
import EventEmitter from "events";
import DatabaseError from "./DatabaseError";

class Database extends EventEmitter {
    client: MongoClient;
    databaseName: string;
    connected = false;
    database?: Db;
    static globalClient?: Database;
    constructor(uri: string, database: string) {
        super();
        this.client = new MongoClient(uri);
        this.databaseName = database;
    }

    async connect() {
        await this.client.connect().catch(e => {
            throw new DatabaseError("Failed to connect to the database - server timed out or invalid URI. " + e);
        });
        Database.globalClient = this;
        this.database = this.client.db(this.databaseName);
        this.connected = true;
        this.emit("connected");
    }
}

export default Database;
