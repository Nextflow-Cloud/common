import { Document, Filter, OptionalId } from "mongodb";
import DatabaseSchema from "./DatabaseSchema";

class DatabaseCache {
    // LRU = Least Recently Used
    values: Document[] = []; // :D
    maxEntries: number;
    schema: DatabaseSchema;
    constructor(schema: DatabaseSchema, maxEntries = 20) {
        this.maxEntries = maxEntries;
        this.schema = schema;
    }
    async get(query: Filter<Document>) {
        const obj = this.values.find(value => Object.keys(value).map(k => query[k] === value[k]).every(v => v));
        if (obj) {
          this.values.push(obj);
          if (this.values.length > this.maxEntries) {
            this.values.shift();
          }
          return obj;
        } else {
            const document = await this.schema.findOne(query);
            if (document) this.values.push(document);
            if (this.values.length > this.maxEntries) {
              this.values.shift();
            }
            return document;
        }
    }
    async getAll() {
      // getAll just calls schema.find()
        return await this.schema.find({});
    }
    async set(value: OptionalId<Document>) {
        // set is like schema.create(object)
        const document = await this.schema.create(value);
        if (document) this.values.push(document);
        if (this.values.length > this.maxEntries) {
            this.values.shift();
        }
        return document;
    }
    async update(query: Filter<Document>, value: OptionalId<Document>) {
        // update is like schema.findOneAndUpdate(query, value)
        const document = await this.schema.findOneAndUpdate(query, value);
        if (document) this.values.push(document);
        if (this.values.length > this.maxEntries) {
            this.values.shift();
        }
        return document;
    }
    async delete(query: Document) {
        const document = await this.schema.findOneAndDelete(query);
        this.values = this.values.filter(value => Object.keys(value).map(k => query[k] === value[k]).every(v => v));
        return document;
    }
}
  
export default DatabaseCache;
