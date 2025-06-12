-- Migration number: 0001 	 2025-06-10T08:43:27.819Z
-- By default, migrations are created in the `migrations/` folder in your Worker project directory. 
-- Creating migrations will keep a record of applied migrations in the `d1_migrations` table.
-- Running `wrangler deploy` / `wrangler dev` will automatically apply migrations
-- Apply migrations manually: `wrangler d1 migrations apply flaredrive --local`
-- Delete database (reset all migrations): `wrangler d1 delete flaredrive --local`
-- Create a migration: `wrangler d1 migrations create flaredrive init`
--
-- files table: stores R2 files info for searching
-- use file R2 key as primary key
CREATE TABLE files (
  key TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  -- 0: files exist in <root> folder.
  depth INTEGER NOT NULL,
  size INTEGER NOT NULL,
  mime TEXT NOT NULL,
  -- thumbnail file id (sha256)
  thumbnail TEXT NOT NULL,
  -- file uploaded time. unix timestamp (miliseconds)
  uploaded INTEGER NOT NULL,
  -- record creation time.
  ctime INTEGER NOT NULL,
  -- record modified time.
  mtime INTEGER NOT NULL
);

CREATE INDEX idx_files_name ON files(name);

CREATE INDEX idx_files_depth_name ON files(depth, name);