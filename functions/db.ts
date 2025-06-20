import { ArrayBufferWithToJson, decodeHex, encodeHex, fileDepth, isDirectory, trimPrefixSuffix } from "../lib/commons";
import { File } from "../lib/schema";

/**
 * Upsert file meta info to D1 database "files" table
 * Columns of "files":
 *   key, name, size, mime, ctime, mtime
 */
export async function upsertDbFile(db: D1Database, file: R2Object) {
  const { key, httpMetadata, customMetadata, size, uploaded, checksums } = file;
  const mime = httpMetadata?.contentType || "";
  const name = key.split("/").pop() || "";
  const ctime = new Date(uploaded).getTime();
  const mtime = ctime; // Assuming mtime is same as ctime for now

  await db
    .prepare(
      `INSERT INTO files (key, name, depth, size, mime, thumbnail, uploaded, md5, ctime, mtime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       name = excluded.name,
       depth = excluded.depth,
       size = excluded.size,
       mime = excluded.mime,
       thumbnail = excluded.thumbnail,
       uploaded = excluded.uploaded,
       md5 = excluded.md5,
       mtime = excluded.mtime`
    )
    .bind(
      key,
      name,
      fileDepth(key),
      size,
      mime,
      customMetadata?.thumbnail || "",
      uploaded.getTime(),
      // dir object (size = 0) have a fixed md5 d41d8cd98f00b204e9800998ecf8427e
      // do not store it to save database space
      !isDirectory(file) ? encodeHex(checksums.md5) : "",
      ctime,
      mtime
    )
    .run();
}

/**
 * Delete file meta from D1 database "files" table
 */
export async function deleteDbFile(db: D1Database, key: string) {
  await db.prepare(`DELETE FROM files WHERE key = ?`).bind(key).run();
}

/**
 * Delete all file meta from D1 database "files" table which key has prefix.
 * If prefix is empty, delete all.
 */
export async function deleteAllDbFiles(db: D1Database, prefix?: string) {
  prefix = prefix || "";
  prefix = trimPrefixSuffix(prefix.trim(), "/");
  let sql = `DELETE FROM files WHERE 1 = 1`;
  const params: any[] = [];
  if (prefix) {
    const searchPrefix = `${prefix}/`;
    sql += ` AND (key >= ? AND key < ?)`;
    params.push(searchPrefix, searchPrefix + "\uffff");
  }
  await db
    .prepare(sql)
    .bind(...params)
    .run();
}

interface QueryOptions {
  /**
   * Full name match, not limited to name prefix
   */
  full?: boolean;
  prefix?: string;
  depth?: number;
  limit?: number;
  offset?: number;
}

/**
 * Query database files table, return rows which key or name starts with "query" param.
 */
export async function queryDbFiles(
  db: D1Database,
  query: string,
  { prefix = "", limit = 0, offset = 0, full, depth = -1 }: QueryOptions = {}
): Promise<File[]> {
  prefix = trimPrefixSuffix(prefix.trim(), "/");

  let sql = `SELECT key, name, depth, size, mime, thumbnail, uploaded, md5, ctime, mtime
  FROM files WHERE 1 = 1`;
  const params: any[] = [];

  if (query) {
    sql += ` AND (name LIKE ?)`;
    if (full) {
      params.push(`%${query}%`);
    } else {
      params.push(`${query}%`);
    }
  }

  if (depth >= 0) {
    sql += ` AND (depth = ?)`;
    params.push(depth);
  }
  if (prefix) {
    // Use range query for prefix matching to avoid "LIKE pattern too complex" errors.
    // The key < ? part is necessary, because, saying we have these file keys:
    // - `projects/myproject/fileA.txt`
    // - `projects/myproject/fileZ.txt`
    // - `projects/myproject_other/data.doc`
    // - `projects/nextproject/config.json`
    // And searchPrefix is `projects/myproject/`.
    // Then `key >= "projects/myproject/"` ifself will incorrectly include the last two files,
    // because (lexically) "_" > "/" and "n" > "m".
    const searchPrefix = `${prefix}/`;
    sql += ` AND (key >= ? AND key < ?)`;
    params.push(searchPrefix, searchPrefix + "\uffff");
  }
  sql += ` ORDER BY key`;
  if (limit > 0) {
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);
  }

  console.log("db query", sql, params);
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
    md5: row.md5,
    ctime: new Date(row.ctime),
    mtime: new Date(row.mtime),
  }));
}

export function dbFile2R2Object(file: File): R2Object {
  return {
    key: file.key,
    size: file.size,
    httpMetadata: { contentType: file.mime },
    customMetadata: { thumbnail: file.thumbnail || undefined },
    checksums: {
      md5: file.md5 ? new ArrayBufferWithToJson(decodeHex(file.md5).buffer) : undefined,
    },
    uploaded: file.uploaded,
  } as unknown as R2Object;
}
