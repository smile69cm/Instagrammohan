import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

let dbUrl = process.env.DATABASE_URL;
const urlMatch = dbUrl.match(/postgresql:\/\/[^\s"]+/);
if (urlMatch) {
  dbUrl = urlMatch[0];
}

const sql = neon(dbUrl);
export const db = drizzle(sql, { schema });
