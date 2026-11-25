import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing ' + field);
  return value.trim();
}

function priceWon(value) {
  if (value == null || value === '') return null;
  const digits = String(value).replaceAll(',', '').trim();
  if (!/^\d+$/.test(digits)) throw new Error('Invalid housing price: ' + value);
  return String(BigInt(digits) * 10000n);
}

async function saveNotice(db, notice) {
  const house = requiredText(notice.id, 'id');
  const number = requiredText(notice.notice_number, 'notice_number');
  const title = requiredText(notice.title, 'title');
  const address = requiredText(notice.address, 'address');
  const complexId = 'applyhome:' + JSON.stringify([house, number]);
  await db.query(`INSERT INTO complexes (id,name,address,latitude,longitude) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, address=EXCLUDED.address,
      latitude=CASE WHEN complexes.address=EXCLUDED.address THEN COALESCE(EXCLUDED.latitude,complexes.latitude) ELSE EXCLUDED.latitude END,
      longitude=CASE WHEN complexes.address=EXCLUDED.address THEN COALESCE(EXCLUDED.longitude,complexes.longitude) ELSE EXCLUDED.longitude END`,
    [complexId, title, address, notice.coordinates?.latitude, notice.coordinates?.longitude]);
  const { rows } = await db.query(`INSERT INTO listings
    (type,complex_id,title,house_manage_no,notice_number,published_on,applications_open,applications_close,total_units,notice_url,website_url)
    VALUES ('notice',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (house_manage_no,notice_number) DO UPDATE SET
      complex_id=EXCLUDED.complex_id, title=EXCLUDED.title, published_on=EXCLUDED.published_on,
      applications_open=EXCLUDED.applications_open, applications_close=EXCLUDED.applications_close,
      total_units=EXCLUDED.total_units, notice_url=EXCLUDED.notice_url, website_url=EXCLUDED.website_url
    RETURNING id`, [complexId,title,house,number,notice.published_on,notice.applications_open,
    notice.applications_close,notice.total_units,notice.notice_url,notice.website_url]);
  const id = rows[0].id;
  if (notice.housing_types != null) {
    if (!Array.isArray(notice.housing_types)) throw new Error('Invalid housing_types');
    await db.query('DELETE FROM notice_models WHERE listing_id=$1', [id]);
    for (const model of notice.housing_types) {
      await db.query(`INSERT INTO notice_models (listing_id,model_number,housing_type,supply_area_m2,
        max_price_won,general_units,special_units,special_by_category) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id,requiredText(model.model_number,'model_number'),model.housing_type,model.supply_area_m2 || null,
          priceWon(model.max_price_krw_10000),model.general_supply_units,model.special_supply_units,model.special_supply_by_category]);
    }
  }
  if (notice.documents != null) {
    if (!Array.isArray(notice.documents)) throw new Error('Invalid documents');
    await db.query('DELETE FROM notice_documents WHERE listing_id=$1', [id]);
    for (const doc of notice.documents) {
      await db.query('INSERT INTO notice_documents (listing_id,title,url) VALUES ($1,$2,$3)',
        [id,doc.title || doc.kind || '공고문',requiredText(doc.url,'document URL')]);
    }
  }
}

export async function importNotices(client, payload) {
  if (!Array.isArray(payload?.notices)) throw new Error('No successful notices response in input');
  await client.query('BEGIN');
  try {
    for (const notice of payload.notices) await saveNotice(client, notice);
    await client.query('COMMIT');
    return payload.notices.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (!process.env.DATABASE_URL || !process.argv[2]) throw new Error('Set DATABASE_URL and supply the results.json path');
  const payload = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    console.log('Processed notices:', await importNotices(client, payload));
  } finally {
    await client.end();
  }
}
