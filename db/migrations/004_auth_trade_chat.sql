-- Keep pre-authentication records, but do not give them usable credentials.
ALTER TABLE users ADD COLUMN email TEXT, ADD COLUMN password_hash TEXT,
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE users SET email = 'legacy-' || id || '@invalid.example', password_hash = 'disabled';
ALTER TABLE users ALTER COLUMN email SET NOT NULL, ALTER COLUMN password_hash SET NOT NULL,
  ADD CONSTRAINT users_email_unique UNIQUE (email),
  ADD CONSTRAINT users_email_lower CHECK (email = lower(email) AND length(trim(email)) > 0);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);

ALTER TABLE trade_chats ADD COLUMN deal_status TEXT NOT NULL DEFAULT 'inquiry'
  CHECK (deal_status IN ('inquiry','negotiating','contracting','done')),
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE trade_chats SET deal_status = 'done' WHERE status = 'closed';
ALTER TABLE trade_chats ADD CONSTRAINT trade_chats_deal_consistency
  CHECK ((deal_status = 'done') = (status = 'closed'));
CREATE INDEX trade_chats_buyer ON trade_chats(buyer_id, updated_at DESC);
CREATE INDEX trade_chats_seller ON trade_chats(seller_id, updated_at DESC);

ALTER TABLE trade_messages ALTER COLUMN author_role DROP NOT NULL,
  DROP CONSTRAINT trade_messages_author_role_check,
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','offer','system')),
  ADD COLUMN offer_amount BIGINT CHECK (offer_amount > 0),
  ADD COLUMN offer_base_amount BIGINT,
  ADD COLUMN offer_status TEXT CHECK (offer_status IN ('pending','accepted','rejected','superseded')),
  ADD COLUMN responded_at TIMESTAMPTZ;
ALTER TABLE trade_messages ADD CONSTRAINT trade_messages_author_kind
  CHECK ((kind = 'system' AND author_role IS NULL) OR
    (kind = 'text' AND author_role IS NOT NULL AND author_role IN ('buyer','seller')) OR
    (kind = 'offer' AND author_role IS NOT NULL AND author_role = 'buyer')),
  ADD CONSTRAINT trade_messages_offer_fields CHECK (
    (kind = 'offer' AND offer_amount IS NOT NULL AND offer_status IS NOT NULL) OR
    (kind <> 'offer' AND offer_amount IS NULL AND offer_base_amount IS NULL AND offer_status IS NULL AND responded_at IS NULL)),
  ADD CONSTRAINT trade_messages_chat_id_unique UNIQUE (chat_id, id);
CREATE UNIQUE INDEX one_pending_offer ON trade_messages(chat_id) WHERE offer_status = 'pending';

CREATE TABLE trade_chat_reads (
  chat_id INTEGER NOT NULL REFERENCES trade_chats ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  last_read_message_id INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id),
  FOREIGN KEY (chat_id, last_read_message_id) REFERENCES trade_messages(chat_id, id) ON DELETE CASCADE
);
