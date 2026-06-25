CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default: USD base currency, 89500 LBP per 1 USD, no secondary display
INSERT INTO settings (key, value) VALUES
  ('base_currency',     'USD'),
  ('exchange_rate',     '89500'),
  ('show_alt_currency', 'false')
ON CONFLICT (key) DO NOTHING;
