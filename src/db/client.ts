import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema.ts";

export interface DatabaseHandle {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sql: SQL;
  close: () => Promise<void>;
}

export function createDb(url: string): DatabaseHandle {
  const sql = new SQL(url, { max: 10 });
  const db = drizzle(sql, { schema });

  return {
    db,
    sql,
    close: async () => {
      await sql.close();
    },
  };
}

export type Database = DatabaseHandle["db"];
