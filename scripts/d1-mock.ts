/**
 * Minimal D1Database adapter over Node 22's node:sqlite — lets the real Hono
 * app run in-process for integration tests without wrangler/miniflare.
 * Implements the subset of the D1 API the app uses: prepare().bind().first/
 * all/run() and DB.batch().
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

class Stmt {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private args: unknown[] = [],
  ) {}
  bind(...args: unknown[]): Stmt {
    return new Stmt(this.db, this.sql, args);
  }
  async first<T = unknown>(): Promise<T | null> {
    const s = this.db.prepare(this.sql);
    const row = s.get(...(this.args as never[]));
    return (row as T) ?? null;
  }
  async all<T = unknown>(): Promise<{ results: T[] }> {
    const s = this.db.prepare(this.sql);
    const rows = s.all(...(this.args as never[]));
    return { results: rows as T[] };
  }
  async run(): Promise<{ meta: { changes: number } }> {
    const s = this.db.prepare(this.sql);
    const info = s.run(...(this.args as never[]));
    return { meta: { changes: Number(info.changes) || 0 } };
  }
}

export class D1Mock {
  constructor(private db: DatabaseSync) {}
  prepare(sql: string): Stmt {
    return new Stmt(this.db, sql);
  }
  async batch(stmts: Stmt[]): Promise<unknown[]> {
    const out: unknown[] = [];
    for (const s of stmts) out.push(await s.run());
    return out;
  }
}

export function makeTestDb(migrationsDir: string): D1Mock {
  const db = new DatabaseSync(":memory:");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    // node:sqlite's exec() runs all statements in the string. ALTER TABLE ADD
    // COLUMN has no IF NOT EXISTS, so tolerate duplicate-column when a suite
    // re-applies migrations; split only as a fallback for that case.
    try {
      db.exec(sql);
    } catch (e) {
      if (!/duplicate column|already exists/.test(String(e))) {
        // run statement-by-statement to isolate the tolerable ones
        for (const stmt of sql.split(/;\s*(?:\n|$)/)) {
          const t = stmt.trim();
          if (!t || t.startsWith("--")) continue;
          try {
            db.exec(t);
          } catch (e2) {
            if (!/duplicate column|already exists/.test(String(e2))) {
              throw new Error(`migration ${f}: ${String(e2)}\n${t.slice(0, 120)}`);
            }
          }
        }
      }
    }
  }
  return new D1Mock(db);
}
