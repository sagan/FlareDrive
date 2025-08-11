// share file api
import { matchPattern } from "browser-extension-url-match";
import { DEFAULT_SITENAME } from "../../lib/constants";
import {
  META_VARIABLE,
  HEADER_REFERER,
  HTML_VARIABLE,
  INDEX_FILE,
  RAW_VARIABLE,
  JSON_VARIABLE,
  PAST_TIMESTAMP,
  type ShareObject,
  path2Key,
  trimPrefix,
  ShareRefererMode,
  trimSuffix,
  cut,
  str2int,
  humanReadableSize,
  encodeHex,
  isDirectory,
  isUrlFile,
  validateAndGetSafeUrl,
  removeZeroFields,
} from "../../lib/commons";
import {
  FdCfFunc,
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
  getOnRequestHead,
  getGlobalConfig,
} from "../commons";

const SHARE_KEY_PREFIX = "s_";

// POST: list shares. optional, pass a prefix as path
export const onRequestPost: FdCfFunc = async function (context) {
  const { request, env, params } = context;
  if (!env.KV) {
    return responseNotFound();
  }
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }

  const sharekeyPrefix = params.path ? path2Key((params.path as string[]).join("/")) : "";
  const data = await env.KV.list({ prefix: SHARE_KEY_PREFIX + sharekeyPrefix });

  const shares = data.keys.map(({ name }) => trimPrefix(name, SHARE_KEY_PREFIX));
  return jsonResponse(shares);
};

// PUT: add a new or update a existing share
export const onRequestPut: FdCfFunc = async function (context) {
  const { request, env, params } = context;
  if (!env.KV) {
    return responseNotFound();
  }
  const globalConfig = await getGlobalConfig(env);
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  const shareObject = removeZeroFields(await request.json<ShareObject>());
  if (!shareObject.key) {
    return responseBadRequest();
  }

  const pathParams = params.path as string[];
  if (pathParams?.length != 1) {
    return responseBadRequest();
  }
  const sharekey = path2Key(pathParams[0]);
  if (!sharekey) {
    return responseBadRequest();
  }

  const options: KVNamespacePutOptions = {};
  if (globalConfig.hardShareExpiration && shareObject.expiration && shareObject.expiration !== PAST_TIMESTAMP) {
    options.expiration = Math.round(shareObject.expiration / 1000);
  }
  await env.KV.put(SHARE_KEY_PREFIX + sharekey, JSON.stringify(shareObject), options);
  return responseNoContent();
};

// DELETE: delete a new share
export const onRequestDelete: FdCfFunc = async function (context) {
  const { request, env, params } = context;
  if (!env.KV) {
    return responseNotFound();
  }
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  const pathParams = params.path as string[];
  if (pathParams?.length != 1) {
    return responseBadRequest();
  }
  const sharekey = path2Key(pathParams[0]);
  await env.KV.delete(SHARE_KEY_PREFIX + sharekey);
  return responseNoContent();
};

export const onRequestGet: FdCfFunc = async function (context) {
  const { request, env, params } = context;
  return handleGetShare({ request, env, path: (params.path as string[]).join("/") });
};

