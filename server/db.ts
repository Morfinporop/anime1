// Подключение к PostgreSQL + авто-инициализация схемы
import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

export const pool: Pool | null = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('[db.error]', err.message);
  });
}

// Корректное разделение SQL на отдельные statements (поддержка $$ DO блоков)
function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let inSingleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      current += ch;
      continue;
    }
    if (ch === '-' && next === '-') { inLineComment = true; current += ch; continue; }

    if (ch === '$' && sql.substr(i, 2) === '$$') {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i++;
      continue;
    }

    if (ch === "'" && !inDollarQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (ch === ';' && !inDollarQuote && !inSingleQuote) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = '';
      continue;
    }

    current += ch;
  }

  const last = current.trim();
  if (last) statements.push(last);
  return statements;
}

export async function initDatabase() {
  if (!DATABASE_URL || !pool) {
    console.warn('[db] DATABASE_URL не задан — пропускаю инициализацию БД');
    return false;
  }

  const schemaPath = join(process.cwd(), 'server', 'schema.sql');
  let schema: string;
  try {
    schema = readFileSync(schemaPath, 'utf-8');
  } catch (err: any) {
    console.error('[db] Не удалось прочитать schema.sql:', err.message);
    return false;
  }

  const statements = splitSQLStatements(schema);
  console.log(`[db] Выполняю ${statements.length} SQL statements...`);

  let ok = 0;
  let skipped = 0;

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      ok++;
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('already exists')) { skipped++; continue; }
      console.error(`[db.error] ${msg.slice(0, 200)}`);
      skipped++;
    }
  }

  console.log(`[db] ✓ Схема: ${ok} OK, ${skipped} skipped`);
  return true;
}

export async function query(text: string, params?: any[]) {
  if (!pool) throw new Error('Database not configured');
  return pool.query(text, params);
}

export async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  if (!pool) throw new Error('Database not configured');
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}