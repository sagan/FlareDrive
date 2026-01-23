// share file api
import { matchPattern } from "browser-extension-url-match";
import {
  type ShareObject,
  SHARE_META_VARIABLE,
  HEADER_REFERER,
  HTML_VARIABLE,
  INDEX_FILE,
  INDEX_CGI,
  RAW_VARIABLE,
  JSON_VARIABLE,
  PAST_TIMESTAMP,
  EXT_CGI,
  MIME_DEFAULT,
  FALLBACK_CGI,
  FALLBACK_HTML,
  METHOD_POST,
  METHOD_GET,
  METHOD_DELETE,
  METHOD_PUT,
  METHOD_OPTIONS,
  HEADER_ACCESS_CONTROL_ALLOW_ORIGIN,
  HEADER_ACCESS_CONTROL_ALLOW_METHODS,
  HEADER_ACCESS_CONTROL_ALLOW_HEADERS,
  HEADER_ACCESS_CONTROL_MAX_AGE,
  ACCESS_CONTROL_MAX_AGE_MAXIMUM,
  ACCESS_CONTROL_ALLOW_ORIGIN_ALL,
  ACCESS_CONTROL_ALLOW_METHODS_ALL,
  ACCESS_CONTROL_ALLOW_HEADERS_ALL,
  ACCESS_CONTROL_ALLOW_METHODS_READ,
  trimPrefix,
  ShareRefererMode,
  trimSuffix,
  cut,
  str2int,
  humanReadableSize,
  validateAndGetSafeUrl,
  removeZeroFields,
  str2Html,
  getR2FileMd5,
  basename,
} from "../../lib/commons";
import { isDirectory, isUrlFile } from "../../lib/mime";
import {
  checkAuthFailure,
  jsonResponse,
  responseNotFound,
  responseNoContent,
  responseBadRequest,
  findChildren,
  htmlResponse,
  responseForbidden,
  responseRedirect,
  outputR2Object,
  FdCfFuncContextEnv,
  FdCfFuncContextRequest,
  getPathArray,
  responseMethodNotAllowed,
  getOnRequestHead,
  FdCfFuncContext,
} from "../commons";
import buildVariables from "../../build_config.json";
import { README_FILES } from "../../src/commons";
import { executeCgi } from "../cgi";
import { getStorage } from "../storage";

const SHARE_KEY_PREFIX = "s_";

const CSS = `* {
  word-wrap: break-word;
  word-break: break-all;
}
pre {
  white-space: break-spaces;
}
`;

/**
 * Share administration handlers
 */
export interface ShareHandlerContext {
  env: FdCfFuncContextEnv & { KV: KVNamespace }; // here the KV always exists
  request: FdCfFuncContextRequest;
  shareKey: string;
}

// POST: list shares. shareKey (can be "") as prefix.
async function handlePostShare({ env, shareKey }: ShareHandlerContext) {
  const data = await env.KV.list({ prefix: SHARE_KEY_PREFIX + shareKey });
  const shares = data.keys.map(({ name }) => trimPrefix(name, SHARE_KEY_PREFIX));
  return jsonResponse(shares);
}

// PUT: add a new or update a existing share
async function handlePutShare({ env, request, shareKey }: ShareHandlerContext) {
  const newShare = removeZeroFields(await request.json<ShareObject>());
  if (!newShare.key) {
    return responseBadRequest();
  }
  if (!shareKey) {
    return responseBadRequest();
  }
  const options: KVNamespacePutOptions = {};
  if (newShare.autoDelete && newShare.expiration && newShare.expiration !== PAST_TIMESTAMP) {
    options.expiration = Math.round(newShare.expiration / 1000);
  }
  await env.KV.put(SHARE_KEY_PREFIX + shareKey, JSON.stringify(newShare), options);
  return responseNoContent();
}

// DELETE: delete a new share
async function handleDeleteShare({ env, shareKey }: ShareHandlerContext): Promise<Response> {
  await env.KV.delete(SHARE_KEY_PREFIX + shareKey);
  return responseNoContent();
}

// GET (with meta=1 query param): get share object.
async function handleGetShareMeta({ env, shareKey }: ShareHandlerContext): Promise<Response> {
  const share = (await env.KV.get(SHARE_KEY_PREFIX + shareKey, "json")) as ShareObject | null;
  return jsonResponse(share);
}

