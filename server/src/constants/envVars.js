import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const DB_ENV = process.env.DB_ENV;
export const TOKEN = process.env.TOKEN;
export const DB_USER = process.env.DB_USER;
export const DB_PASS = process.env.DB_PASS;
export const URI = process.env.URI;
