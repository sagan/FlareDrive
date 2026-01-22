import { HEADER_CONTENT_TYPE, MIME_XML } from "../../lib/commons";
import { RequestHandlerParams } from "./utils";

// dummy placeholder. does nothing.
// rclone webdav backend uses PROPPATCH method to set file modified time.
export async function handleRequestProppatch({ bucket, path, request, authed }: RequestHandlerParams) {
  return new Response(
    `<?xml version="1.0"?>
<multistatus xmlns="DAV:" xmlns:fd="flaredrive" xmlns:oc="http://owncloud.org/ns">
  <response>
    <href>${request.url}</href>
    <propstat>
      <status>HTTP/1.1 200 OK</status>
      <prop></prop>
    </propstat>
  </response>
</multistatus>`,
    {
      headers: {
        [HEADER_CONTENT_TYPE]: MIME_XML,
      },
    }
  );
}
