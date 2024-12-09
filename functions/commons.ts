export type FdCfFuncContext = EventContext<
  {
    WEBDAV_USERNAME: string;
    WEBDAV_PASSWORD: string;
    PUBLIC_PREFIX?: string;
    PUBLIC_DIR_PREFIX?: string;
    BUCKET: R2Bucket;
    KV?: KVNamespace;
    [key: string]: any;
  },
  string, // params key type
  Record<string, unknown> // data type
>;

export type FdCfFunc = (context: FdCfFuncContext) => Response | Promise<Response>;

export function joinPathSegments(path: string[]): string {
  return (path || []).map(decodeURI).join("/");
}

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

/**
 * If authentication fails, return a failure response.
 * Otherwise return null.
 * @param request
 * @param user
 * @param pass
 * @returns
 */
export function checkAuthFailure(request: Request, user: string, pass: string): Response | null {
  if (!user || !pass) {
    return new Response("WebDAV protocol is not enabled", { status: 403 });
  }

  const auth = request.headers.get("Authorization");
  if (!auth) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": `Basic realm="WebDAV"` },
    });
  }

  const expectedAuth = `Basic ${btoa(`${user}:${pass}`)}`;
  if (auth !== expectedAuth) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
