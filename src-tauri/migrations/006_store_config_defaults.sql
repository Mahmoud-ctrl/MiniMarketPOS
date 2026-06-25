INSERT INTO settings (key, value) VALUES
  ('store_name',    ''),
  ('store_address', ''),
  ('store_phone',   ''),
  ('store_email',   ''),
  ('store_tagline', ''),
  ('store_logo',    '')
ON CONFLICT (key) DO NOTHING;
