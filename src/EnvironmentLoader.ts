import { readFileSync } from "fs";

const loadEnvironment = (file: string) => {
    const env = readFileSync(file, "utf8");
    const lines = env.split("\n");
    const result = lines.map(l => {
        const [key, ...v] = l.split("=");
        const value = v.join("=");
        return [key, value];
    }).reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
    }, {} as Record<string, string>) as { [key: string]: string };
    return result;
};

class EnvironmentLoader {
    static load(file: string, values: string[]) {
        const load = loadEnvironment(file);
        const environmentValues = Object.entries(process.env).filter(([key]) => values.includes(key)).reduce((acc, [key, value]) => {
            if (value) acc[key] = value;
            return acc;
        }, {} as Record<string, string>) as { [key: string]: string };
        const loadedValues = Object.entries(load).filter(([key]) => values.includes(key)).reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {} as Record<string, string>) as { [key: string]: string };
        const finalValues = values.reduce((acc, k) => {
            acc[k] = environmentValues[k] || loadedValues[k];
            return acc;
        }, {} as Record<string, string>) as { [key: string]: string };
        return finalValues;
    }
}

export default EnvironmentLoader;
