import { defineConfig } from "drizzle-kit";

/**
 * Resolves the drizzle-kit connection URL with the same precedence as the
 * runtime server (server/db.ts): DATABASE_URL first, then DB_* variables.
 * This keeps `drizzle-kit push` and the running application pointed at the
 * same database no matter which configuration style a deployment uses.
 */
function resolveUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  if (DB_HOST || DB_NAME || DB_USER) {
    const user = encodeURIComponent(DB_USER || "postgres");
    const password = encodeURIComponent(DB_PASSWORD || "");
    const host = DB_HOST || "localhost";
    const port = DB_PORT || "5432";
    const database = DB_NAME || "integral_project_hub";
    return `postgres://${user}:${password}@${host}:${port}/${database}`;
  }

  throw new Error(
    "Database not configured. Set DATABASE_URL (or the DB_* variables) in .env — see .env.example."
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveUrl(),
  },
});
