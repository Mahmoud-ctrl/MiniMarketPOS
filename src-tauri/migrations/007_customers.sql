-- Add notes column to the existing customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;

-- Track credits (money owed) and payments (money received) per customer
CREATE TABLE customer_ledger (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  amount      BIGINT NOT NULL,
  entry_type  TEXT NOT NULL CHECK (entry_type IN ('credit', 'payment', 'reversal')),
  sale_id     BIGINT REFERENCES sales(id),
  notes       TEXT,
  created_by  BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_customer_ledger_customer ON customer_ledger (customer_id);
CREATE INDEX idx_customer_ledger_sale     ON customer_ledger (sale_id);
