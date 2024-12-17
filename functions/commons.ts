import { KEY_PREFIX_PRIVATE } from "../lib/commons";

export type FdCfFuncContext = EventContext<
  {
    WEBDAV_USERNAME: string;
    WEBDAV_PASSWORD: string;
    PUBLIC_PREFIX?: string;
    PUBLIC_DIR_PREFIX?: string;
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
export function checkAuthFailure(request: Request, user: string, pass: string, realm = "WebDAV"): Response | null {
  if (!user && !pass) {
    return responseForbidden();
  }

  const auth = new URL(request.url).searchParams.get("auth") || request.headers.get("Authorization");
  if (!auth) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": `Basic realm="${encodeURI(realm)}"` },
    });
  }

  const expectedAuth = `Basic ${btoa(`${user}:${pass}`)}`;
  if (auth !== expectedAuth) {
    return new Response("Unauthorized", { status: 401 });
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
