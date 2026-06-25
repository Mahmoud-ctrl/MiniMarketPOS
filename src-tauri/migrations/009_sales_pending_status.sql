-- Allow 'pending' status for credit sales that have not yet been fully paid.
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN ('pending', 'completed', 'refunded', 'void'));
