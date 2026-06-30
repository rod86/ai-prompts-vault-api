import process from "node:process";
import path from "node:path";

process.loadEnvFile(path.join(import.meta.dirname, '..', '.env'));

export default {
    port: process.env.PORT ?? 3000,
    environment: process.env.ENVIRONMENT ?? 'development',
}