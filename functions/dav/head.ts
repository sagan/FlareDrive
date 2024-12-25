import { responseNotFound, writeR2ObjectHeaders } from "../commons";
import { RequestHandlerParams } from "./utils";

export async function handleRequestHead({ bucket, path }: RequestHandlerParams) {
  const obj = await bucket.head(path);
  if (obj === null) {
    return responseNotFound();
  }

  const headers = new Headers();
  writeR2ObjectHeaders(obj, headers);
  return new Response(null, { headers });
}
