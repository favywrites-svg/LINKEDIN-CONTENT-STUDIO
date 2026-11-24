import postgres, { type Sql } from "postgres";
import { getEffectiveEnv } from "@/lib/env-store";

declare global {
  var __lcaPgClient: Sql | undefined;
  var __lcaPgSchemaReady: boolean | undefined;
}

export function getConfiguredPostgresUrl(
  env: Record<string, string | undefined> = getEffectiveEnv()
): string | null {
  const url = env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim() || "";
  if (!url || url.includes("USER:PASSWORD@HOST")) {
    return null;
  }
  return url;
}

function getPgClient(connectionUrl: string): Sql {
  if (!globalThis.__lcaPgClient) {
    globalThis.__lcaPgClient = postgres(connectionUrl, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: connectionUrl.includes("localhost") ? false : "require",
    });
  }
  return globalThis.__lcaPgClient;
}

async function ensurePgTable(sql: Sql): Promise<void> {
  if (globalThis.__lcaPgSchemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS lca_workspace_tables (
      table_name TEXT PRIMARY KEY,
      rows_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  globalThis.__lcaPgSchemaReady = true;
}

export async function loadTablesFromPostgres(
  connectionUrl: string
): Promise<Record<string, Array<Record<string, unknown>>> | null> {
  const sql = getPgClient(connectionUrl);
  await ensurePgTable(sql);

  const records = await sql<
    Array<{ table_name: string; rows_json: Array<Record<string, unknown>> }>
  >`SELECT table_name, rows_json FROM lca_workspace_tables`;

  if (records.length === 0) {
    return null;
  }

  const out: Record<string, Array<Record<string, unknown>>> = {};
  for (const rec of records) {
    out[rec.table_name] = Array.isArray(rec.rows_json)
      ? rec.rows_json
      : JSON.parse(String(rec.rows_json));
  }
  return out;
}

export async function saveTablesToPostgres(
  connectionUrl: string,
  tables: Record<string, Array<Record<string, unknown>>>
): Promise<void> {
  const sql = getPgClient(connectionUrl);
  await ensurePgTable(sql);

  await sql.begin(async (tx) => {
    for (const [tableName, rows] of Object.entries(tables)) {
      await tx.unsafe(
        `INSERT INTO lca_workspace_tables (table_name, rows_json, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (table_name) DO UPDATE
         SET rows_json = EXCLUDED.rows_json, updated_at = NOW()`,
        [tableName, JSON.stringify(rows)]
      );
    }
  });
}
