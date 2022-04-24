class EnvironmentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EnvironmentError";
    }
}

export default EnvironmentError;
