-- Migration number: 0003 	 2025-06-23T01:29:53.959Z
ALTER TABLE
  files DROP COLUMN thumbnail;

CREATE TABLE filemeta (
  key TEXT NOT NULL,
  -- meta name
  name TEXT NOT NULL,
  -- meta value
  value TEXT NOT NULL,
  PRIMARY KEY (key, name),
  FOREIGN KEY (key) REFERENCES files (key) ON DELETE CASCADE
);