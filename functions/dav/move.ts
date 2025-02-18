import { RequestHandlerParams } from "./utils";
import { handleRequestCopy } from "./copy";
import { handleRequestDelete } from "./delete";

export async function handleRequestMove({ bucket, path, request, context, scope, authed }: RequestHandlerParams) {
  const response = await handleRequestCopy({ bucket, path, request, context, scope, authed });
  if (response.status >= 400) {
    return response;
  }
  return handleRequestDelete({ bucket, path, request, context, scope, authed }, true);
}