const HANDLERS: Record<string, (context: ShareHandlerContext) => Promise<Response>> = {
  [METHOD_GET]: handleGetShareMeta,
  [METHOD_POST]: handlePostShare,
  [METHOD_PUT]: handlePutShare,
  [METHOD_DELETE]: handleDeleteShare,
};

export async function onRequest(context: FdCfFuncContext): Promise<Response> {
  const { request, env } = context;
  if (!env.KV) {
    return responseNotFound();
  }
  const url = new URL(request.url);
  const bucket = getStorage(env);

  const searchParams = new URLSearchParams(url.search);
  const requestMeta = !!str2int(searchParams.get(SHARE_META_VARIABLE));

  const pathParams = getPathArray(context);
  let path = pathParams.join("/");
  if (path && url.pathname.endsWith("/")) {
    path += "/";
  }
  const shareKey = pathParams[0] || "";
  let relpath = pathParams.slice(1).join("/");
  if (relpath && path.endsWith("/")) {
    relpath += "/";
  }
  // only admin POST (list share) request allow empty shareKey.
  if (!shareKey && (!requestMeta || request.method !== METHOD_POST)) {
    return responseBadRequest();
  }

  // share administration
  if (!relpath && requestMeta) {
    const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
    if (failResponse) {
      return failResponse;
    }
    const handler = HANDLERS[request.method];
    if (handler) {
      return handler({ env: env as ShareHandlerContext["env"], request, shareKey });
    }
    return responseMethodNotAllowed();
  }

  const share = (await env.KV.get(SHARE_KEY_PREFIX + shareKey, "json")) as ShareObject | null;
  if (requestMeta) {
    return jsonResponse(share);
  }

  return handleShare({ env: env as ShareHandlerContext["env"], request, shareKey, bucket, url, relpath, share });
}

