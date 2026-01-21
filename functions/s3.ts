import { AwsClient } from "aws4fetch";
import {
  HEADER_CACHE_CONTROL,
  HEADER_CONTENT_DISPOSITION,
  HEADER_CONTENT_ENCODING,
  HEADER_CONTENT_LANGUAGE,
  HEADER_CONTENT_LENGTH,
  HEADER_CONTENT_MD5,
  HEADER_CONTENT_TYPE,
  HEADER_ETAG,
  HEADER_IF_MATCH,
  HEADER_IF_MODIFIED_SINCE,
  HEADER_IF_NONE_MATCH,
  HEADER_IF_UNMODIFIED_SINCE,
  HEADER_LAST_MODIFIED,
  HEADER_PREFIX_X_AMAZON_META,
  HEADER_RANGE,
  METHOD_DELETE,
  METHOD_GET,
  METHOD_HEAD,
  METHOD_POST,
  METHOD_PUT,
  PART_NUMBER_VARIABLE,
  UPLOADS_VARIABLE,
  UPLOAD_ID_VARIABLE,
  rangeHeader,
  toString,
} from "../lib/commons";

const SEARCH_PARAM_LIST_TYPE = "list-type";
const SEARCH_PARAM_PREFIX = "prefix";
const SEARCH_PARAM_CONTINUATION_TOKEN = "continuation-token";
const SEARCH_PARAM_MAX_KEYS = "max-keys";
const SEARCH_PARAM_DELIMITER = "delimiter";

const XML_TAG_UPLOAD_ID = "UploadId";
const XML_TAG_CONTENTS = "Contents";
const XML_TAG_KEY = "Key";
const XML_TAG_SIZR = "Size";
const XML_TAG_ETAG = "ETag";
const XML_TAG_LAST_MODIFIED = "LastModified";
const XML_TAG_COMMON_PREFIXES = "CommonPrefixes";
const XML_TAG_PREFIX = "Prefix";
const XML_TAG_IS_TRUNCATED = "IsTruncated";
const XML_TAG_NEXT_CONTINUATION_TOKEN = "NextContinuationToken";

const XML_VALUE_TRUE = "true";

export interface S3BucketConfig {
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * e.g. https://s3.us-east-1.amazonaws.com/bucket or https://bucket.s3.us-east-1.amazonaws.com .
   * No trailing slash.
   */
  endpoint: string;
  region?: string;
}

