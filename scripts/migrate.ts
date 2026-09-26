import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";

loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = neon(url);
async function main() {
  const migrationDir = resolve("db/migrations");
  const files = (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort();
  let statementCount = 0;
  for (const file of files) {
    const migration = await readFile(resolve(migrationDir, file), "utf8");
    const statements = migration.split(/;\s*(?:\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await sql.query(statement);
    statementCount += statements.length;
  }
  console.log(`Applied ${statementCount} migration statements from ${files.length} migration files.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
