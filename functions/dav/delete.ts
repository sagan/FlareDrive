import { responseNoContent, responseNotFound } from "../commons";
import { listAll, RequestHandlerParams } from "./utils";

export async function handleRequestDelete({ bucket, path }: RequestHandlerParams) {
  if (path !== "") {
    const obj = await bucket.head(path);
    if (obj === null) {
      return responseNotFound();
    }
    await bucket.delete(path);
    if (obj.httpMetadata?.contentType !== "application/x-directory") {
      return responseNoContent();
    }
  }

  const children = listAll(bucket, path === "" ? undefined : `${path}/`);
  for await (const child of children) {
    await bucket.delete(child.key);
  }

  return responseNoContent();
}
