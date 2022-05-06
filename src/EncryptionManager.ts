import crypto from "crypto";
import { createReadStream, createWriteStream } from "fs";

import { gzipSync, unzipSync } from "zlib";
import { unlink } from "fs/promises";
import { pipeline } from "stream/promises";

import bcrypt from "bcrypt";
import { encode, decode } from "@msgpack/msgpack";

class EncryptionManager {
    constructor(private KEY: Buffer, private PUBLIC_KEY: string, private PRIVATE_KEY: string) {}

    static generateKeySet() {
        const key = this.generateAESKey();
        const keys = this.generateRSAKeys();
        return {
            key: key,
            publicKey: keys.publicKey,
            privateKey: keys.privateKey
        };
    }

    // Bcrypt functions
    async verifyPassword(password: string, passwordHash: string) {
        return await bcrypt.compare(password, passwordHash);
    }
    async hashPassword(password: string, salt?: string) {
        return await bcrypt.hash(password, salt || await bcrypt.genSalt(10));
    }

    // RSA functions
    static generateRSAKeys(nBit: number = 2048) {
        const keys = crypto.generateKeyPairSync("rsa", {
            modulusLength: nBit,
            publicKeyEncoding: {
                type: "spki",
                format: "pem"
            },
            privateKeyEncoding: {
                type: "pkcs8",
                format: "pem"
            }
        });
        return {
            publicKey: keys.publicKey,
            privateKey: keys.privateKey
        };
    }

    encryptRSA(input: Buffer, padding: number = 4, publicKey: string = this.PUBLIC_KEY) { // 11
        const cipherText = crypto.publicEncrypt({ key: publicKey, padding }, input);
        return cipherText;
    }
    decryptRSA(input: Buffer, padding: number = 4, privateKey: string = this.PRIVATE_KEY) { // 11
        const decrypted = crypto.privateDecrypt({ key: privateKey, padding }, input);
        return decrypted;
    }
    sign(data: Buffer, privateKey: string = this.PRIVATE_KEY) {
        return crypto.sign("RSA-SHA256", data, privateKey);
    }
    verify(data: Buffer, signature: Buffer, publicKey: string = this.PUBLIC_KEY) {
        return crypto.verify("RSA-SHA256", data, publicKey, signature);
    }
    
    // AES functions
    static generateAESKey(nBlock: number = 32) {
        return crypto.randomBytes(nBlock);
    }
    static keyFromPassword(password: string) {
        return crypto.createHash("sha256").update(password).digest();
    }

    encrypt(data: Buffer, key: Buffer = this.KEY) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
        const ciphered = Buffer.concat([iv, cipher.update(data), cipher.final()]);
        return ciphered.toString("base64");
    }
    decrypt(data: Buffer, key: Buffer = this.KEY) {
        const iv = data.slice(0, 16);
        const dataMessage = data.slice(16);
        const cipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
        const ciphered = Buffer.concat([cipher.update(dataMessage), cipher.final()]);
        return ciphered;
    } 
    async encryptFile(fileName: string, key: Buffer = this.KEY) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
        const input = createReadStream(fileName);
        const output = createWriteStream(`${fileName}.encrypted`);
        output.write(iv);
        await pipeline(input, cipher, output);
        return unlink(fileName);
    }
    async decryptFile(fileName: string, key: Buffer = this.KEY) {
        return await new Promise<void>(resolve => {
            const input = createReadStream(`${fileName}.encrypted`, { highWaterMark: 16 });
            input.once("data", async iv => {
                const cipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
                const output = createWriteStream(fileName);
                await pipeline(input, cipher, output);
                resolve(await unlink(`${fileName}.encrypted`));
            });
        });
    }

    // MessagePack functions
    pack(data: unknown) {
        return encode(data);
    }
    unpack(data: Buffer) {
        return decode(data);
    }

    // Gzip functions
    zip(data: Buffer) {
        return gzipSync(data, { level: 9 });
    }
    unzip(data: Buffer) {
        return unzipSync(data);
    }

    // Processing functions
    serializeWebSocketData(data: unknown) {
        const packedData = this.pack(data); // 1. MessagePack
        const encryptedData = this.encrypt(Buffer.from(packedData)); // 2. Encrypt
        const signedData = this.sign(Buffer.from(encryptedData)); // 3. Sign
        const zippedData = this.zip(Buffer.concat([Buffer.from(encryptedData), Buffer.from(signedData)]));
        return zippedData; // 4. Combine
        // This way we have a secure system and we are going to be sending raw binary over the RPC system
        // Web Socket supports binary data, so this will be fine without another step to encode in Base 64
    }
    deserializeWebSocketData(data: Buffer): unknown | null {
        try {
            const unzippedData = this.unzip(data);
            const signedData = unzippedData.slice(unzippedData.length - 64);
            const encryptedData = unzippedData.slice(0, unzippedData.length - 64);
            const verified = this.verify(Buffer.from(encryptedData), signedData);
            // if (!verified) throw new Error("Invalid signature");
            if (!verified) return null;
            const decryptedData = this.decrypt(encryptedData);
            const unpackedData = this.unpack(decryptedData);
            return unpackedData;
        } catch(e) {
            // throw new Error("Invalid data");
            return null;
        }
    }

    // Generation functions
    random(length = 8, chars = "ABCDEFGHKLMNPQRSTVWYZ23456789") {
        let str = "";
        for (let i = 0; i < length; i++) str += chars[crypto.randomInt(chars.length)];
        return str;
    }
    generateKey() {
        const chars = "ABCDEFGHKLMNPQRSTVWYZ23456789"; 
        let key = "";
        for (let i = 0; i <= 4; i++) {
            for (let j = 0; j <= 4; j++) {
                key += chars[crypto.randomInt(chars.length)];
            }
            key += "-";
        }
        const arr = Array.from(key);
        arr.pop();
        key = arr.join("");
        return key;
    }
    generateBackupCodes() {
        const chars = "abcdefghijklmnopqrstuvwxyz1234567890";
        let backup = "";
        for (let i = 0; i < 10; i++) {
            backup += chars[crypto.randomInt(chars.length)];
        }
        return backup;
    }
    async generateToken(randomness: string) { 
        const hash = Buffer.from(await this.hashPassword(crypto.randomUUID()) + await this.hashPassword(randomness) + await this.hashPassword(crypto.randomUUID()), "utf-8").toString("hex");
        const final = crypto.randomUUID() + `-${hash}-` + crypto.randomUUID();
        return final;
    }
}

export default EncryptionManager;
