-- Adapt purchases table for PO-then-receive workflow.
-- Original schema had received_by NOT NULL and status DEFAULT 'received',
-- meaning it was designed for immediate receipt. We need to support
-- creating a PO in advance (status='pending') and receiving it later.

ALTER TABLE purchases
  ALTER COLUMN received_by DROP NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS created_by  BIGINT      REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
