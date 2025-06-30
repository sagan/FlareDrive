import { EMPTY_MD5_RAW, KEY_PREFIX_PRIVATE, decodeHex, encodeHex, fileDepth, trimPrefixSuffix } from "../lib/commons";
import { File } from "../lib/schema";

/**
 * Upsert file meta info to D1 database "files" and "filemeta" table
 */
export async function upsertDbFile(db: D1Database, file: R2Object) {
  const { key, httpMetadata, customMetadata, size, uploaded, checksums } = file;
  if (key.startsWith(KEY_PREFIX_PRIVATE)) {
    return;
  }
  const mime = httpMetadata?.contentType || "";
  const name = key.split("/").pop() || "";
  const ctime = new Date(uploaded).getTime();
  const mtime = ctime; // Assuming mtime is same as ctime for now

  const statements: D1PreparedStatement[] = [];

  const upsertFileStmt = db.prepare(`INSERT INTO files (key, name, depth, size, mime, uploaded, md5, ctime, mtime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       name = excluded.name,
       depth = excluded.depth,
       size = excluded.size,
       mime = excluded.mime,
       uploaded = excluded.uploaded,
       md5 = excluded.md5,
       mtime = excluded.mtime`);
  statements.push(
    upsertFileStmt.bind(
      key,
      name,
      fileDepth(key),
      size,
      mime,
      uploaded.getTime(),
      // dir or other empty file (size = 0) have a fixed md5 d41d8cd98f00b204e9800998ecf8427e
      // do not store it to save database space
      file.size > 0 ? encodeHex(checksums.md5) : "",
      ctime,
      mtime
    )
  );

  const deleteMetaStmt = db.prepare(`DELETE FROM filemeta WHERE key = ?`);
  statements.push(deleteMetaStmt.bind(file.key));

  if (customMetadata) {
    const insertMetaStmt = db.prepare(`INSERT INTO filemeta (key, name, value) VALUES (?, ?, ?)`);
    for (const [metaKey, metaValue] of Object.entries(customMetadata)) {
      statements.push(insertMetaStmt.bind(file.key, metaKey, metaValue));
    }
  }

  await db.batch(statements);
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

  let sql = `
SELECT
  f.*,
  JSON_GROUP_OBJECT(fm.name, fm.value) FILTER (WHERE fm.key IS NOT NULL) AS customMetadata
FROM files AS f
LEFT JOIN filemeta AS fm ON f.key = fm.key
WHERE 1 = 1`;
  const params: any[] = [];

  if (query) {
    sql += ` AND (f.name LIKE ?)`;
    if (full) {
      params.push(`%${query}%`);
    } else {
      params.push(`${query}%`);
    }
  }

  if (depth >= 0) {
    sql += ` AND (f.depth = ?)`;
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
    sql += ` AND (f.key >= ? AND f.key < ?)`;
    params.push(searchPrefix, searchPrefix + "\uffff");
  }
  // it's ok to select "f.*" but group by "f.key" in SQLite / D1.
  // Standard SQL forbid it, but SQLite intentionally relaxes this rule:
  //   If the SELECT list contains a "bare" column (a column that is not within an aggregate function),
  //   SQLite is free to return the value from any row within that group.
  sql += ` GROUP BY f.key`;
  sql += ` ORDER BY f.key`;
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
    uploaded: new Date(row.uploaded),
    md5: row.md5,
    ctime: new Date(row.ctime),
    mtime: new Date(row.mtime),
    customMetadata: row.customMetadata ? JSON.parse(row.customMetadata) : {},
  }));
}

export function dbFile2R2Object(file: File): R2Object {
  return {
    key: file.key,
    size: file.size,
    httpMetadata: { contentType: file.mime },
    customMetadata: file.customMetadata,
    checksums: {
      md5: file.md5 ? decodeHex(file.md5).buffer : file.size === 0 ? EMPTY_MD5_RAW.buffer : undefined,
    },
    uploaded: file.uploaded,
  } as unknown as R2Object;
}
