import { responseConflict, responseCreated, responseMethodNotAllowed } from "../commons";
import { RequestHandlerParams, ROOT_OBJECT } from "./utils";

export async function handleRequestMkcol({ bucket, path, request }: RequestHandlerParams) {
  // Check if the resource already exists
  const resource = await bucket.head(path);
  if (resource !== null) {
    return responseMethodNotAllowed();
  }

  // Check if the parent directory exists
  const parentPath = path.replace(/(\/|^)[^/]*$/, "");
  const parentDir = parentPath === "" ? ROOT_OBJECT : await bucket.head(parentPath);
  if (parentDir === null) {
    return responseConflict();
  }

  await bucket.put(path, "", {
    httpMetadata: { contentType: "application/x-directory" },
  });

  return responseCreated();
}
