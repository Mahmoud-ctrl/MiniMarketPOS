-- Idempotent: ensures customer_ledger exists regardless of migration 007 state.
-- Safe to run even when the table already exists (IF NOT EXISTS on all statements).
CREATE TABLE IF NOT EXISTS customer_ledger (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  amount      BIGINT NOT NULL,
  entry_type  TEXT NOT NULL CHECK (entry_type IN ('credit', 'payment', 'reversal')),
  sale_id     BIGINT REFERENCES sales(id),
  notes       TEXT,
  created_by  BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON customer_ledger (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_sale     ON customer_ledger (sale_id);
