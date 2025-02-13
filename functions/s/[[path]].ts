// share file api
import { matchPattern } from "browser-extension-url-match";
import {
  MIME_DIR,
  META_VARIABLE,
  HEADER_REFERER,
  type ShareObject,
  path2Key,
  trimPrefix,
  ShareRefererMode,
  trimSuffix,
  cut,
  str2int,
  HTML_VARIABLE,
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
  responseNotModified,
  outputR2Object,
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
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  const shareObject = await request.json<ShareObject>();
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
  if (shareObject.expiration) {
    options.expiration = shareObject.expiration;
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

// GET: request a shared file meta or contents
export const onRequestGet: FdCfFunc = async function (context) {
  const { request, env, params } = context;
  if (!env.KV) {
    return responseNotFound();
  }

  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const requestMeta = !!str2int(searchParams.get(META_VARIABLE));

  if (requestMeta) {
    const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
    if (failResponse) {
      return failResponse;
    }
  }
  const pathParams = params.path as string[];
  if (requestMeta ? pathParams?.length != 1 : pathParams?.length < 1) {
    return responseBadRequest();
  }
  const sharekey = path2Key(pathParams[0]);
  const relpath = path2Key(pathParams.slice(1).join("/"));
  const data = (await env.KV.get(SHARE_KEY_PREFIX + sharekey, "json")) as ShareObject | null;
  if (requestMeta) {
    return jsonResponse(data);
  }
  if (!data || !data.key) {
    return responseNotFound();
  }
  if (data.auth) {
    const [user, pass] = cut(data.auth, ":");
    const [failRespose] = await checkAuthFailure(context.request, user, pass, `Share/${sharekey}`);
    if (failRespose) {
      return failRespose;
    }
  }
  if (data.refererMode) {
    let referList = data.refererList || [];
    const referer = request.headers.get(HEADER_REFERER) || "";
    const i = referList.indexOf("");
    if (i != -1) {
      referList = referList.splice(i, 1);
    }
    const referMatch =
      (i != -1 && (!referer || referer.startsWith(url.origin + "/"))) || matchPatternsWithUrl(referList, referer);
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

  const isDir = data.key.endsWith("/");
  if (!isDir && relpath) {
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
  if (obj.httpMetadata?.contentType === MIME_DIR) {
    if (data.noindex && relpath) {
      return responseNotFound();
    }
    if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
      return responseRedirect(url.href);
    }
    if (data.noindex) {
      return htmlResponse(noindexPage(context.env.SITENAME, data.desc || "", sharekey));
    }
    const files = await findChildren({
      bucket: context.env.BUCKET,
      path: filekey,
      depth: "1",
    });
    return htmlResponse(
      indexPage(context.env.SITENAME, data.desc || "", sharekey + (relpath ? "/" + relpath : ""), !relpath, files)
    );
  } else if (url.pathname.endsWith("/")) {
    // target is file, but the request path ends with "/"
    return responseNotFound();
  }
  if (!("body" in obj)) {
    return responseNotModified();
  }
  return outputR2Object({ obj, html: searchParams.has(HTML_VARIABLE), cors: !!data.cors });
};

export const onRequestHead: FdCfFunc = async function (context) {
  const res = await onRequestGet(context);
  return new Response(null, {
    status: res.status,
    headers: res.headers,
  });
};

function noindexPage(sitename: string | undefined, desc: string, dir: string): string {
  const title = sitename ? `${dir} - ${sitename}` : `${dir}`;
  // from Chrome file:// url dir index page
  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
  <head>
    <meta charset="utf-8">
    <title>${encodeHtml(title)}</title>
    <meta name="google" value="notranslate">
    <link rel="icon" href="/favicon.png" />
  </head>
  <body>
    <h1>Index of ${encodeHtml(dir)}</h1>
    ${desc ? `<div>${desc}</div>` : ""}
    <p>Dir index is disabled for this folder. Append the file relative path to url directly to access it.</p>
  </body>
</html>
`;
}

function indexPage(
  sitename: string | undefined,
  desc: string,
  dir: string,
  isRoot: boolean,
  items: R2Object[]
): string {
  const title = sitename ? `${dir} - ${sitename}` : `${dir}`;
  // from Chrome file:// url dir index page
  return `<!DOCTYPE html>

<html dir="ltr" lang="en">

<head>
<meta charset="utf-8">
<title>${encodeHtml(title)}</title>
<meta name="color-scheme" content="light dark">
<meta name="google" value="notranslate">
<link rel="icon" href="/favicon.png" />

<script>
function addRow(name, url, isdir,
    size, size_string, date_modified, date_modified_string) {
  if (name == "." || name == "..")
    return;

  var root = document.location.pathname;
  if (root.substr(-1) !== "/")
    root += "/";

  var tbody = document.getElementById("tbody");
  var row = document.createElement("tr");
  var file_cell = document.createElement("td");
  var link = document.createElement("a");

  link.className = isdir ? "icon dir" : "icon file";

  if (isdir) {
    name = name + "/";
    url = url + "/";
    size = 0;
    size_string = "";
  } else {
    link.draggable = "true";
    link.addEventListener("dragstart", onDragStart, false);
  }
  link.innerText = name;
  link.href = root + url;

  file_cell.dataset.value = name;
  file_cell.appendChild(link);

  row.appendChild(file_cell);
  row.appendChild(createCell(size, size_string));
  row.appendChild(createCell(date_modified, date_modified_string));

  tbody.appendChild(row);
}

function onDragStart(e) {
  var el = e.srcElement;
  var name = el.innerText.replace(":", "");
  var download_url_data = "application/octet-stream:" + name + ":" + el.href;
  e.dataTransfer.setData("DownloadURL", download_url_data);
  e.dataTransfer.effectAllowed = "copy";
}

function createCell(value, text) {
  var cell = document.createElement("td");
  cell.setAttribute("class", "detailsColumn");
  cell.dataset.value = value;
  cell.innerText = text;
  return cell;
}

function start(location) {
  var header = document.getElementById("header");
  header.innerText = header.innerText.replace("LOCATION", location);

  document.getElementById("title").innerText = header.innerText;
}

function onHasParentDirectory() {
  var box = document.getElementById("parentDirLinkBox");
  box.style.display = "block";

  var root = document.location.pathname;
  if (!root.endsWith("/"))
    root += "/";

  var link = document.getElementById("parentDirLink");
  link.href = root + "..";
}

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
    var a = row1.cells[column].dataset.value;
    var b = row2.cells[column].dataset.value;
    if (column) {
      a = parseInt(a, 10);
      b = parseInt(b, 10);
      return a > b ? newOrder : a < b ? oldOrder : 0;
    }

    // Column 0 is text.
    if (a > b)
      return newOrder;
    if (a < b)
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
  }

  th {
    cursor: pointer;
  }

  td.detailsColumn {
    padding-inline-start: 2em;
    text-align: end;
    white-space: nowrap;
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

<h1 id="header">Index of LOCATION</h1>
${desc ? `<div>${desc}</div>` : ""}
<div id="parentDirLinkBox" style="display:none">
  <a id="parentDirLink" class="icon up">
    <span id="parentDirText">[parent directory]</span>
  </a>
</div>

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
    </tr>
  </thead>
  <tbody id="tbody">
  </tbody>
</table>

</body>

</html>
<script>"use strict";
// Copyright 2012 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
var loadTimeData;class LoadTimeData{constructor(){this.data_=null}set data(value){expect(!this.data_,"Re-setting data.");this.data_=value}valueExists(id){return id in this.data_}getValue(id){expect(this.data_,"No data. Did you remember to include strings.js?");const value=this.data_[id];expect(typeof value!=="undefined","Could not find value for "+id);return value}getString(id){const value=this.getValue(id);expectIsType(id,value,"string");return value}getStringF(id,var_args){const value=this.getString(id);if(!value){return""}const args=Array.prototype.slice.call(arguments);args[0]=value;return this.substituteString.apply(this,args)}substituteString(label,var_args){const varArgs=arguments;return label.replace(/\$(.|$|\n)/g,(function(m){expect(m.match(/\$[$1-9]/),"Unescaped $ found in localized string.");return m==="$$"?"$":varArgs[m[1]]}))}getBoolean(id){const value=this.getValue(id);expectIsType(id,value,"boolean");return value}getInteger(id){const value=this.getValue(id);expectIsType(id,value,"number");expect(value===Math.floor(value),"Number isn't integer: "+value);return value}overrideValues(replacements){expect(typeof replacements==="object","Replacements must be a dictionary object.");for(const key in replacements){this.data_[key]=replacements[key]}}}function expect(condition,message){if(!condition){throw new Error("Unexpected condition on "+document.location.href+": "+message)}}function expectIsType(id,value,type){expect(typeof value===type,"["+value+"] ("+id+") is not a "+type)}expect(!loadTimeData,"should only include this file once");loadTimeData=new LoadTimeData;window.loadTimeData=loadTimeData;console.warn("crbug/1173575, non-JS module files deprecated.");</script><script>loadTimeData.data = {"header":"Index of LOCATION","headerDateModified":"Date Modified","headerName":"Name","headerSize":"Size","language":"en","parentDirText":"[parent directory]","textdirection":"ltr"};</script>
<script>
function humanFileSize(size) {
  if(size < 0) return size.toString();
  var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
  return +((size / Math.pow(1024, i)).toFixed(2)) * 1 + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
}
</script>
<script>
  start(${str(dir)});
  if(!${isRoot}) {
    onHasParentDirectory();
  }
  // function addRow(name, url, isdir, size, size_string, date_modified, date_modified_string)
${items
  .map((item) => {
    const name = item.key.split("/").pop()!;
    const isDir = item.httpMetadata?.contentType == MIME_DIR;
    return `addRow(${str(name)}, ${str(name)}, ${isDir}, ${item.size}, humanFileSize(${
      item.size
    }), ${+item.uploaded}, ${str(item.uploaded.toISOString())});`;
  })
  .join("\n")}
</script>
`;
}

/**
 * Escape a JavaScript string literal, return a JavaScript expression literal which evaluate to that string.
 * @param s
 * @returns
 */
function str(s: string): string {
  if (s.includes(`"`) || s.includes(`'`) || s.includes(`\\`)) {
    return `decodeURI(${`"${encodeURIComponent(s)}"`})`;
  }
  return `"${s}"`;
}

function encodeHtml(str: string): string {
  var map: Record<string, string> = {
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

function matchPatternsWithUrl(patterns: string[], url: string): boolean {
  const matcher = matchPattern(patterns);
  if (!matcher.valid) {
    return false;
  }
  return matcher.match(url);
}
