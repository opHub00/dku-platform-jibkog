INSERT INTO users(id,nickname) VALUES (1,'예나'),(2,'서초판매자'),(3,'과천판매자');
INSERT INTO districts VALUES
 ('11650','서울','서초구'),('11500','서울','강서구'),('41290','경기','과천시'),('28260','인천','서구');
INSERT INTO favorite_districts VALUES (1,'11650');
INSERT INTO complexes(id,district_id,name,address,move_in_month,image) VALUES
 ('one-bailey','11650','래미안 원베일리','서울 서초구 반포동','2027-08','/assets/apt-seoul.webp'),
 ('magok','11500','마곡나루역 오피스텔','서울 강서구 마곡동',NULL,'/assets/modern-home.jpg'),
 ('gwacheon','41290','과천 디에트르 퍼스티지','경기 과천시 별양동','2026-10','/assets/apt-city.jpg'),
 ('geomdan','28260','검단신도시 AA21블록','인천 서구 원당동',NULL,'/assets/modern-home.jpg');
INSERT INTO complex_areas VALUES ('one-bailey',84),('gwacheon',59);
-- Demo breakdown: asking price = sale price + premium + option cost.
INSERT INTO listings(id,type,complex_id,title,seller_id,status,area_m2,sale_price,premium,option_cost,paid_amount,urgent,created_at) VALUES
 (1,'trade','one-bailey','래미안 원베일리 84㎡',2,'selling',84,2160000000,320000000,0,0,true,'2026-11-22 12:00:00+00'),
 (3,'trade','gwacheon','과천 디에트르 퍼스티지 59㎡',3,'selling',59,1130000000,110000000,0,0,false,'2026-11-21 12:00:00+00');
INSERT INTO listings(id,type,complex_id,title,applications_open,applications_close,total_units,created_at) VALUES
 (2,'notice','magok','마곡나루역 오피스텔 청약','2026-11-24','2026-11-26',512,'2026-11-22 00:00:00+00'),
 (4,'notice','geomdan','검단신도시 AA21블록','2026-11-27','2026-11-29',1122,'2026-11-21 09:00:00+00');
INSERT INTO favorites VALUES (1,1),(1,3);
INSERT INTO trade_chats(id,listing_id,seller_id,buyer_id) VALUES (1,1,2,1);
INSERT INTO trade_messages(chat_id,author_role,body) VALUES (1,'buyer','아직 거래 가능한가요?');
INSERT INTO trade_documents(listing_id,kind,status)
 SELECT id,kind,'missing' FROM listings CROSS JOIN
 (SELECT 'salesContract' AS kind UNION ALL SELECT 'paymentProof' UNION ALL SELECT 'optionContract') AS kinds
 WHERE type='trade';

ALTER TABLE users ALTER COLUMN id RESTART WITH 4;
ALTER TABLE listings ALTER COLUMN id RESTART WITH 5;
ALTER TABLE trade_chats ALTER COLUMN id RESTART WITH 2;
