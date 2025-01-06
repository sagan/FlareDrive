import {
  HEADER_AUTH,
  HEADER_AUTHED,
  HEADER_AUTHORIZATION,
  HEADER_CONTENT_TYPE,
  HEADER_INAPP,
  isHttpsOrLocalUrl,
  MIME_DIR,
  MIME_XML,
  WEBDAV_ENDPOINT,
} from "../../lib/commons";
import { findChildren, responseNotFound } from "../commons";
import { RequestHandlerParams, ROOT_OBJECT } from "./utils";

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
    resourcetype: object.httpMetadata?.contentType === MIME_DIR ? "<collection />" : "",
    "fd:thumbnail": object.customMetadata?.thumbnail,
  };
}

export async function handleRequestPropfind({ bucket, path, request, permission, authed }: RequestHandlerParams) {
  const responseTemplate = `<?xml version="1.0" encoding="utf-8" ?>
<multistatus xmlns="DAV:" xmlns:fd="flaredrive">
{{items}}
</multistatus>`;

  let sentBackAuthHeader: string | null = null;
  if (authed && request.headers.has(HEADER_INAPP) && isHttpsOrLocalUrl(request.url)) {
    sentBackAuthHeader = request.headers.get(HEADER_AUTHORIZATION);
  }
  const fixedHeaders = {
    [HEADER_AUTHED]: `${authed ? 1 : 0}`,
    ...(sentBackAuthHeader
      ? {
          [HEADER_AUTH]: sentBackAuthHeader,
        }
      : {}),
  };

  const rootObject = path === "" ? ROOT_OBJECT : await bucket.head(path);
  if (!rootObject) {
    return responseNotFound(fixedHeaders);
  }

  const isDirectory = rootObject === ROOT_OBJECT || rootObject.httpMetadata?.contentType === MIME_DIR;
  const depth = request.headers.get("Depth") ?? "infinity";
  const children = !isDirectory ? [] : await findChildren({ bucket, path, depth });

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

  return new Response(responseTemplate.replace("{{items}}", items.join("")), {
    status: 207,
    headers: {
      [HEADER_CONTENT_TYPE]: MIME_XML,
      ...fixedHeaders,
    },
  });
}
