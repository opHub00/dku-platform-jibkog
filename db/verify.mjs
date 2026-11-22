import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { listCards } from './listings.mjs';

const dir = mkdtempSync(join(tmpdir(), 'jibkog-db-'));
const path = join(dir, 'test.sqlite');
const run = (command, expected = 0) => {
  const cli = fileURLToPath(new URL('./manage.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, command, path], { encoding: 'utf8' });
  assert.equal(result.status, expected, result.stderr);
};
let db;
try {
  run('migrate');
  run('migrate');
  db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON');
  db.exec("INSERT INTO users VALUES (10,'existing',NULL,0,'free')");
  run('seed', 1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM listings').get().n, 0);
  db.exec('DELETE FROM users WHERE id=10');
  run('seed');
  run('seed');
  assert.deepEqual(db.prepare('SELECT id FROM public_listings ORDER BY id').all().map(x=>x.id), [1,2,3,4]);
  assert.deepEqual(db.prepare('SELECT listing_id FROM favorites WHERE user_id=1 ORDER BY listing_id').all().map(x=>x.listing_id), [1,3]);
  const reject = sql => assert.throws(() => db.exec(sql), /constraint/i);
  reject('INSERT INTO favorites VALUES (1,1)');
  reject('INSERT INTO favorites VALUES (1,100)');
  reject('INSERT INTO trade_chats(listing_id,seller_id,buyer_id) VALUES (2,2,1)');
  reject('INSERT INTO trade_chats(listing_id,seller_id,buyer_id) VALUES (1,3,1)');
  reject('INSERT INTO trade_chats(listing_id,seller_id,buyer_id) VALUES (1,2,2)');
  reject('INSERT INTO trade_chats(listing_id,seller_id,buyer_id) VALUES (1,2,1)');
  reject("INSERT INTO trade_documents(listing_id,kind,status) VALUES (2,'paymentProof','pending')");
  reject("INSERT INTO notice_models(listing_id,model_number) VALUES (1,'01')");
  db.exec("UPDATE listings SET status='review' WHERE id=1");
  const now = new Date('2026-11-23T15:00:00Z'); // Nov 24 in Seoul.
  const feed = listCards(db, { now });
  assert.deepEqual(feed.map(card => card.id), [2,3,4]);
  assert.equal(feed[0].price, '접수 중');
  assert.equal(feed[2].price, '청약 예정');
  assert.equal(listCards(db, { now: new Date('2026-11-27T00:00:00Z') })[0].price, '청약 마감');
  assert.equal(feed[1].price, '12억 4,000만');
  assert.equal(feed[1].detail, '입주 예정 2026. 10 · 프리미엄 1.1억');
  assert.equal(feed[1].location, '경기 과천시 별양동');
  assert.equal(feed[1].liked, false);
  assert.deepEqual(listCards(db, { scope: 'favorites', userId: 1 }).map(c=>[c.id,c.liked]), [[3,true]]);
  assert.deepEqual(listCards(db, { scope: 'mine', userId: 2 }).map(c=>c.id), [1]);
  assert.deepEqual(listCards(db, { scope: 'mine', userId: 1 }), []);
  assert.throws(() => listCards(db, { scope: 'mine' }), /user ID/);
  assert.equal(db.prepare('SELECT id FROM public_listings WHERE id=1').get(), undefined);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  console.log('Migration, seed, feed, constraints and integrity checks passed.');
} finally {
  db?.close();
  rmSync(dir, { recursive: true, force: true });
}
