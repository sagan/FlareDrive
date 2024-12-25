import {
  DOWNLOAD_VARIABLE,
  KEY_PREFIX_THUMBNAIL,
  META_VARIABLE,
  THUMBNAIL_COLOR_VARIABLE,
  THUMBNAIL_NO404_VARIABLE,
  THUMBNAIL_NOFALLBACK,
  THUMBNAIL_VARIABLE,
  str2int,
} from "@/lib/commons";
import {
  jsonResponse,
  responseForbidden,
  responseNotFound,
  responseNotModified,
  writeR2ObjectHeaders,
} from "../commons";
import { RequestHandlerParams } from "./utils";
import { fallbackIconResponse } from "./icons";

export async function handleRequestGet({ bucket, path, request, authed }: RequestHandlerParams) {
  const url = new URL(request.url);
  const searchParams = new URL(url).searchParams;
  const requestMeta = authed && !!str2int(searchParams.get(META_VARIABLE));
  const thumbnail = searchParams.get(THUMBNAIL_VARIABLE) || "";
  const thumbnailIsDigest = thumbnail.length > 1;
  const requestThumbnail = !!thumbnail && thumbnail !== "0";

  if (requestThumbnail) {
    let digest: string;
    if (thumbnailIsDigest) {
      if (!authed) {
        // must be authorized to directly access thumbnail by digest
        return responseForbidden();
      }
      digest = thumbnail;
    } else {
      const obj = await bucket.head(path);
      digest = obj?.customMetadata?.[THUMBNAIL_VARIABLE] || "";
    }
    let thumbObj: R2ObjectBody | R2Object | null = null;
    if (digest) {
      if (requestMeta) {
        thumbObj = await bucket.head(KEY_PREFIX_THUMBNAIL + digest);
      } else {
        thumbObj = await bucket.get(KEY_PREFIX_THUMBNAIL + digest, {
          onlyIf: request.headers,
          range: request.headers,
        });
      }
    }
    if (requestMeta) {
      if (!thumbObj) {
        return responseNotFound();
      }
      return jsonResponse(thumbObj);
    }
    if (!thumbObj) {
      const noFallback = !!str2int(searchParams.get(THUMBNAIL_NOFALLBACK));
      if (noFallback) {
        return responseNotFound();
      }
      const color = searchParams.get(THUMBNAIL_COLOR_VARIABLE) || "";
      const no404 = !!str2int(searchParams.get(THUMBNAIL_NO404_VARIABLE));
      return fallbackIconResponse(path, color, no404);
    }
    if (!("body" in thumbObj)) {
      return responseNotModified();
    }
    const headers = new Headers();
    writeR2ObjectHeaders(thumbObj, headers);
    // headers.set("Cache-Control", "max-age=31536000");
    return new Response(thumbObj.body, { headers });
  }

  let obj: R2ObjectBody | R2Object | null;
  if (requestMeta) {
    obj = await bucket.head(path);
  } else {
    obj = await bucket.get(path, {
      onlyIf: request.headers,
      range: request.headers,
    });
  }
  if (obj === null) {
    return responseNotFound();
  }

  if (requestMeta) {
    return jsonResponse(obj);
  }
  if (!("body" in obj)) {
    return responseNotModified();
  }
  const headers = new Headers();
  writeR2ObjectHeaders(obj, headers);
  if (str2int(searchParams.get(DOWNLOAD_VARIABLE))) {
    headers.set("Content-Disposition", "attachment");
  }
  return new Response(obj.body, { headers });
}