// --- XML Parsing Helpers (Lightweight, no dependencies) ---
const XML = {
  // Extract content between <Tag>...</Tag>
  parseValue: (xml: string, tag: string): string | null => {
    const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`));
    return match ? match[1] : null;
  },
  // Extract all occurrences of a block, e.g. <Contents>...</Contents>
  parseList: (xml: string, tag: string): string[] => {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
    const matches = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  },
};

// --- R2 Interface Mocks ---

class S3ObjectStub implements R2Object {
  key: string;
  version: string = "";
  storageClass: string = "";
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata: R2HTTPMetadata;
  checksums: R2Checksums;
  customMetadata: Record<string, string>;

  constructor(
    key: string,
    headers: Headers,
    size?: number,
    lastModified?: Date,
    etag?: string,
    checksums?: R2Checksums
  ) {
    this.key = key;
    this.size = size ?? Number(headers.get(HEADER_CONTENT_LENGTH) || 0);
    this.etag = etag ?? headers.get(HEADER_ETAG) ?? "";
    // S3 Etags often come wrapped in quotes, R2 sometimes doesn't. We normalize to "raw" string if needed,
    // but usually keeping quotes is safer for If-Match headers.
    this.httpEtag = this.etag;
    this.uploaded = lastModified ?? new Date(headers.get(HEADER_LAST_MODIFIED) || Date.now());
    this.httpMetadata = this.headersToHttpMetadata(headers);
    this.customMetadata = this.headersToCustomMetadata(headers);
    this.checksums = checksums || ({} as R2Checksums);
  }

  writeHttpMetadata(headers: Headers): void {
    if (this.httpMetadata.contentType) {
      headers.set(HEADER_CONTENT_TYPE, this.httpMetadata.contentType);
    }
    if (this.httpMetadata.contentLanguage) {
      headers.set(HEADER_CONTENT_LANGUAGE, this.httpMetadata.contentLanguage);
    }
    if (this.httpMetadata.contentDisposition) {
      headers.set(HEADER_CONTENT_DISPOSITION, this.httpMetadata.contentDisposition);
    }
    if (this.httpMetadata.contentEncoding) {
      headers.set(HEADER_CONTENT_ENCODING, this.httpMetadata.contentEncoding);
    }
    if (this.httpMetadata.cacheControl) {
      headers.set(HEADER_CACHE_CONTROL, this.httpMetadata.cacheControl);
    }
  }

  private headersToHttpMetadata(headers: Headers): R2HTTPMetadata {
    return {
      contentType: headers.get(HEADER_CONTENT_TYPE) ?? undefined,
      contentLanguage: headers.get(HEADER_CONTENT_LANGUAGE) ?? undefined,
      contentDisposition: headers.get(HEADER_CONTENT_DISPOSITION) ?? undefined,
      contentEncoding: headers.get(HEADER_CONTENT_ENCODING) ?? undefined,
      cacheControl: headers.get(HEADER_CACHE_CONTROL) ?? undefined,
    };
  }

  private headersToCustomMetadata(headers: Headers): Record<string, string> {
    const metadata: Record<string, string> = {};
    headers.forEach((value, key) => {
      if (key.startsWith(HEADER_PREFIX_X_AMAZON_META)) {
        metadata[key.replace(HEADER_PREFIX_X_AMAZON_META, "")] = value;
      }
    });
    return metadata;
  }
}

class S3ObjectBodyStub extends S3ObjectStub implements R2ObjectBody {
  body: ReadableStream<unknown>;
  bodyUsed: boolean = false;
  private response: Response;

  constructor(key: string, response: Response) {
    super(key, response.headers);
    this.response = response;
    this.body = response.body as ReadableStream;
  }
  async arrayBuffer() {
    return this.response.arrayBuffer();
  }
  async text() {
    return this.response.text();
  }
  async json<T>() {
    return this.response.json() as Promise<T>;
  }
  async blob() {
    return this.response.blob();
  }
  async bytes() {
    const ab = await this.response.arrayBuffer();
    return new Uint8Array(ab);
  }
}

// --- Multipart Upload Implementation ---

class S3MultipartUpload implements R2MultipartUpload {
  key: string;
  uploadId: string;
  private client: AwsClient;
  private bucketUrl: string;

  constructor(client: AwsClient, bucketUrl: string, key: string, uploadId: string) {
    this.client = client;
    this.bucketUrl = bucketUrl;
    this.key = key;
    this.uploadId = uploadId;
  }

  async uploadPart(partNumber: number, value: ReadableStream | ArrayBuffer | string): Promise<R2UploadedPart> {
    const url = new URL(`${this.bucketUrl}/${encodeURIComponent(this.key)}`);
    url.searchParams.set(PART_NUMBER_VARIABLE, partNumber.toString());
    url.searchParams.set(UPLOAD_ID_VARIABLE, this.uploadId);

    const res = await this.client.fetch(url.toString(), {
      method: METHOD_PUT,
      body: value,
    });

    if (!res.ok) {
      throw new Error(`S3 UploadPart failed: ${res.status} ${await res.text()}`);
    }

    const etag = res.headers.get(HEADER_ETAG);
    if (!etag) {
      throw new Error("S3 UploadPart missing ETag");
    }

    return { partNumber, etag };
  }

  async abort(): Promise<void> {
    const url = new URL(`${this.bucketUrl}/${encodeURIComponent(this.key)}`);
    url.searchParams.set(UPLOAD_ID_VARIABLE, this.uploadId);

    const res = await this.client.fetch(url.toString(), { method: METHOD_DELETE });
    if (!res.ok) {
      throw new Error(`S3 Abort failed: ${res.status}`);
    }
  }

  async complete(uploadedParts: R2UploadedPart[]): Promise<R2Object> {
    // S3 requires parts to be sorted by PartNumber
    const sortedParts = [...uploadedParts].sort((a, b) => a.partNumber - b.partNumber);

    // Construct XML payload
    let partsXml = "";
    for (const part of sortedParts) {
      partsXml += `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${part.etag}</ETag></Part>`;
    }
    const payload = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;

    const url = new URL(`${this.bucketUrl}/${encodeURIComponent(this.key)}`);
    url.searchParams.set(UPLOAD_ID_VARIABLE, this.uploadId);

    const res = await this.client.fetch(url.toString(), {
      method: METHOD_POST,
      body: payload,
    });

    if (!res.ok) {
      throw new Error(`S3 Complete failed: ${res.status} ${await res.text()}`);
    }

    // Return a stub object representing the new file
    // Ideally, we might HEAD the object here to get true metadata, but we'll return a basic stub
    return new S3ObjectStub(
      this.key,
      new Headers({
        [HEADER_ETAG]: res.headers.get(HEADER_ETAG) || "",
        [HEADER_LAST_MODIFIED]: new Date().toUTCString(),
      })
    );
  }
}

// --- Main Bucket Class ---

export class S3Bucket implements R2Bucket {
  private client: AwsClient;
  private bucketUrl: string;

  constructor(config: S3BucketConfig) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region || "auto",
      service: "s3",
    });
    // Remove trailing slash if present
    this.bucketUrl = config.endpoint.replace(/\/$/, "");
  }

  // --- Core Operations ---

  async head(key: string): Promise<R2Object | null> {
    const url = `${this.bucketUrl}/${encodeURIComponent(key)}`;
    const res = await this.client.fetch(url, { method: METHOD_HEAD });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`S3 HEAD failed: ${res.statusText}`);
    return new S3ObjectStub(key, res.headers);
  }

  // Signature 1: With Conditional (may return R2Object/304 or Body)
  get(
    key: string,
    options: R2GetOptions & { onlyIf: R2Conditional | Headers }
  ): Promise<R2ObjectBody | R2Object | null>;

  // Signature 2: Standard Get (must return Body or null)
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;

  async get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | R2Object | null> {
    const url = `${this.bucketUrl}/${encodeURIComponent(key)}`;
    const headers = new Headers();

    // Range handling
    if (options?.range) {
      applyRange2Headers(headers, options.range);
    }

    if (options?.onlyIf) {
      applyOnlyIf2Headers(headers, options.onlyIf);
    }

    const res = await this.client.fetch(url, { method: METHOD_GET, headers });

    if (res.status === 404) {
      return null;
    }
    if (res.status === 304) {
      return new S3ObjectStub(key, res.headers); // Not Modified
    }
    if (!res.ok) {
      throw new Error(`S3 GET failed: ${res.statusText}`);
    }

    return new S3ObjectBodyStub(key, res);
  }

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | string | null,
    options?: R2PutOptions
  ): Promise<R2Object> {
    const url = `${this.bucketUrl}/${encodeURIComponent(key)}`;
    const headers = new Headers();

    if (options?.httpMetadata) {
      applyHttpMeta2Headers(headers, options.httpMetadata);
    }
    if (options?.customMetadata) {
      applyCustomMeta2Headers(headers, options.customMetadata);
    }
    if (options?.md5) {
      headers.set(HEADER_CONTENT_MD5, toString(options.md5));
    }

    const res = await this.client.fetch(url, {
      method: METHOD_PUT,
      headers,
      body: value,
    });

    if (!res.ok) {
      throw new Error(`S3 PUT failed: ${res.statusText}`);
    }

    const object = await this.head(key);
    if (!object) {
      throw new Error("can't find created object");
    }
    return object;
  }

  async delete(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    await Promise.all(
      keys.map(async (k) => {
        const url = `${this.bucketUrl}/${encodeURIComponent(k)}`;
        const res = await this.client.fetch(url, { method: METHOD_DELETE });
        // S3 returns 204 on success, 404 if not found is often treated as success in delete idempotency
        if (!res.ok && res.status !== 404) {
          throw new Error(`S3 DELETE failed for ${k}`);
        }
      })
    );
  }

  // --- List Implementation ---

  async list(options?: R2ListOptions): Promise<R2Objects> {
    const url = new URL(this.bucketUrl);
    url.searchParams.set(SEARCH_PARAM_LIST_TYPE, "2"); // Use S3 ListObjectsV2

    if (options) {
      if (options.prefix) {
        url.searchParams.set(SEARCH_PARAM_PREFIX, options.prefix);
      }
      if (options.cursor) {
        url.searchParams.set(SEARCH_PARAM_CONTINUATION_TOKEN, options.cursor);
      }
      if (options.limit) {
        url.searchParams.set(SEARCH_PARAM_MAX_KEYS, options.limit.toString());
      }
      if (options.delimiter) {
        url.searchParams.set(SEARCH_PARAM_DELIMITER, options.delimiter);
      }
    }

    const res = await this.client.fetch(url.toString(), { method: METHOD_GET });
    if (!res.ok) {
      throw new Error(`S3 LIST failed: ${res.status}`);
    }

    const xml = await res.text();

    console.log("list", xml);

    // Parse Objects
    const contents = XML.parseList(xml, XML_TAG_CONTENTS);
    const objects: R2Object[] = contents.map((block) => {
      const key = XML.parseValue(block, XML_TAG_KEY) || "";
      const size = Number(XML.parseValue(block, XML_TAG_SIZR));
      const etag = XML.parseValue(block, XML_TAG_ETAG) || "";
      const lastMod = new Date(XML.parseValue(block, XML_TAG_LAST_MODIFIED) || Date.now());

      // Note: S3 List response does not return Custom Metadata/HTTP Metadata.
      // R2 List also implies this limitation (you often have to HEAD to get full metadata).
      return new S3ObjectStub(key, new Headers(), size, lastMod, etag);
    });

    // Parse Common Prefixes (folders)
    const commonPrefixes = XML.parseList(xml, XML_TAG_COMMON_PREFIXES)
      .map((block) => XML.parseValue(block, XML_TAG_PREFIX) || "")
      .filter(Boolean);

    // Parse Pagination
    const isTruncated = XML.parseValue(xml, XML_TAG_IS_TRUNCATED) === XML_VALUE_TRUE;
    const nextCursor = XML.parseValue(xml, XML_TAG_NEXT_CONTINUATION_TOKEN);

    return {
      objects,
      truncated: isTruncated,
      cursor: nextCursor ?? "",
      delimitedPrefixes: commonPrefixes.length > 0 ? commonPrefixes : [],
    };
  }

  // --- Multipart Uploads ---

  async createMultipartUpload(key: string, options?: R2MultipartOptions): Promise<R2MultipartUpload> {
    const url = new URL(`${this.bucketUrl}/${encodeURIComponent(key)}`);
    url.searchParams.set(UPLOADS_VARIABLE, ""); // S3 initiate multipart

    const headers = new Headers();
    if (options?.httpMetadata) {
      applyHttpMeta2Headers(headers, options.httpMetadata);
    }
    if (options?.customMetadata) {
      applyCustomMeta2Headers(headers, options.customMetadata);
    }

    const res = await this.client.fetch(url.toString(), { method: METHOD_POST, headers });
    if (!res.ok) {
      throw new Error(`S3 Initiate Multipart failed: ${res.status}`);
    }

    const xml = await res.text();
    const uploadId = XML.parseValue(xml, XML_TAG_UPLOAD_ID);

    if (!uploadId) {
      throw new Error("Failed to parse UploadId from S3 response");
    }

    return new S3MultipartUpload(this.client, this.bucketUrl, key, uploadId);
  }

  resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload {
    return new S3MultipartUpload(this.client, this.bucketUrl, key, uploadId);
  }
}

function applyCustomMeta2Headers(headers: Headers, customMetadata: Record<string, string>) {
  Object.entries(customMetadata).forEach(([k, v]) => {
    headers.set(HEADER_PREFIX_X_AMAZON_META + k, v);
  });
}

function applyRange2Headers(headers: Headers, range: Headers | R2Range) {
  if (range instanceof Headers) {
    const rangeHeader = range.get(HEADER_RANGE);
    if (rangeHeader) {
      headers.set(HEADER_RANGE, rangeHeader);
    }
  } else {
    if ("offset" in range) {
      const len = range.length;
      const start = range.offset || 0;
      const end = len ? start + len - 1 : undefined;
      headers.set(HEADER_RANGE, rangeHeader(start, end));
    } else if ("suffix" in range) {
      headers.set(HEADER_RANGE, rangeHeader(-range.suffix));
    }
  }
}

function applyOnlyIf2Headers(headers: Headers, onlyIf: R2Conditional | Headers) {
  if (onlyIf instanceof Headers) {
    const ifMatch = onlyIf.get(HEADER_IF_MATCH);
    if (ifMatch) {
      headers.set(HEADER_IF_MATCH, ifMatch);
    }
    const ifNoneMatch = onlyIf.get(HEADER_IF_NONE_MATCH);
    if (ifNoneMatch) {
      headers.set(HEADER_IF_NONE_MATCH, ifNoneMatch);
    }
    const ifModifiedSince = onlyIf.get(HEADER_IF_MODIFIED_SINCE);
    if (ifModifiedSince) {
      headers.set(HEADER_IF_MODIFIED_SINCE, ifModifiedSince);
    }
    const ifUnmodifiedSince = onlyIf.get(HEADER_IF_UNMODIFIED_SINCE);
    if (ifUnmodifiedSince) {
      headers.set(HEADER_IF_UNMODIFIED_SINCE, ifUnmodifiedSince);
    }
  } else {
    if (onlyIf.etagMatches) {
      headers.set(HEADER_IF_MATCH, onlyIf.etagMatches);
    }
    if (onlyIf.etagDoesNotMatch) {
      headers.set(HEADER_IF_NONE_MATCH, onlyIf.etagDoesNotMatch);
    }
    if (onlyIf?.uploadedAfter) {
      headers.set(HEADER_IF_MODIFIED_SINCE, onlyIf.uploadedAfter.toUTCString());
    }
    if (onlyIf?.uploadedBefore) {
      headers.set(HEADER_IF_UNMODIFIED_SINCE, onlyIf.uploadedBefore.toUTCString());
    }
  }
}

function applyHttpMeta2Headers(headers: Headers, httpMetadata: Headers | R2HTTPMetadata) {
  if (httpMetadata instanceof Headers) {
    const contentType = httpMetadata.get(HEADER_CONTENT_TYPE);
    if (contentType) {
      headers.set(HEADER_CONTENT_TYPE, contentType);
    }
    const contentEncoding = httpMetadata.get(HEADER_CONTENT_ENCODING);
    if (contentEncoding) {
      headers.set(HEADER_CONTENT_ENCODING, contentEncoding);
    }
    const contentDisposition = httpMetadata.get(HEADER_CONTENT_DISPOSITION);
    if (contentDisposition) {
      headers.set(HEADER_CONTENT_DISPOSITION, contentDisposition);
    }
    const cacheControl = httpMetadata.get(HEADER_CACHE_CONTROL);
    if (cacheControl) {
      headers.set(HEADER_CACHE_CONTROL, cacheControl);
    }
  } else {
    if (httpMetadata.contentType) {
      headers.set(HEADER_CONTENT_TYPE, httpMetadata.contentType);
    }
    if (httpMetadata.contentEncoding) {
      headers.set(HEADER_CONTENT_ENCODING, httpMetadata.contentEncoding);
    }
    if (httpMetadata.contentDisposition) {
      headers.set(HEADER_CONTENT_DISPOSITION, httpMetadata.contentDisposition);
    }
    if (httpMetadata.cacheControl) {
      headers.set(HEADER_CACHE_CONTROL, httpMetadata.cacheControl);
    }
  }
}
