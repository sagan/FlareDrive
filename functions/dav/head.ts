import { responseNotFound } from "../commons";
import { RequestHandlerParams } from "./utils";

export async function handleRequestHead({ bucket, path }: RequestHandlerParams) {
  const obj = await bucket.head(path);
  if (obj === null) {
    return responseNotFound();
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  return new Response(null, { headers });
}
