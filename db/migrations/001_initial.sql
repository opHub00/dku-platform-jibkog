CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  nickname TEXT NOT NULL,
  real_name TEXT,
  identity_verified INTEGER NOT NULL DEFAULT 0 CHECK (identity_verified IN (0,1)),
  membership TEXT NOT NULL DEFAULT 'free'
) STRICT;

CREATE TABLE districts (
  id TEXT PRIMARY KEY,
  sido TEXT NOT NULL,
  sigungu TEXT NOT NULL,
  UNIQUE (sido, sigungu)
) STRICT;

CREATE TABLE favorite_districts (
  user_id INTEGER REFERENCES users ON DELETE CASCADE NOT NULL,
  district_id TEXT REFERENCES districts NOT NULL,
  PRIMARY KEY (user_id, district_id)
) STRICT;

CREATE TABLE complexes (
  id TEXT PRIMARY KEY,
  district_id TEXT NOT NULL REFERENCES districts,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL CHECK (longitude BETWEEN -180 AND 180),
  move_in_month TEXT,
  resale_restriction_ends_on TEXT,
  reference_premium_rate REAL,
  image TEXT,
  CHECK ((latitude IS NULL) = (longitude IS NULL))
) STRICT;

CREATE TABLE complex_areas (
  complex_id TEXT REFERENCES complexes NOT NULL,
  area_m2 REAL NOT NULL CHECK (area_m2 > 0),
  PRIMARY KEY (complex_id, area_m2)
) STRICT;

-- Both card types share one ID space. Type-specific fields are checked on insertion.
CREATE TABLE listings (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('notice','trade')),
  complex_id TEXT NOT NULL REFERENCES complexes,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  urgent INTEGER NOT NULL DEFAULT 0 CHECK (urgent IN (0,1)),
  seller_id INTEGER REFERENCES users,
  status TEXT CHECK (status IN ('selling','reserved','sold','review')),
  area_m2 REAL CHECK (area_m2 > 0),
  floor INTEGER,
  sale_price INTEGER CHECK (sale_price >= 0),
  premium INTEGER,
  option_cost INTEGER CHECK (option_cost >= 0),
  paid_amount INTEGER CHECK (paid_amount >= 0),
  house_manage_no TEXT,
  notice_number TEXT,
  published_on TEXT,
  applications_open TEXT,
  applications_close TEXT,
  total_units INTEGER CHECK (total_units >= 0),
  notice_url TEXT,
  website_url TEXT,
  CHECK (applications_close >= applications_open),
  CHECK ((house_manage_no IS NULL) = (notice_number IS NULL)),
  CHECK (
    (type = 'trade' AND seller_id IS NOT NULL AND status IS NOT NULL
      AND area_m2 IS NOT NULL AND sale_price IS NOT NULL AND premium IS NOT NULL
      AND option_cost IS NOT NULL AND paid_amount IS NOT NULL
      AND house_manage_no IS NULL AND published_on IS NULL AND applications_open IS NULL
      AND applications_close IS NULL AND total_units IS NULL AND notice_url IS NULL AND website_url IS NULL)
    OR (type = 'notice' AND seller_id IS NULL AND status IS NULL AND area_m2 IS NULL
      AND floor IS NULL AND sale_price IS NULL AND premium IS NULL AND option_cost IS NULL AND paid_amount IS NULL)
  ),
  UNIQUE (id, type),
  UNIQUE (id, seller_id),
  UNIQUE (house_manage_no, notice_number)
) STRICT;
CREATE INDEX listings_feed ON listings(type, status, created_at DESC);
CREATE INDEX listings_seller ON listings(seller_id, created_at DESC);
CREATE INDEX listings_complex ON listings(complex_id);
CREATE VIEW public_listings AS SELECT * FROM listings WHERE type = 'notice' OR status <> 'review';

CREATE TABLE notice_models (
  listing_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'notice' CHECK (type = 'notice'),
  model_number TEXT NOT NULL,
  housing_type TEXT,
  supply_area_m2 REAL,
  max_price_won INTEGER CHECK (max_price_won >= 0),
  general_units INTEGER,
  special_units INTEGER,
  special_by_category TEXT CHECK (json_valid(special_by_category)),
  PRIMARY KEY (listing_id, model_number),
  FOREIGN KEY (listing_id, type) REFERENCES listings(id, type) ON DELETE CASCADE
) STRICT;

CREATE TABLE notice_documents (
  listing_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'notice' CHECK (type = 'notice'),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  PRIMARY KEY (listing_id, url),
  FOREIGN KEY (listing_id, type) REFERENCES listings(id, type) ON DELETE CASCADE
) STRICT;

-- Government transaction history is independent of a user's listing.
CREATE TABLE apartment_sales (
  id INTEGER PRIMARY KEY,
  district_id TEXT NOT NULL REFERENCES districts,
  apt_name TEXT NOT NULL,
  contract_date TEXT NOT NULL,
  amount_won INTEGER NOT NULL CHECK (amount_won >= 0),
  area_m2 REAL,
  floor INTEGER,
  raw_json TEXT NOT NULL CHECK (json_valid(raw_json))
) STRICT;
CREATE INDEX apartment_sales_lookup ON apartment_sales(district_id, contract_date);

CREATE TABLE favorites (
  user_id INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings ON DELETE CASCADE,
  PRIMARY KEY (user_id, listing_id)
) STRICT;

CREATE TABLE trade_documents (
  listing_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'trade' CHECK (type = 'trade'),
  kind TEXT NOT NULL CHECK (kind IN ('salesContract','paymentProof','optionContract')),
  status TEXT NOT NULL CHECK (status IN ('verified','pending','missing')),
  storage_key TEXT,
  PRIMARY KEY (listing_id, kind),
  FOREIGN KEY (listing_id, type) REFERENCES listings(id, type) ON DELETE CASCADE
) STRICT;

CREATE TABLE trust_reports (
  id INTEGER PRIMARY KEY,
  listing_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'trade' CHECK (type = 'trade'),
  evaluated_at TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  mode TEXT NOT NULL CHECK (mode IN ('demo','live')),
  report_json TEXT NOT NULL CHECK (json_valid(report_json)),
  FOREIGN KEY (listing_id, type) REFERENCES listings(id, type) ON DELETE CASCADE
) STRICT;
CREATE INDEX reports_history ON trust_reports(listing_id, evaluated_at DESC);

CREATE TABLE trade_chats (
  id INTEGER PRIMARY KEY,
  listing_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  buyer_id INTEGER NOT NULL REFERENCES users,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  CHECK (buyer_id <> seller_id),
  UNIQUE (listing_id, buyer_id),
  FOREIGN KEY (listing_id, seller_id) REFERENCES listings(id, seller_id)
) STRICT;

CREATE TABLE trade_messages (
  id INTEGER PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES trade_chats ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('buyer','seller')),
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE INDEX trade_messages_history ON trade_messages(chat_id, id);

CREATE TABLE ai_threads (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listings ON DELETE SET NULL
) STRICT;

CREATE TABLE ai_messages (
  id INTEGER PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES ai_threads ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE INDEX ai_messages_history ON ai_messages(thread_id, id);

CREATE TABLE notification_preferences (
  user_id INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  topic TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0,1)),
  PRIMARY KEY (user_id, topic)
) STRICT;
