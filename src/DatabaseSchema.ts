import { Document, Filter, OptionalId, UpdateFilter, WithoutId } from "mongodb";
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

    /**
     * Alias for insertOne().
     */
    async create(object: OptionalId<Document>) {
        return await this.insertOne(object);
    }
    /**
     * Alias for updateOne().
     */
    async update(query: Filter<Document>, update: UpdateFilter<Document>) {
        return await this.updateOne(query, update);
    }
    /**
     * Alias for deleteOne().
     */
    async delete(query: Filter<Document>) {
        return await this.deleteOne(query);
    }

    async updateBase(query: Document) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client) throw new Error("No database connection");
        const filter: Filter<Document> = {};
        for (const key of Object.keys(query).filter(i => !i.startsWith("$"))) {
            filter[key] = query[key];
        }
        const update: UpdateFilter<Document> = {};
        for (const key of Object.keys(query).filter(i => i.startsWith("$"))) {
            update[key] = query[key];
        }
        return await this.client.database?.collection(this.collection).findOneAndUpdate(filter, update);
    }

    async find(query: Filter<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error("No database connection");
        const arr = await this.client.database?.collection(this.collection).find(query).toArray();
        return arr;
    }
    async findLimit(query: Filter<Document>, limit: number) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error("No database connection");
        return await this.client.database?.collection(this.collection).find(query).limit(limit).toArray();
    }
    async findOne(query: Filter<Document>) { 
        if (!this.client) this.client = Database.globalClient;
        if (!this.client) throw new Error("No database connection");
        return await this.client.database?.collection(this.collection).findOne(query);
    }
    async findOneAndDelete(query: Filter<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error("No database connection");
        return await this.client.database?.collection(this.collection).findOneAndDelete(query);
    }
    async findOneAndReplace(query: Filter<Document>, update: WithoutId<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error("No database connection");
        this.parse(update);
        return await this.client.database?.collection(this.collection).findOneAndReplace(query, { $set: update });
    }
    async findOneAndUpdate(query: Filter<Document>, update: UpdateFilter<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error("No database connection");
        this.parse(update);
        return await this.client.database?.collection(this.collection).findOneAndUpdate(query, { $set: update });
    }
    
    async insertOne(object: OptionalId<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error("No database connection");
        this.parse(object);
        return await this.client.database?.collection(this.collection).insertOne(object);
    }
    async insertMany(obj: OptionalId<Document>[]) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error("No database connection");
        await Promise.all(obj.map(i => this.parse(i)));
        return await this.client.database?.collection(this.collection).insertMany(obj);
    }
    async replaceOne(query: Filter<Document>, update: WithoutId<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error("No database connection");
        this.parse(update);
        return await this.client.database?.collection(this.collection).replaceOne(query, { $set: update });
    }
    async updateOne(query: Filter<Document>, update: UpdateFilter<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error("No database connection");
        this.parse(update);
        return await this.client.database?.collection(this.collection).updateOne(query, { $set: update });
    }
    async updateMany(query: Filter<Document>, update: UpdateFilter<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error("No database connection");
        this.parse(update);
        return await this.client.database?.collection(this.collection).updateMany(query, { $set: update });
    }
    async deleteOne(query: Filter<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error("No database connection");
        return await this.client.database?.collection(this.collection).deleteOne(query);
    }
    async deleteMany(query: Filter<Document>) {
        if (!this.client) this.client = Database.globalClient;
        if (!this.client?.connected) throw new Error("No database connection");
        return await this.client.database?.collection(this.collection).deleteMany(query);
    }
    
    parse(obj: Document) {
        Object.keys(obj).map(key => {
            if (!this.schema[key]) {
                throw new DatabaseError("Invalid property: " + key);
            }
            if (typeof this.schema[key] === "object") {
                if (!this.schema[key].type) {
                    throw new DatabaseError("Invalid property: " + key);
                }
                if (this.schema[key].type.name !== obj[key].constructor.name) {
                    throw new DatabaseError("Invalid type for property: " + key);
                }
                if (this.schema[key].type.name === "String" && this.schema[key].regex && !obj[key].match(this.schema[key].regex)) {
                    throw new DatabaseError("Invalid value for property: " + key);
                }
                if (this.schema[key].type.name === "String" && obj[key].length > this.schema[key].maxLength) {
                    throw new DatabaseError("Invalid length for property: " + key);
                }
                if (this.schema[key].type.name === "Number" && obj[key] > this.schema[key].max) {
                    throw new DatabaseError("Invalid value for property: " + key);
                } 
                if (this.schema[key].type.name === "Number" && obj[key] < this.schema[key].min) {
                    throw new DatabaseError("Invalid value for property: " + key);
                }
                if (this.schema[key].required && !obj[key]) {
                    throw new DatabaseError("Required property: " + key);
                }
                if (this.schema[key].default instanceof this.schema[key].type && !obj[key]) {
                    obj[key] = this.schema[key].default;
                }
            } else {
                if (this.schema[key].name !== obj[key].constructor.name) {
                    throw new DatabaseError("Invalid type for property: " + key);
                }
            }
        });
    }
}

export default DatabaseSchema;
