export type FdCfFunc = PagesFunction<{
  WEBDAV_USERNAME: string;
  WEBDAV_PASSWORD: string;
  WEBDAV_PUBLIC_READ?: string;
  PUBLIC_PREFIX?: string;
  BUCKET: R2Bucket;
  KV?: KVNamespace;
}>;

export function pathSegmengs2Key(path: string[]): string {
  return (path || []).map(decodeURI).join("/");
}

export function notFound() {
  return new Response("Not found", { status: 404 });
}

export function jsonResponse(obj: any) {
  return new Response(JSON.stringify(obj), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * If authentication fails, return a failure success.
 * Otherwise return null.
 * @param request
 * @param user
 * @param pass
 * @returns
 */
export function checkAuth(request: Request, user: string, pass: string): Response | null {
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
