import {
  HEADER_AUTH,
  HEADER_AUTHED,
  HEADER_AUTHORIZATION,
  HEADER_CONTENT_TYPE,
  HEADER_DEPTH,
  HEADER_INAPP,
  MIME_XML,
  WEBDAV_ENDPOINT,
  ROOT_OBJECT,
  isHttpsOrLocalUrl,
  isDirectory,
  getR2FileMd5,
  getR2FileSha1,
  getR2FileSha256,
  R2ObjectAlike,
} from "../../lib/commons";
import { findChildren, responseNotFound } from "../commons";
import { RequestHandlerParams } from "./utils";

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
  "fd:url": string | undefined;
  "fd:comment": string | undefined;
  "oc:checksums": string | undefined;
};

function fromR2Object(object: R2ObjectAlike): DavProperties {
  // owncloud compatible checksum fields
  const checksumData: string[] = [];
  const md5 = getR2FileMd5(object);
  const sha1 = getR2FileSha1(object);
  const sha256 = getR2FileSha256(object);
  if (md5) {
    checksumData.push(`MD5:${md5}`);
  }
  if (sha1) {
    checksumData.push(`SHA1:${sha1}`);
  }
  if (sha256) {
    checksumData.push(`SHA256:${sha256}`);
  }
  const checksums = `<oc:checksum>${checksumData.join(" ")}</oc:checksum>`;
  return {
    creationdate: object.uploaded.toUTCString(),
    displayname: object.httpMetadata?.contentDisposition,
    getcontentlanguage: object.httpMetadata?.contentLanguage,
    getcontentlength: object.size.toString(),
    getcontenttype: object.httpMetadata?.contentType,
    getetag: object.etag,
    getlastmodified: object.uploaded.toUTCString(),
    resourcetype: isDirectory(object) ? "<collection />" : "",
    "fd:thumbnail": object.customMetadata?.thumbnail,
    "fd:url": object.customMetadata?.url,
    "fd:comment": object.customMetadata?.comment,
    "oc:checksums": checksums,
  };
}

export async function handleRequestPropfind({ context, bucket, path, request, authed }: RequestHandlerParams) {
  const responseTemplate = `<?xml version="1.0" encoding="utf-8" ?>
<multistatus xmlns="DAV:" xmlns:fd="flaredrive" xmlns:oc="http://owncloud.org/ns">
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

  let rootObject: R2ObjectAlike | R2Object | null;
  if (path === "" || path === "/") {
    rootObject = ROOT_OBJECT;
  } else {
    if (!path.endsWith("/")) {
      path += "/";
    }
    rootObject = await bucket.head(path);
    // prior v0.1.17 save "dir" file name without trailing "/". keep compatible for now.
    if (!rootObject) {
      rootObject = await bucket.head(path.slice(0, -1));
    }
  }
  if (!rootObject) {
    return responseNotFound(fixedHeaders);
  }

  const isDir = isDirectory(rootObject);
  const depth = request.headers.get(HEADER_DEPTH) ?? "infinity";
  const children = !isDir ? [] : await findChildren({ bucket, path, depth, db: context.env.DB });

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
