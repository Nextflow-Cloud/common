import { Document, Filter, MatchKeysAndValues, OptionalId } from "mongodb";
import Database from "./Database";
import DatabaseError from "./DatabaseError";

class DatabaseSchema {
    collection: string;
    schema: Record<string, any>;
    client?: Database;
    constructor(collection: string, objTypes: Record<string, any>, database = Database.globalClient) {
        this.client = database;
        this.collection = collection;
        this.schema = objTypes;
    }

    async create(object: OptionalId<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new DatabaseError('No database connection');
        return await this.parse(object).then(() => {
            return this.insertOne(object);
        }).catch(e => {
            throw e;
        });
    }
    async findOne(query: Filter<Document>) { 
        if (!this.client) this.client = Database.globalClient;
        if (!this.client) throw new Error('No database connection');
        return await this.client.database?.collection(this.collection).findOne(query);
    }
    async findOneAndUpdate(query: Filter<Document>, update: MatchKeysAndValues<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error('No database connection');
        await this.parse(update);
        return await this.client.database?.collection(this.collection).findOneAndUpdate(query, { $set: update });
    }
    async findOneAndDelete(query: Filter<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error('No database connection');
        this.client.database?.collection(this.collection).findOneAndDelete(query);
    }
    async find(query: Filter<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error('No database connection');
        const arr = await this.client.database?.collection(this.collection).find(query).toArray();
        return arr;
    }
    async insertOne(obj: OptionalId<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error('No database connection');
        await this.parse(obj);
        return await this.client.database?.collection(this.collection).insertOne(obj);
    }
    async insertMany(obj: OptionalId<Document>[]) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error('No database connection');
        await Promise.all(obj.map(i => this.parse(i)));
        return await this.client.database?.collection(this.collection).insertMany(obj);
    }
    // async updateOne(query, update) {
    // }
    // async updateMany(query, update) {
    // }
    async deleteOne(query: Filter<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error('No database connection');
        return await this.client.database?.collection(this.collection).deleteOne(query);
    }
    async deleteMany(query: Filter<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error('No database connection');
        return await this.client.database?.collection(this.collection).deleteMany(query);
    }
    // findAndModify ? 
    // https://docs.mongodb.com/manual/reference/method/js-collection/
    parse(obj: OptionalId<Document>) {
        return new Promise<boolean>((resolve, reject) => {
            Object.keys(obj).forEach(key => {
                if (!this.schema[key]) {
                    reject(new DatabaseError('Invalid property: ' + key));
                }
                if (this.schema[key].name !== obj[key].constructor.name) {
                    reject(new DatabaseError('Invalid type for property: ' + key));
                }
                if (this.schema[key].name === "String" && obj[key].length > this.schema[key].maxLength) {
                    reject(new DatabaseError('Invalid length for property: ' + key));
                }
                if (this.schema[key].name === "Number" && obj[key] > this.schema[key].max) {
                    reject(new DatabaseError('Invalid value for property: ' + key));
                } 
                if (this.schema[key].name === "Number" && obj[key] < this.schema[key].min) {
                    reject(new DatabaseError('Invalid value for property: ' + key));
                }
                resolve(true);
            }); 
        });
    }
}

export default DatabaseSchema;
