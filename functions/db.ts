import { fileDepth, trimPrefixSuffix } from "../lib/commons";
import { File } from "../lib/schema";

/**
 * Upsert file meta info to D1 database "files" table
 * Columns of "files":
 *   key, name, size, mime, ctime, mtime
 */
export async function upsertDbFile(db: D1Database, file: R2Object) {
  const { key, httpMetadata, customMetadata, size, uploaded } = file;
  const mime = httpMetadata?.contentType || "";
  const name = key.split("/").pop() || "";
  const ctime = new Date(uploaded).getTime();
  const mtime = ctime; // Assuming mtime is same as ctime for now

  await db
    .prepare(
      `INSERT INTO files (key, name, depth, size, mime, thumbnail, uploaded, ctime, mtime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       name = excluded.name,
       depth = excluded.depth,
       size = excluded.size,
       mime = excluded.mime,
       thumbnail = excluded.thumbnail,
       uploaded = excluded.uploaded`
    )
    .bind(key, name, fileDepth(key), size, mime, customMetadata?.thumbnail || "", uploaded.getTime(), ctime, mtime)
    .run();
}

/**
 * Delete file meta from D1 database "files" table
 */
export async function deleteDbFile(db: D1Database, key: string) {
  await db.prepare(`DELETE FROM files WHERE key = ?`).bind(key).run();
}

interface QueryOptions {
  prefix?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query database files table, return rows which key or name starts with "query" param.
 */
export async function queryDbFiles(
  db: D1Database,
  query: string,
  { prefix = "", limit = 0, offset = 0 }: QueryOptions = {}
): Promise<File[]> {
  prefix = trimPrefixSuffix(prefix.trim(), "/");

  let sql = `SELECT key, name, depth, size, mime, thumbnail, uploaded, ctime, mtime
  FROM files WHERE (key LIKE ? OR name LIKE ?)`;
  const params: any[] = [`${query}%`, `${query}%`];
  if (prefix) {
    sql += ` AND key LIKE ?`;
    params.push(`${prefix}/%`);
  }
  sql += `ORDER BY key LIMIT ? OFFSET ?`;
  params.push(limit || 1000, offset);

  const rows = await db
    .prepare(sql)
    .bind(...params)
    .all();

  return rows.results.map((row: any) => ({
    key: row.key,
    name: row.name,
    depth: row.depth,
    size: row.size,
    mime: row.mime,
    thumbnail: row.thumbnail,
    uploaded: new Date(row.uploaded),
    ctime: new Date(row.ctime),
    mtime: new Date(row.mtime),
  }));
}
