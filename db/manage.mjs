import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

const [command, filename] = process.argv.slice(2);
if (!['migrate', 'seed'].includes(command) || !filename || process.argv.length !== 4) {
  throw new Error('Usage: node db/manage.mjs <migrate|seed> <database-file>');
}
const db = new DatabaseSync(filename);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
try {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY) STRICT');
  const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?');
  const record = db.prepare('INSERT INTO schema_migrations VALUES (?)');
  const migrations = readdirSync(new URL('./migrations/', import.meta.url)).filter(n => n.endsWith('.sql')).sort();
  for (const name of migrations) {
    if (applied.get(name)) continue;
    db.exec(read('./migrations/' + name));
    record.run(name);
  }
  if (command === 'seed') {
    db.exec('CREATE TABLE IF NOT EXISTS dev_seeds (name TEXT PRIMARY KEY) STRICT');
    if (!db.prepare('SELECT 1 FROM dev_seeds WHERE name = ?').get('demo-v1')) {
      const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT IN ('schema_migrations','dev_seeds') AND name NOT GLOB 'sqlite_*'").all();
      for (const { name } of tables) {
        const quoted = '"' + name.replaceAll('"', '""') + '"';
        if (db.prepare('SELECT 1 FROM ' + quoted + ' LIMIT 1').get()) throw new Error('Demo seed requires an empty database');
      }
      db.exec(read('./seed.sql'));
      db.prepare('INSERT INTO dev_seeds VALUES (?)').run('demo-v1');
    }
  }
  db.exec('COMMIT');
} finally {
  db.close();
}
