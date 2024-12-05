import { responseNotFound, responsePreconditionsFailed } from "../commons";
import { RequestHandlerParams } from "./utils";

export async function handleRequestGet({ bucket, path, request }: RequestHandlerParams) {
  const obj = await bucket.get(path, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (obj === null) {
    return responseNotFound();
  }
  if (!("body" in obj)) {
    return responsePreconditionsFailed();
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  if (path.startsWith("_$flaredrive$/thumbnails/")) {
    headers.set("Cache-Control", "max-age=31536000");
  }
  return new Response(obj.body, { headers });
}
