import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { manage } from './manage.mjs';
import { listCards } from './listings.mjs';
import { importNotices } from './import-notices.mjs';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for the test database');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const schema = 'jibkog_test_' + randomUUID().replaceAll('-', '');
await db.connect();
try {
  await db.query('CREATE SCHEMA ' + schema);
  try {
    await db.query('SET search_path TO ' + schema);
    await manage(db, 'migrate');
    await manage(db, 'migrate');
    await db.query("INSERT INTO users(id,nickname,email,password_hash) VALUES (10,'existing','existing@example.test','disabled')");
    await assert.rejects(manage(db, 'seed'), /empty database/);
    assert.equal((await db.query('SELECT 1 FROM listings')).rowCount, 0);
    await db.query('DELETE FROM users WHERE id=10');
    await manage(db, 'seed');
    await manage(db, 'seed');
    assert.deepEqual((await listCards(db)).map(card => card.id), [1,2,3,4]);
    assert.equal((await listCards(db))[0].price, '24억 8,000만');
    assert.equal((await db.query("INSERT INTO users(nickname,email,password_hash) VALUES ('next','next@example.test','disabled') RETURNING id")).rows[0].id, 4);
    const reject = sql => assert.rejects(db.query(sql), err => ['23503','23505','23514'].includes(err.code));
    await reject('INSERT INTO favorites VALUES (1,1)');
    await reject('INSERT INTO favorites VALUES (1,100)');
    await reject('INSERT INTO trade_chats(listing_id,seller_id,buyer_id) VALUES (2,2,1)');
    await reject('INSERT INTO trade_chats(listing_id,seller_id,buyer_id) VALUES (1,3,1)');
    await reject('INSERT INTO trade_chats(listing_id,seller_id,buyer_id) VALUES (1,2,2)');
    await reject('INSERT INTO trade_chats(listing_id,seller_id,buyer_id) VALUES (1,2,1)');
    await reject("INSERT INTO trade_documents(listing_id,kind,status) VALUES (2,'paymentProof','pending')");
    await reject("INSERT INTO notice_models(listing_id,model_number) VALUES (1,'01')");
    await db.query("UPDATE listings SET status='review' WHERE id=1");
    const now = new Date('2026-11-23T15:00:00Z'); // Nov 24 in Seoul.
    const feed = await listCards(db, { now });
    assert.deepEqual(feed.map(card => card.id), [2,3,4]);
    assert.equal(feed[0].price, '접수 중');
    assert.equal(feed[2].price, '청약 예정');
    assert.equal((await listCards(db, { now: new Date('2026-11-27T00:00:00Z') }))[0].price, '청약 마감');
    assert.equal(feed[1].price, '12억 4,000만');
    assert.equal(feed[1].detail, '입주 예정 2026. 10 · 프리미엄 1.1억');
    assert.equal(feed[1].location, '경기 과천시 별양동');
    assert.equal(feed[1].liked, false);
    assert.deepEqual((await listCards(db, { scope: 'favorites', userId: 1 })).map(c=>[c.id,c.liked]), [[3,true]]);
    assert.deepEqual((await listCards(db, { scope: 'mine', userId: 2 })).map(c=>c.id), [1]);
    assert.deepEqual(await listCards(db, { scope: 'mine', userId: 1 }), []);
    await assert.rejects(listCards(db, { scope: 'mine' }), /user ID/);
    const notice = {
      id: '00012', notice_number: '00003', title: '테스트 공고', address: '서울 영등포구 문래동',
      housing_types: [{ model_number: '01', max_price_krw_10000: '182,700' }],
      documents: [{ title: '공고문', url: 'https://example.org/notice.pdf' }],
    };
    const save = changes => importNotices(db, { notices: [{ ...notice, ...changes }] });
    await save({});
    const imported = (await listCards(db)).find(c => c.title === notice.title);
    assert.ok(imported);
    await db.query('INSERT INTO favorites VALUES (1,$1)', [imported.id]);
    await save({ title: '수정 공고', housing_types: null, documents: [] });
    const saved = await listCards(db, { scope: 'favorites', userId: 1 });
    assert.ok(saved.some(c => c.id === imported.id && c.title === '수정 공고'));
    const models = await db.query('SELECT model_number,max_price_won FROM notice_models WHERE listing_id=$1', [imported.id]);
    assert.deepEqual(models.rows, [{ model_number: '01', max_price_won: '1827000000' }]);
    assert.equal((await db.query('SELECT 1 FROM notice_documents WHERE listing_id=$1', [imported.id])).rowCount, 0);
    await assert.rejects(save({ housing_types: [{ model_number: '01', max_price_krw_10000: 'bad' }] }), /Invalid housing price/);
    assert.equal((await db.query('SELECT title FROM listings WHERE id=$1', [imported.id])).rows[0].title, '수정 공고');
    assert.equal((await db.query('SELECT 1 FROM notice_models WHERE listing_id=$1', [imported.id])).rowCount, 1);
    await save({ housing_types: [] });
    assert.equal((await db.query('SELECT 1 FROM notice_models WHERE listing_id=$1', [imported.id])).rowCount, 0);
    assert.equal((await db.query("SELECT 1 FROM listings WHERE house_manage_no='00012'")).rowCount, 1);
    console.log('PostgreSQL migrations, seed, constraints, listing queries and notice imports passed.');
  } finally {
    await db.query('DROP SCHEMA ' + schema + ' CASCADE');
  }
} finally {
  await db.end();
}
