-- Add parent/child support to categories (max 2 levels enforced in UI).
-- ON DELETE SET NULL: deleting a parent makes its children top-level.
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE categories
  ADD CONSTRAINT categories_no_self_parent CHECK (parent_id != id);