// GET: request a shared file meta or contents
export const handleGetShare = async function ({
  request,
  env,
  path,
}: {
  /**
   * E.g. "foo/bar.txt"
   */
  path: string;
  /**
   * Original request
   */
  request: FdCfFuncContextRequest;
  env: FdCfFuncContextEnv;
}) {
  if (!env.KV) {
    return responseNotFound();
  }

  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const requestMeta = !!str2int(searchParams.get(META_VARIABLE));
  const requestJson = !!str2int(searchParams.get(JSON_VARIABLE));

  if (requestMeta) {
    const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
    if (failResponse) {
      return failResponse;
    }
  }
  // const pathParams = params.path as string[];
  const pathParams = path.split("/");
  if (requestMeta ? pathParams?.length != 1 : pathParams?.length < 1) {
    return responseBadRequest();
  }
  const sharekey = path2Key(pathParams[0]);
  const relpath = path2Key(pathParams.slice(1).join("/"));
  const data = (await env.KV.get(SHARE_KEY_PREFIX + sharekey, "json")) as ShareObject | null;
  if (requestMeta) {
    return jsonResponse(data);
  }
  if (!data || !data.key || (data.expiration && data.expiration < Date.now())) {
    return responseNotFound();
  }
  if (data.auth) {
    const [user, pass] = cut(data.auth, ":");
    const [failRespose] = await checkAuthFailure(request, user, pass, `Share/${sharekey}`);
    if (failRespose) {
      return failRespose;
    }
  }
  if (data.refererMode) {
    const referList = data.refererList || [];
    const referer = request.headers.get(HEADER_REFERER) || "";
    const referMatch = referer ? matchPatternsWithUrl(referList, referer) : !!data.refererModeEmpty;
    let block = false;
    switch (data.refererMode) {
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

  if (!data.key.endsWith("/") && relpath) {
    return responseNotFound();
  }

  const filekey = trimSuffix(data.key, "/") + (relpath ? "/" + relpath : "");
  const obj = await env.BUCKET.get(filekey, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (!obj) {
    return responseNotFound();
  }
  const fullHtml = !!data.fullHtml;
  const cors = !!data.cors;

  if (isDirectory(obj)) {
    if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
      return responseRedirect(url.href);
    }
    const indexHtmlObj = await env.BUCKET.get(filekey + "/" + INDEX_FILE, {
      onlyIf: request.headers,
      range: request.headers,
    });

    if (indexHtmlObj) {
      return outputR2Object({ obj: indexHtmlObj, cors, fullHtml });
    }
    const sitename = env.SITENAME || DEFAULT_SITENAME;
    const description = data.desc || "";
    if (data.noindex) {
      if (relpath) {
        return responseNotFound();
      } else {
        return htmlResponse(noindexPage(sitename, description, sharekey));
      }
    }
    const files = await findChildren({
      bucket: env.BUCKET,
      path: filekey,
      depth: "1",
      db: env.DB,
    });
    // Pre-sort files: directories first, then by name
    files.sort((a, b) => {
      const aIsDir = isDirectory(a);
      const bIsDir = isDirectory(b);
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.key.split("/").pop()!.localeCompare(b.key.split("/").pop()!);
    });

    if (requestJson) {
      return jsonResponse({ sitename, description, files }, { cors });
    }
    return htmlResponse(indexPage(sitename, description, sharekey + (relpath ? "/" + relpath : ""), !relpath, files));
  } else if (url.pathname.endsWith("/")) {
    // target is file, but the request path ends with "/"
    return responseNotFound();
  }
  return outputR2Object({
    obj,
    fullHtml,
    cors,
    html: !!str2int(searchParams.get(HTML_VARIABLE)),
    raw: !!str2int(searchParams.get(RAW_VARIABLE)),
  });
};

export const onRequestHead = getOnRequestHead(onRequestGet);

function noindexPage(sitename: string, desc: string, dir: string): string {
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
  </head>
  <body>
    <h1>Index of ${encodeHtml(dir)}</h1>
    ${desc ? `<div>${desc}</div>` : ""}
    <p>Dir index is disabled for this folder. Append the file relative path to url directly to access it.</p>
  </body>
</html>
`;
}

function indexPage(sitename: string, desc: string, dir: string, isRoot: boolean, items: R2Object[]): string {
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
      const name = item.key.split("/").pop()!;
      const isDir = isDirectory(item);
      const href =
        isUrlFile(item) && item.customMetadata?.url
          ? validateAndGetSafeUrl(item.customMetadata.url)
          : encodeURIComponent(name) + (isDir ? "/" : ""); // Relative href
      const displayName = encodeHtml(name) + (isDir ? "/" : "");
      const sizeDisplay = !isDir ? humanReadableSize(item.size) : "";
      const dateDisplay = item.uploaded.toISOString().slice(0, 19) + "Z";
      const mimeDisplay = encodeHtml(item.httpMetadata?.contentType || "");
      const md5Display = !isDir && item.checksums?.md5 ? encodeHex(item.checksums.md5) : "";
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

</body>

</html>
`;
}

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