export async function handleShare({
  env,
  request,
  shareKey,
  url,
  bucket,
  relpath,
  share,
}: ShareHandlerContext & { url: URL; bucket: R2Bucket; relpath: string; share?: ShareObject | null }) {
  const requestJson = !!str2int(url.searchParams.get(JSON_VARIABLE));
  const requestHtml = !!str2int(url.searchParams.get(HTML_VARIABLE));
  const requestRaw = !!str2int(url.searchParams.get(RAW_VARIABLE));

  if (share === undefined) {
    share = (await env.KV.get(SHARE_KEY_PREFIX + shareKey, "json")) as ShareObject | null;
  }
  if (!share?.key || (share.expiration && share.expiration < Date.now())) {
    return responseNotFound();
  }
  if (share.auth) {
    const [user, pass] = cut(share.auth, ":");
    const [failRespose] = await checkAuthFailure(request, user, pass, `Share/${shareKey}`);
    if (failRespose) {
      return failRespose;
    }
  }
  if (share.refererMode) {
    const referList = share.refererList || [];
    const referer = request.headers.get(HEADER_REFERER) || "";
    const referMatch = referer ? matchPatternsWithUrl(referList, referer) : !!share.refererModeEmpty;
    let block = false;
    switch (share.refererMode) {
      case ShareRefererMode.WhitelistMode:
        block = !referMatch;
        break;
      case ShareRefererMode.BlackListMode:
        block = referMatch;
        break;
      default:
        block = true;
        break;
    }
    if (block) {
      return responseForbidden();
    }
  }

  if (!share.key.endsWith("/") && relpath) {
    return responseNotFound();
  }

  const fullHtml = !!share.fullHtml;
  const cors = !!share.cors;

  if (request.method === METHOD_OPTIONS) {
    return responseNoContent({
      [HEADER_ACCESS_CONTROL_ALLOW_METHODS]: share.cgi
        ? ACCESS_CONTROL_ALLOW_METHODS_ALL
        : ACCESS_CONTROL_ALLOW_METHODS_READ,
      ...(cors
        ? {
            [HEADER_ACCESS_CONTROL_ALLOW_ORIGIN]: ACCESS_CONTROL_ALLOW_ORIGIN_ALL,
            [HEADER_ACCESS_CONTROL_ALLOW_HEADERS]: ACCESS_CONTROL_ALLOW_HEADERS_ALL,
            [HEADER_ACCESS_CONTROL_MAX_AGE]: ACCESS_CONTROL_MAX_AGE_MAXIMUM,
          }
        : {}),
    });
  }

  const filekey = share.key + relpath;
  if (!share.cgi && filekey.endsWith(EXT_CGI)) {
    return responseForbidden();
  }
  let obj = await bucket.get(filekey, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (!obj && filekey.endsWith("/")) {
    // be compatible with prior v0.1.17: dir object doesn't end with "/".
    obj = await bucket.get(filekey.slice(0, -1), {
      onlyIf: request.headers,
      range: request.headers,
    });
  }
  if (!obj) {
    if (share.key.endsWith("/") && relpath) {
      if (share.cgi) {
        const fallbackCgi = await bucket.get(share.key + FALLBACK_CGI);
        if (fallbackCgi) {
          return executeCgi(request, await fallbackCgi.text(), fullHtml, cors, share.env);
        }
      }
      if (request.method === METHOD_GET) {
        const fallbackHtml = await bucket.get(share.key + FALLBACK_HTML);
        if (fallbackHtml) {
          return outputR2Object({ obj: fallbackHtml, fullHtml, cors, html: requestHtml, raw: requestRaw });
        }
      }
    }
    return responseNotFound();
  }

  if (isDirectory(obj)) {
    if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
      return responseRedirect(url.href);
    }
    if (share.cgi) {
      const indexCgiObj =
        (await bucket.get(filekey + (!filekey.endsWith("/") ? "/" : "") + INDEX_CGI)) ||
        (await bucket.get(share.key + FALLBACK_CGI));
      if (indexCgiObj) {
        return executeCgi(request, await indexCgiObj.text(), fullHtml, cors, share.env);
      }
    }

    if (request.method !== METHOD_GET) {
      return responseNotFound();
    }

    const indexHtmlObj =
      (await bucket.get(filekey + (!filekey.endsWith("/") ? "/" : "") + INDEX_FILE, {
        onlyIf: request.headers,
        range: request.headers,
      })) || (await bucket.get(share.key + FALLBACK_HTML));
    if (indexHtmlObj) {
      return outputR2Object({ obj: indexHtmlObj, cors, fullHtml });
    }
    const sitename = buildVariables.sitename;
    const description = share.desc || "";

    let readme = "";
    for (const readmeFileName of README_FILES) {
      const readmeFileKey = `${obj.key}${!obj.key.endsWith("/") ? "/" : ""}${readmeFileName}`;
      const readmeFile = await bucket.get(readmeFileKey);
      if (readmeFile) {
        const contents = await readmeFile.text();
        readme = await str2Html(contents, readmeFile.httpMetadata?.contentType);
        break;
      }
    }
    if (share.noindex) {
      if (relpath) {
        return responseNotFound();
      } else {
        return htmlResponse(noindexPage(sitename, description, shareKey, readme));
      }
    }
    let files = await findChildren({
      bucket,
      path: filekey,
      depth: "1",
      db: env.DB,
    });
    files = files.map((file) =>
      file.key.endsWith(EXT_CGI)
        ? ({
            key: file.key,
            etag: "",
            httpEtag: "",
            version: "",
            storageClass: "",
            size: 0,
            uploaded: new Date(0),
            checksums: {},
            httpMetadata: { contentType: MIME_DEFAULT },
          } as R2Object)
        : file
    );
    // Pre-sort files: directories first, then by name
    files.sort((a, b) => {
      const aIsDir = isDirectory(a);
      const bIsDir = isDirectory(b);
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.key.split("/").pop()!.localeCompare(b.key.split("/").pop()!);
    });

    if (requestJson) {
      const prefix = trimSuffix(share.key, "/") + "/";
      const items = files.map((file) => ({ ...file, key: trimPrefix(file.key, prefix) }));
      return jsonResponse({ sitename, description, files: items, readme }, { cors });
    }
    return htmlResponse(
      indexPage(sitename, description, shareKey + (relpath ? "/" + relpath : ""), !relpath, files, readme)
    );
  } else if (url.pathname.endsWith("/")) {
    // target is file, but the request path ends with "/"
    return responseNotFound();
  }

  if (share.cgi && filekey.endsWith(EXT_CGI) && "body" in obj) {
    return executeCgi(request, await obj.text(), fullHtml, cors, share.env);
  }

  if (request.method !== METHOD_GET) {
    return responseNotFound();
  }

  return outputR2Object({ obj, fullHtml, cors, html: requestHtml, raw: requestRaw });
}

