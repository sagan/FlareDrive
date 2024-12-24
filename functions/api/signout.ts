import { HEADER_CONTENT_TYPE } from "../../lib/commons";
import { FdCfFunc } from "../commons";

export const onRequestGet: FdCfFunc = async function (context) {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${context.env.SITENAME || "FlareDrive"}</title>
    <link rel="icon" href="/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
  </head>
  <body>
    <p>Signed out. Note: if you <a href="/">Go Back Home</a> before restarting your browser tab / window,
      you may be automatically signed in back. To make sure you are signed out, close the browser and restart it.
    </p>
  </body>
</html>
`,
    {
      status: 200,
      headers: {
        [HEADER_CONTENT_TYPE]: "text/html",
        "Clear-Site-Data": `"*"`,
      },
    }
  );
};
