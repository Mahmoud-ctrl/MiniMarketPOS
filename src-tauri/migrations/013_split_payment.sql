-- Split-currency payment columns
-- paid_primary:   amount in base-currency units (e.g. USD cents)
-- paid_secondary: amount in alt-currency units  (e.g. raw LBP)
-- exchange_rate_snapshot: LBP/USD rate at time of sale (integer, e.g. 89500)
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS paid_primary           BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS paid_secondary         BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS exchange_rate_snapshot BIGINT NOT NULL DEFAULT 0;
