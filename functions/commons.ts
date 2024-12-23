<<<<<<< HEAD
import {
  KEY_PREFIX_PRIVATE,
  KEY_PREFIX_THUMBNAIL,
  sha256Blob,
  hmacSha256Verify,
  key2Path,
  str2int,
} from "../lib/commons";
=======
import { KEY_PREFIX_PRIVATE, hmacSha256Verify, str2int } from "../lib/commons";
>>>>>>> 0bc506bbba11926acd1c7bcfad8f8556d465964c

export type FdCfFuncContext = EventContext<
  {
    WEBDAV_USERNAME: string;
    WEBDAV_PASSWORD: string;
    PUBLIC_PREFIX?: string;
    PUBLIC_DIR_PREFIX?: string;
    /**
     * optional bucket public access url with trailing /, e.g. "http://bucket-secret.example.com/".
     * It is suggested to keep this url secret (choose a private & complex custom sub domain).
     * It's only used by functions/* and will not be leaked to front end.
     */
    BUCKET_URL?: string;
    SITENAME?: string;
    BUCKET: R2Bucket;
    KV?: KVNamespace;
    [key: string]: any;
  },
  string, // params key type
  Record<string, unknown> // data type
>;

export type FdCfFunc = (context: FdCfFuncContext) => Response | Promise<Response>;

/**
 * Return 404 Not Found response
 */
export function responseNotFound(): Response {
  return new Response("Not found", { status: 404 });
}

/**
 * Return 412 Precondition Failed response
 */
export function responsePreconditionsFailed(): Response {
  return new Response("Preconditions failed", { status: 412 });
}

/**
 * Return 400 bad request response
 * @param msg optional http body message, default to "Bad Request"
 */
export function responseBadRequest(msg?: string): Response {
  return new Response(msg || "Bad request", { status: 400 });
}

/**
 * Return 409 Conflict response
 */
export function responseConflict(): Response {
  return new Response("Conflict", { status: 409 });
}

/**
 * Return 204 No Content response
 */
export function responseNoContent(): Response {
  return new Response(null, { status: 204 });
}

/**
 * Return 201 Created response
 */
export function responseCreated(): Response {
  return new Response("", { status: 201 });
}

/**
 * Return 403 Forbidden response
 */
export function responseForbidden(msg?: string): Response {
  return new Response(msg || "Forbidden", { status: 403 });
}

/**
 * Return 302 Found redirection response
 * @param url
 */
export function responseRedirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
    },
  });
}

/**
 * Return 405 Method Not Allowed response
 */
export function responseMethodNotAllowed(): Response {
  return new Response("Method not allowed", { status: 405 });
}

export function jsonResponse(obj: any) {
  return new Response(JSON.stringify(obj), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function htmlResponse(html: string) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}

/**
 * If authentication fails, return a failure response.
 * Otherwise return null.
 * @param request
 * @param user
 * @param pass
 * @returns
 */
export async function checkAuthFailure(
  request: Request,
  user: string,
  pass: string,
  realm = "WebDAV"
): Promise<Response | null> {
  if (!user && !pass) {
    return responseForbidden();
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const auth = searchParams.get("auth") || request.headers.get("Authorization");
  const token = searchParams.get("token");
  const expectedAuth = `Basic ${btoa(`${user}:${pass}`)}`;
  let authed = false;

  if (token) {
    const expires = str2int(searchParams.get("expires"));
    if (expires <= 0 || expires > +new Date()) {
      searchParams.delete("token");
      searchParams.sort();
      const payload = url.pathname + (searchParams.size ? "?" : "") + searchParams.toString();
      authed = await hmacSha256Verify(expectedAuth, token, payload);
    }
  } else {
    authed = auth === expectedAuth;
  }

  if (!authed) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": `Basic realm="${encodeURI(realm)}"` },
    });
  }
  return null;
}

export async function* listAll(bucket: R2Bucket, prefix?: string, isRecursive: boolean = false) {
  let cursor: string | undefined = undefined;
  do {
    var r2Objects = await bucket.list({
      prefix: prefix,
      delimiter: isRecursive ? undefined : "/",
      cursor: cursor,
      // @ts-ignore
      include: ["httpMetadata", "customMetadata"],
    });

    for await (const obj of r2Objects.objects) {
      if (!obj.key.startsWith(KEY_PREFIX_PRIVATE)) {
        yield obj;
      }
    }
    if (r2Objects.truncated) {
      cursor = r2Objects.cursor;
    }
  } while (r2Objects.truncated);
}

export async function findChildren({ bucket, path, depth }: { bucket: R2Bucket; path: string; depth: string }) {
  if (!["1", "infinity"].includes(depth)) {
    return [];
  }
  const objects: Array<R2Object> = [];

  const prefix = path === "" ? path : `${path}/`;
  for await (const object of listAll(bucket, prefix, depth === "infinity")) {
    objects.push(object);
  }

  return objects;
}

export async function generateFileThumbnail({
  auth,
  bucket,
  key,
  force,
  urlPrefix,
  thumbSize,
}: {
  auth?: string;
  bucket: R2Bucket;
  key: string;
  force?: boolean;
  urlPrefix: string;
  thumbSize: number;
}): Promise<number> {
  if (!key) {
    return 1;
  }
  const file = await bucket.get(key);
  if (!file || !file.httpMetadata?.contentType?.startsWith("image/")) {
    return 2;
  }
  let thumbFile: R2Object | null = null;
  if (file.customMetadata?.thumbnail) {
    const thumbKey = KEY_PREFIX_THUMBNAIL + file.customMetadata?.thumbnail;
    thumbFile = await bucket.head(thumbKey);
    if (thumbFile && !force) {
      return 3;
    }
  }
  const fileUrl = `${urlPrefix}${key2Path(key)}`;
  const thumbResponse = await fetch(fileUrl, {
    headers: {
      ...(auth ? { Authorization: auth } : {}),
    },
    cf: { image: { width: thumbSize, height: thumbSize } },
  });
  if (!thumbResponse.ok) {
    throw new Error(`status=${thumbResponse.status}`);
  }
  let thumbResponseSize = str2int(thumbResponse.headers.get("Content-Length"));
  if (!thumbResponseSize || thumbResponseSize >= file.size) {
    return 4;
  }
  const thumbContents = await thumbResponse.blob();
  const thumbContentsDigest = await sha256Blob(thumbContents);
  if (thumbFile && file.customMetadata?.thumbnail === thumbContentsDigest) {
    // new thumbnail file is same as old
    return 5;
  }
  // The only way to modify object metadata is to re-upload the object and set the metadata.
  await bucket.put(KEY_PREFIX_THUMBNAIL + thumbContentsDigest, thumbContents, { httpMetadata: thumbResponse.headers });
  await bucket.put(key, file.body, {
    httpMetadata: file.httpMetadata,
    customMetadata: Object.assign({}, file.customMetadata, { thumbnail: thumbContentsDigest }),
  });
  if (thumbFile) {
    // delete old thumbnail file
    await bucket.delete(thumbFile.key);
  }
  return 0;
}
