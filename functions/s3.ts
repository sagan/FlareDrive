import { AwsClient } from "aws4fetch";
import { toString } from "../lib/commons";

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
    this.size = size ?? Number(headers.get("content-length") || 0);
    this.etag = etag ?? headers.get("etag") ?? "";
    // S3 Etags often come wrapped in quotes, R2 sometimes doesn't. We normalize to "raw" string if needed,
    // but usually keeping quotes is safer for If-Match headers.
    this.httpEtag = this.etag;
    this.uploaded = lastModified ?? new Date(headers.get("last-modified") || Date.now());
    this.httpMetadata = this.headersToHttpMetadata(headers);
    this.customMetadata = this.headersToCustomMetadata(headers);
    this.checksums = checksums || ({} as R2Checksums);
  }

  writeHttpMetadata(headers: Headers): void {
    if (this.httpMetadata.contentType) {
      headers.set("Content-Type", this.httpMetadata.contentType);
    }
    if (this.httpMetadata.contentLanguage) {
      headers.set("Content-Language", this.httpMetadata.contentLanguage);
    }
    if (this.httpMetadata.contentDisposition) {
      headers.set("Content-Disposition", this.httpMetadata.contentDisposition);
    }
    if (this.httpMetadata.contentEncoding) {
      headers.set("Content-Encoding", this.httpMetadata.contentEncoding);
    }
    if (this.httpMetadata.cacheControl) {
      headers.set("Cache-Control", this.httpMetadata.cacheControl);
    }
  }

  private headersToHttpMetadata(headers: Headers): R2HTTPMetadata {
    return {
      contentType: headers.get("content-type") ?? undefined,
      contentLanguage: headers.get("content-language") ?? undefined,
      contentDisposition: headers.get("content-disposition") ?? undefined,
      contentEncoding: headers.get("content-encoding") ?? undefined,
      cacheControl: headers.get("cache-control") ?? undefined,
    };
  }

  private headersToCustomMetadata(headers: Headers): Record<string, string> {
    const metadata: Record<string, string> = {};
    headers.forEach((value, key) => {
      if (key.startsWith("x-amz-meta-")) {
        metadata[key.replace("x-amz-meta-", "")] = value;
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
    url.searchParams.set("partNumber", partNumber.toString());
    url.searchParams.set("uploadId", this.uploadId);

    const res = await this.client.fetch(url.toString(), {
      method: "PUT",
      body: value,
    });

    if (!res.ok) {
      throw new Error(`S3 UploadPart failed: ${res.status} ${await res.text()}`);
    }

    const etag = res.headers.get("etag");
    if (!etag) {
      throw new Error("S3 UploadPart missing ETag");
    }

    return { partNumber, etag };
  }

  async abort(): Promise<void> {
    const url = new URL(`${this.bucketUrl}/${encodeURIComponent(this.key)}`);
    url.searchParams.set("uploadId", this.uploadId);

    const res = await this.client.fetch(url.toString(), { method: "DELETE" });
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
    url.searchParams.set("uploadId", this.uploadId);

    const res = await this.client.fetch(url.toString(), {
      method: "POST",
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
        etag: res.headers.get("etag") || "",
        "last-modified": new Date().toUTCString(),
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
    const res = await this.client.fetch(url, { method: "HEAD" });
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
      if ("offset" in options.range) {
        const len = options.range.length;
        const end = len ? (options.range.offset || 0) + len - 1 : "";
        headers.set("Range", `bytes=${options.range.offset}-${end}`);
      } else if ("suffix" in options.range) {
        headers.set("Range", `bytes=-${options.range.suffix}`);
      }
    }

    // Conditionals
    if (options?.onlyIf) {
      if (options.onlyIf instanceof Headers) {
        const ifMatch = options.onlyIf.get("If-Match");
        if (ifMatch) {
          headers.set("If-Match", ifMatch);
        }
        const ifNoneMatch = options.onlyIf.get("If-None-Match");
        if (ifNoneMatch) {
          headers.set("If-None-Match", ifNoneMatch);
        }
        const ifModifiedSince = options.onlyIf.get("If-Modified-Since");
        if (ifModifiedSince) {
          headers.set("If-Modified-Since", ifModifiedSince);
        }
        const ifUnmodifiedSince = options.onlyIf.get("If-Unmodified-Since");
        if (ifUnmodifiedSince) {
          headers.set("If-Unmodified-Since", ifUnmodifiedSince);
        }
      } else {
        if (options.onlyIf.etagMatches) {
          headers.set("If-Match", options.onlyIf.etagMatches);
        }
        if (options.onlyIf.etagDoesNotMatch) {
          headers.set("If-None-Match", options.onlyIf.etagDoesNotMatch);
        }
        if (options?.onlyIf?.uploadedAfter) {
          headers.set("If-Modified-Since", options.onlyIf.uploadedAfter.toUTCString());
        }
        if (options?.onlyIf?.uploadedBefore) {
          headers.set("If-Unmodified-Since", options.onlyIf.uploadedBefore.toUTCString());
        }
      }
    }

    const res = await this.client.fetch(url, { method: "GET", headers });

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
      if (options.httpMetadata instanceof Headers) {
        const contentType = options.httpMetadata.get("Content-Type");
        if (contentType) {
          headers.set("Content-Type", contentType);
        }
        const contentEncoding = options.httpMetadata.get("Content-Encoding");
        if (contentEncoding) {
          headers.set("Content-Encoding", contentEncoding);
        }
        const contentDisposition = options.httpMetadata.get("Content-Disposition");
        if (contentDisposition) {
          headers.set("Content-Disposition", contentDisposition);
        }
        const cacheControl = options.httpMetadata.get("Cache-Control");
        if (cacheControl) {
          headers.set("Cache-Control", cacheControl);
        }
      } else {
        if (options.httpMetadata.contentType) {
          headers.set("Content-Type", options.httpMetadata.contentType);
        }
        if (options.httpMetadata.contentEncoding) {
          headers.set("Content-Encoding", options.httpMetadata.contentEncoding);
        }
        if (options.httpMetadata.contentDisposition) {
          headers.set("Content-Disposition", options.httpMetadata.contentDisposition);
        }
        if (options.httpMetadata.cacheControl) {
          headers.set("Cache-Control", options.httpMetadata.cacheControl);
        }
      }
    }

    if (options?.customMetadata) {
      Object.entries(options.customMetadata).forEach(([k, v]) => {
        headers.set(`x-amz-meta-${k}`, v);
      });
    }

    if (options?.md5) {
      headers.set("Content-MD5", toString(options.md5));
    }

    const res = await this.client.fetch(url, {
      method: "PUT",
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
        const res = await this.client.fetch(url, { method: "DELETE" });
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
    url.searchParams.set("list-type", "2"); // Use S3 ListObjectsV2

    if (options?.prefix) {
      url.searchParams.set("prefix", options.prefix);
    }
    if (options?.cursor) {
      url.searchParams.set("continuation-token", options.cursor);
    }
    if (options?.limit) {
      url.searchParams.set("max-keys", options.limit.toString());
    }
    if (options?.delimiter) {
      url.searchParams.set("delimiter", options.delimiter);
    }

    const res = await this.client.fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      throw new Error(`S3 LIST failed: ${res.status}`);
    }

    const xml = await res.text();

    console.log("list", xml);

    // Parse Objects
    const contents = XML.parseList(xml, "Contents");
    const objects: R2Object[] = contents.map((block) => {
      const key = XML.parseValue(block, "Key") || "";
      const size = Number(XML.parseValue(block, "Size"));
      const etag = XML.parseValue(block, "ETag") || "";
      const lastMod = new Date(XML.parseValue(block, "LastModified") || Date.now());

      // Note: S3 List response does not return Custom Metadata/HTTP Metadata.
      // R2 List also implies this limitation (you often have to HEAD to get full metadata).
      return new S3ObjectStub(key, new Headers(), size, lastMod, etag);
    });

    // Parse Common Prefixes (folders)
    const commonPrefixes = XML.parseList(xml, "CommonPrefixes")
      .map((block) => XML.parseValue(block, "Prefix") || "")
      .filter(Boolean);

    // Parse Pagination
    const isTruncated = XML.parseValue(xml, "IsTruncated") === "true";
    const nextCursor = XML.parseValue(xml, "NextContinuationToken");

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
    url.searchParams.set("uploads", ""); // S3 initiate multipart

    const headers = new Headers();
    if (options?.httpMetadata) {
      // ... (Add Metadata headers same as PUT)
      if ("contentType" in options.httpMetadata && options.httpMetadata.contentType)
        headers.set("Content-Type", options.httpMetadata.contentType);
      // Add other metadata mapping here if needed
    }
    if (options?.customMetadata) {
      Object.entries(options.customMetadata).forEach(([k, v]) => headers.set(`x-amz-meta-${k}`, v));
    }

    const res = await this.client.fetch(url.toString(), { method: "POST", headers });
    if (!res.ok) {
      throw new Error(`S3 Initiate Multipart failed: ${res.status}`);
    }

    const xml = await res.text();
    const uploadId = XML.parseValue(xml, "UploadId");

    if (!uploadId) {
      throw new Error("Failed to parse UploadId from S3 response");
    }

    return new S3MultipartUpload(this.client, this.bucketUrl, key, uploadId);
  }

  resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload {
    return new S3MultipartUpload(this.client, this.bucketUrl, key, uploadId);
  }
}