function noindexPage(sitename: string, desc: string, dir: string, readme: string): string {
  const title = `${dir} - ${sitename}`;
  // from Chrome file:// url dir index page
  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
  <head>
    <meta charset="utf-8">
    <title>${encodeHtml(title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="google" value="notranslate">
    <meta name="referrer" content="no-referrer" />
    <link rel="icon" href="/assets/favicon.png" />
    <style>
${CSS}
    </style>
  </head>
  <body>
    <h1>Index of ${encodeHtml(dir)}</h1>
    ${desc ? `<div>${desc}</div>` : ""}
    <p>Dir index is disabled for this folder. Append the file relative path to url directly to access it.</p>
    ${readme ? `<h2>README</h2><div>${readme}</div>` : ""}
  </body>
</html>
`;
}

function indexPage(
  sitename: string,
  desc: string,
  dir: string,
  isRoot: boolean,
  items: R2Object[],
  readme: string
): string {
  const title = `${dir} - ${sitename}`;
  // from Chrome file:// url dir index page

  const parentDirLinkHtml = !isRoot
    ? `
    <div id="parentDirLinkBox">
      <a href=".." class="icon up">
        <span>[parent directory]</span>
      </a>
    </div>`
    : "";

  const tableRowsHtml = items
    .map((item) => {
      const name = basename(item.key);
      const isDir = isDirectory(item);
      const href =
        isUrlFile(item) && item.customMetadata?.url
          ? validateAndGetSafeUrl(item.customMetadata.url)
          : encodeURIComponent(name) + (isDir ? "/" : ""); // Relative href
      const displayName = encodeHtml(name) + (isDir ? "/" : "");
      const sizeDisplay = !isDir ? humanReadableSize(item.size) : "";
      const dateDisplay = item.uploaded.toISOString().slice(0, 19) + "Z";
      const mimeDisplay = encodeHtml(item.httpMetadata?.contentType || "");
      const md5Display = !isDir ? getR2FileMd5(item) : "";
      const commentDisplay = encodeHtml(item.customMetadata?.comment || "");

      return `
        <tr>
          <td data-value="${encodeHtml(name)}"><a href="${href}" rel="noopener noreferrer" class="icon ${
        isDir ? "dir" : "file"
      }">${displayName}</a></td>
          <td class="detailsColumn" data-value="${item.size}">${sizeDisplay}</td>
          <td class="detailsColumn" data-value="${+item.uploaded}">${dateDisplay}</td>
          <td class="detailsColumn" data-value="${mimeDisplay}">${mimeDisplay}</td>
          <td class="detailsColumn" data-value="${md5Display}">${md5Display}</td>
          <td class="commentColumn">${commentDisplay}</td>
        </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>

<html dir="ltr" lang="en">

<head>
<meta charset="utf-8">
<title>${encodeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark">
<meta name="google" value="notranslate">
<meta name="referrer" content="no-referrer" />
<link rel="icon" href="/assets/favicon.png" />
<style>
${CSS}
</style>

<script>
function sortTable(column) {
  var theader = document.getElementById("theader");
  var oldOrder = theader.cells[column].dataset.order || '1';
  oldOrder = parseInt(oldOrder, 10)
  var newOrder = 0 - oldOrder;
  theader.cells[column].dataset.order = newOrder;

  var tbody = document.getElementById("tbody");
  var rows = tbody.rows;
  var list = [], i;
  for (i = 0; i < rows.length; i++) {
    list.push(rows[i]);
  }

  list.sort(function(row1, row2) {
    const aIsDir = row1.cells[0].querySelector('a').classList.contains('dir');
    const bIsDir = row2.cells[0].querySelector('a').classList.contains('dir');

    if (aIsDir && !bIsDir) {
      return -1; // Directories always come first
    }
    if (!aIsDir && bIsDir) {
      return 1;  // Files always come after directories
    }

    var a = row1.cells[column].dataset.value;
    var b = row2.cells[column].dataset.value;
    if (column === 1 || column === 2) { // Size or Date (timestamp)
      a = parseInt(a, 10);
      b = parseInt(b, 10);
      return a > b ? newOrder : a < b ? oldOrder : 0;
    }

   // Column 0 (Name), 3 (MIME), 4 (MD5) is text.
    if (a.toLowerCase() > b.toLowerCase())
      return newOrder;
    if (a.toLowerCase() < b.toLowerCase())
      return oldOrder;
    return 0;
  });

  // Appending an existing child again just moves it.
  for (i = 0; i < list.length; i++) {
    tbody.appendChild(list[i]);
  }
}

// Add event handlers to column headers.
function addHandlers(element, column) {
  element.onclick = (e) => sortTable(column);
  element.onkeydown = (e) => {
    if (e.key == 'Enter' || e.key == ' ') {
      sortTable(column);
      e.preventDefault();
    }
  };
}

function onLoad() {
  addHandlers(document.getElementById('nameColumnHeader'), 0);
  addHandlers(document.getElementById('sizeColumnHeader'), 1);
  addHandlers(document.getElementById('dateColumnHeader'), 2);
  addHandlers(document.getElementById('mimeColumnHeader'), 3);
  addHandlers(document.getElementById('md5ColumnHeader'), 4);
}

window.addEventListener('DOMContentLoaded', onLoad);
</script>

<style>
  h1 {
    border-bottom: 1px solid #c0c0c0;
    margin-bottom: 10px;
    padding-bottom: 10px;
    white-space: nowrap;
  }

  table {
    border-collapse: collapse;
    /* width: 100%; */
  }

  th {
    cursor: pointer;
    text-align: left;
  }

  .detailsColumn {
    padding-inline-start: 2em;
    text-align: end;
    white-space: nowrap;
  }

  .commentColumn {
    padding-inline-start: 2em;
    text-align: start;
  }

  td, th {
    padding: 5px;
  }

  a.icon {
    padding-inline-start: 1.5em;
    text-decoration: none;
    user-select: auto;
  }

  a.icon:hover {
    text-decoration: underline;
  }

  a.file {
    background : url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAABnRSTlMAAAAAAABupgeRAAABEElEQVR42nRRx3HDMBC846AHZ7sP54BmWAyrsP588qnwlhqw/k4v5ZwWxM1hzmGRgV1cYqrRarXoH2w2m6qqiqKIR6cPtzc3xMSML2Te7XZZlnW7Pe/91/dX47WRBHuA9oyGmRknzGDjab1ePzw8bLfb6WRalmW4ip9FDVpYSWZgOp12Oh3nXJ7nxoJSGEciteP9y+fH52q1euv38WosqA6T2gGOT44vry7BEQtJkMAMMpa6JagAMcUfWYa4hkkzAc7fFlSjwqCoOUYAF5RjHZPVCFBOtSBGfgUDji3c3jpibeEMQhIMh8NwshqyRsBJgvF4jMs/YlVR5KhgNpuBLzk0OcUiR3CMhcPaOzsZiAAA/AjmaB3WZIkAAAAASUVORK5CYII=") left top no-repeat;
  }

  a.dir {
    background : url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABt0lEQVR42oxStZoWQRCs2cXdHTLcHZ6EjAwnQWIkJyQlRt4Cd3d3d1n5d7q7ju1zv/q+mh6taQsk8fn29kPDRo87SDMQcNAUJgIQkBjdAoRKdXjm2mOH0AqS+PlkP8sfp0h93iu/PDji9s2FzSSJVg5ykZqWgfGRr9rAAAQiDFoB1OfyESZEB7iAI0lHwLREQBcQQKqo8p+gNUCguwCNAAUQAcFOb0NNGjT+BbUC2YsHZpWLhC6/m0chqIoM1LKbQIIBwlTQE1xAo9QDGDPYf6rkTpPc92gCUYVJAZjhyZltJ95f3zuvLYRGWWCUNkDL2333McBh4kaLlxg+aTmyL7c2xTjkN4Bt7oE3DBP/3SRz65R/bkmBRPGzcRNHYuzMjaj+fdnaFoJUEdTSXfaHbe7XNnMPyqryPcmfY+zURaAB7SHk9cXSH4fQ5rojgCAVIuqCNWgRhLYLhJB4k3iZfIPtnQiCpjAzeBIRXMA6emAqoEbQSoDdGxFUrxS1AYcpaNbBgyQBGJEOnYOeENKR/iAd1npusI4C75/c3539+nbUjOgZV5CkAU27df40lH+agUdIuA/EAgDmZnwZlhDc0wAAAABJRU5ErkJggg==") left top no-repeat;
  }

  a.up {
    background : url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACM0lEQVR42myTA+w1RxRHz+zftmrbdlTbtq04qRGrCmvbDWp9tq3a7tPcub8mj9XZ3eHOGQdJAHw77/LbZuvnWy+c/CIAd+91CMf3bo+bgcBiBAGIZKXb19/zodsAkFT+3px+ssYfyHTQW5tr05dCOf3xN49KaVX9+2zy1dX4XMk+5JflN5MBPL30oVsvnvEyp+18Nt3ZAErQMSFOfelCFvw0HcUloDayljZkX+MmamTAMTe+d+ltZ+1wEaRAX/MAnkJdcujzZyErIiVSzCEvIiq4O83AG7LAkwsfIgAnbncag82jfPPdd9RQyhPkpNJvKJWQBKlYFmQA315n4YPNjwMAZYy0TgAweedLmLzTJSTLIxkWDaVCVfAbbiKjytgmm+EGpMBYW0WwwbZ7lL8anox/UxekaOW544HO0ANAshxuORT/RG5YSrjlwZ3lM955tlQqbtVMlWIhjwzkAVFB8Q9EAAA3AFJ+DR3DO/Pnd3NPi7H117rAzWjpEs8vfIqsGZpaweOfEAAFJKuM0v6kf2iC5pZ9+fmLSZfWBVaKfLLNOXj6lYY0V2lfyVCIsVzmcRV9Y0fx02eTaEwhl2PDrXcjFdYRAohQmS8QEFLCLKGYA0AeEakhCCFDXqxsE0AQACgAQp5w96o0lAXuNASeDKWIvADiHwigfBINpWKtAXJvCEKWgSJNbRvxf4SmrnKDpvZavePu1K/zu/due1X/6Nj90MBd/J2Cic7WjBp/jUdIuA8AUtd65M+PzXIAAAAASUVORK5CYII=") left top no-repeat;
  }

  html[dir=rtl] a {
    background-position-x: right;
  }

  #parentDirLinkBox {
    margin-bottom: 10px;
    padding-bottom: 10px;
  }
</style>

<title id="title"></title>

</head>

<body>
<h1>Index of ${encodeHtml(dir)} (<a href="?json=1">JSON</a>)</h1>
${desc ? `<div>${encodeHtml(desc)}</div>` : ""}
${parentDirLinkHtml}

<table>
  <thead>
    <tr class="header" id="theader">
      <th id="nameColumnHeader" tabindex=0 role="button">Name</th>
      <th id="sizeColumnHeader" class="detailsColumn" tabindex=0 role="button">
        Size
      </th>
      <th id="dateColumnHeader" class="detailsColumn" tabindex=0 role="button">
        Date Modified
      </th>
      <th id="mimeColumnHeader" class="detailsColumn" tabindex=0 role="button">
        MIME
      </th>
      <th id="md5ColumnHeader" class="detailsColumn" tabindex=0 role="button">
        MD5
      </th>
      <th id="commentColumnHeader" class="commentColumn" tabindex=0 role="button">
        Comment
      </th>
    </tr>
  </thead>
  <tbody id="tbody">
    ${tableRowsHtml}
  </tbody>
</table>
${readme ? `<h2>README</h2><div>${readme}</div>` : ""}
</body>

</html>
`;
}

export const onRequestHead = getOnRequestHead(onRequest);

function encodeHtml(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, function (m) {
    return map[m];
  });
}

/**
 * Match patterns with a URL.
 * @param patterns Array of patterns to match against the URL.
 * @param url The URL to match against the patterns.
 * @returns true if the URL matches any of the patterns, false otherwise.
 *
 * Uses `browser-extension-url-match` to handle the pattern matching.
 */
function matchPatternsWithUrl(patterns: string[], url: string): boolean {
  const matcher = matchPattern(patterns);
  if (!matcher.valid) {
    return false;
  }
  return matcher.match(url);
}
