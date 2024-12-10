import {
  HEADER_AUTH,
  HEADER_AUTHED,
  HEADER_INAPP,
  HEADER_PERMISSION,
  isHttpsOrLocalOrigin,
  str2int,
  WEBDAV_ENDPOINT,
} from "../../lib/commons";
import { responseNotFound } from "../commons";
import { listAll, RequestHandlerParams, ROOT_OBJECT } from "./utils";

type DavProperties = {
  creationdate: string | undefined;
  displayname: string | undefined;
  getcontentlanguage: string | undefined;
  getcontentlength: string | undefined;
  getcontenttype: string | undefined;
  getetag: string | undefined;
  getlastmodified: string | undefined;
  resourcetype: string;
  "fd:thumbnail": string | undefined;
};

function fromR2Object(object: R2Object | typeof ROOT_OBJECT): DavProperties {
  return {
    creationdate: object.uploaded.toUTCString(),
    displayname: object.httpMetadata?.contentDisposition,
    getcontentlanguage: object.httpMetadata?.contentLanguage,
    getcontentlength: object.size.toString(),
    getcontenttype: object.httpMetadata?.contentType,
    getetag: object.etag,
    getlastmodified: object.uploaded.toUTCString(),
    resourcetype: object.httpMetadata?.contentType === "application/x-directory" ? "<collection />" : "",
    "fd:thumbnail": object.customMetadata?.thumbnail,
  };
}

async function findChildren({ bucket, path, depth }: { bucket: R2Bucket; path: string; depth: string }) {
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

export async function handleRequestPropfind({ bucket, path, request, permission, authed }: RequestHandlerParams) {
  const responseTemplate = `<?xml version="1.0" encoding="utf-8" ?>
<multistatus xmlns="DAV:" xmlns:fd="flaredrive">
{{items}}
</multistatus>`;

  const rootObject = path === "" ? ROOT_OBJECT : await bucket.head(path);
  if (!rootObject) {
    return responseNotFound();
  }
  const isDirectory = rootObject === ROOT_OBJECT || rootObject.httpMetadata?.contentType === "application/x-directory";
  const depth = request.headers.get("Depth") ?? "infinity";

  const children = !isDirectory
    ? []
    : await findChildren({
        bucket,
        path,
        depth,
      });

  const items = [rootObject, ...children].map((child) => {
    const properties = fromR2Object(child);
    return `
  <response>
    <href>${`${WEBDAV_ENDPOINT}${encodeURI(child.key)}`}</href>
    <propstat>
      <prop>
        ${Object.entries(properties)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => `<${key}>${value}</${key}>`)
          .join("\n")}
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>`;
  });

  let sentBackAuthHeader: string | null = null;
  if (
    authed &&
    str2int(request.headers.get(HEADER_INAPP)) &&
    isHttpsOrLocalOrigin(request.headers.get("Origin") || "")
  ) {
    sentBackAuthHeader = request.headers.get("Authorization");
  }

  return new Response(responseTemplate.replace("{{items}}", items.join("")), {
    status: 207,
    headers: {
      "Content-Type": "application/xml",
      [HEADER_PERMISSION]: `${permission}`,
      [HEADER_AUTHED]: `${authed ? 1 : 0}`,
      ...(sentBackAuthHeader
        ? {
            [HEADER_AUTH]: sentBackAuthHeader,
          }
        : {}),
    },
  });
}
