import {
  EMPTY_MD5_RAW,
  KEY_PREFIX_PRIVATE,
  SEARCH_MAGIC_WORD_LARGEST,
  SEARCH_MAGIC_WORD_RECENT,
  decodeHex,
  fileDepth,
  getR2FileMd5,
  trimPrefixSuffix,
} from "../lib/commons";
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
      file.size > 0 ? getR2FileMd5(file) : "",
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
  const params: unknown[] = [];
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
  const params: unknown[] = [];

  if (query && query !== SEARCH_MAGIC_WORD_LARGEST && query !== SEARCH_MAGIC_WORD_RECENT) {
    sql += ` AND (f.name LIKE ?)`;
    if (full) {
      params.push(`%${query}%`);
    } else {
      params.push(`${query}%`);
    }
  }
  if (query == SEARCH_MAGIC_WORD_LARGEST) {
    sql += ` AND (f.size > 0)`; // implies not dir
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

  if (query === SEARCH_MAGIC_WORD_LARGEST) {
    sql += ` ORDER BY f.size DESC`;
  } else if (query === SEARCH_MAGIC_WORD_RECENT) {
    sql += ` ORDER BY f.mtime DESC`;
  } else {
    sql += ` ORDER BY f.key`;
  }

  if (limit > 0) {
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);
  }

  console.log("db query", sql, params);
  const rows = await db
    .prepare(sql)
    .bind(...params)
    .all();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    checksums: new CustomR2Checksums({
      md5: file.md5 ? decodeHex(file.md5).buffer : file.size === 0 ? EMPTY_MD5_RAW.buffer : undefined,
    }),
    uploaded: file.uploaded,
  } as unknown as R2Object;
}

/**
 * @class CustomR2Checksums
 * @description Implements the R2Checksums interface. It stores checksums as ArrayBuffers
 * and provides a method to get their hexadecimal string representation.
 */
class CustomR2Checksums implements R2Checksums {
  public readonly md5?: ArrayBuffer;
  public readonly sha1?: ArrayBuffer;
  public readonly sha256?: ArrayBuffer;
  public readonly sha384?: ArrayBuffer;
  public readonly sha512?: ArrayBuffer;

  /**
   * @constructor
   * @param {Partial<R2Checksums>} checksums - An object containing the checksums as ArrayBuffers.
   */
  constructor(checksums: Partial<R2Checksums>) {
    this.md5 = checksums.md5;
    this.sha1 = checksums.sha1;
    this.sha256 = checksums.sha256;
    this.sha384 = checksums.sha384;
    this.sha512 = checksums.sha512;
  }

  /**
   * @method toJSON
   * @description Converts the stored ArrayBuffer checksums into a JSON-serializable object
   * where each checksum is a hexadecimal string.
   * @returns {R2StringChecksums} The object with string-based checksums.
   */
  public toJSON(): R2StringChecksums {
    const json: R2StringChecksums = {};
    if (this.md5) json.md5 = this.arrayBufferToHex(this.md5);
    if (this.sha1) json.sha1 = this.arrayBufferToHex(this.sha1);
    if (this.sha256) json.sha256 = this.arrayBufferToHex(this.sha256);
    if (this.sha384) json.sha384 = this.arrayBufferToHex(this.sha384);
    if (this.sha512) json.sha512 = this.arrayBufferToHex(this.sha512);
    return json;
  }

  /**
   * @private
   * @method arrayBufferToHex
   * @description Helper function to convert an ArrayBuffer to a hexadecimal string.
   * @param {ArrayBuffer} buffer - The buffer to convert.
   * @returns {string} The hexadecimal string representation of the buffer.
   */
  private arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
