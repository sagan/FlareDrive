-- Migration number: 0002 	 2025-06-18T06:41:23.853Z
-- add "md5" column to "files" table
ALTER TABLE
  files
ADD
  COLUMN md5 TEXT NOT NULL DEFAULT '';