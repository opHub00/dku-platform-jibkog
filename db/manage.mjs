import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

export async function manage(client, command) {
  if (!['migrate', 'seed'].includes(command)) throw new Error('Expected migrate or seed');
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('jibkog.db.migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)');
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map(row => row.name));
    const migrations = readdirSync(new URL('./migrations/', import.meta.url)).filter(n => n.endsWith('.sql')).sort();
    for (const name of migrations) {
      if (applied.has(name)) continue;
      await client.query(read('./migrations/' + name));
      await client.query('INSERT INTO schema_migrations VALUES ($1)', [name]);
    }
    if (command === 'seed') await seed(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function seed(client) {
  await client.query('CREATE TABLE IF NOT EXISTS dev_seeds (name TEXT PRIMARY KEY)');
  const applied = await client.query("SELECT 1 FROM dev_seeds WHERE name = 'demo-v1'");
  if (applied.rowCount) return;
  const tables = await client.query(`SELECT quote_ident(schemaname) || '.' || quote_ident(tablename) AS name
    FROM pg_tables WHERE schemaname = current_schema()
    AND tablename NOT IN ('schema_migrations','dev_seeds') ORDER BY tablename`);
  for (const { name } of tables.rows) {
    await client.query('LOCK TABLE ' + name + ' IN SHARE ROW EXCLUSIVE MODE');
    if ((await client.query('SELECT 1 FROM ' + name + ' LIMIT 1')).rowCount) {
      throw new Error('Demo seed requires an empty database');
    }
  }
  await client.query(read('./seed.sql'));
  await client.query("INSERT INTO dev_seeds VALUES ('demo-v1')");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for the target database');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await manage(client, process.argv[2]);
  } finally {
    await client.end();
  }
}
