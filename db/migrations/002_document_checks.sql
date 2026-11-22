CREATE TABLE document_checks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  listing_id INTEGER REFERENCES listings ON DELETE SET NULL,
  storage_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','completed','failed')),
  result_json TEXT CHECK (json_valid(result_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status <> 'completed' OR result_json IS NOT NULL)
) STRICT;
CREATE INDEX document_checks_history ON document_checks(user_id, id DESC);
