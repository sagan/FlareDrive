import { Liquid, Tokenizer, evalToken } from "liquidjs";
import JSOX from "jsox";
import SparkMD5 from "spark-md5";
import {
  CACHE_CONTROL_NO_CACHE,
  CONTENT_SECURITY_POLICY_SANDBOX,
  CONTENT_TYPE_OPTIONS_NOSNIFF,
  HEADER_CACHE_CONTROL,
  HEADER_CONTENT_SECURITY_POLICY,
  HEADER_CONTENT_TYPE,
  HEADER_CONTENT_TYPE_OPTIONS,
  HEADER_PREFIX_FLAREDRIVE,
  HEADER_REFERRER_POLICY,
  METHODS,
  MIME_TXT,
  REFERRER_POLICY_NOREFERRER,
  STRONG_PASSWORD_LENGTH,
  hmacSha256Sign,
  normalizeHeaderName,
  toArrayBuffer,
} from "../lib/commons";
import { responseInternalServerError } from "./commons";
import { generatePassword } from "@/src/commons";

/**
 * Don't read fetch response body.
 */
const TPL_FETCH_NOBODY = "NOBODY";

/**
 * Response headers variable key in context, used by set_header.
 */
const TPL_CONTEXT_KEY_HEADERS = "_headers";

/**
 * Internal data variable key in context, used by set_body.
 */
const TPL_CONTEXT_KEY_DATA = "_data";

/**
 * Request variable key in context.
 */
const TPL_CONTEXT_KEY_REQUEST = "request";

const TPL_CONTEXT_KEY_ENV = "env";

const TPL_CONTEXT_KEY_HEADERS_STATUS = "Status"; // in compliance with CGI

const TPL_CONTEXT_KEY_DATA_BODY = "body";

export interface SelfRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
}

export interface FetchResponse {
  status: number;
  headers: Record<string, string>;
  body: ReadableStream | string | null;
  /**
   * Parsed structured json object if body is a valid json
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

function parseArgs(str: string): unknown[] {
  const tokenizer = new Tokenizer(str);
  const args: unknown[] = [];
  while (!tokenizer.end()) {
    args.push(tokenizer.readValue());
  }
  return args;
}

/**
 * Convert Headers to Record. Since liquidjs template can't handle Headers type.
 * Headers in stripHeaders are stripped; if an element ends with "-", it's treated as a prefix.
 */
function headers2Record(headers: Headers, stripHeaders?: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    key = normalizeHeaderName(key);
    if (
      stripHeaders?.some((pattern) => {
        pattern = normalizeHeaderName(pattern);
        return pattern.endsWith("-") ? key.startsWith(pattern) : key === pattern;
      })
    ) {
      return;
    }
    record[key] = value;
  });
  return record;
}

// Initialize the template engine
const engine = new Liquid({
  relativeReference: false,
  // https://github.com/harttle/liquidjs/issues/131
  fs: {
    resolve: function (dir: string, file: string, ext: string): string {
      throw new Error("File system not implemented");
    },
    exists: function (filepath: string): Promise<boolean> {
      throw new Error("Function not implemented.");
    },
    existsSync: function (filepath: string): boolean {
      throw new Error("Function not implemented.");
    },
    readFile: function (filepath: string): Promise<string> {
      throw new Error("Function not implemented.");
    },
    readFileSync: function (filepath: string): string {
      throw new Error("Function not implemented.");
    },
  },
});

engine.registerFilter("json_parse", (str) => JSOX.parse(str));

// {%- assign url = "https://example.com/" | url_parse -%}
engine.registerFilter("url_parse", (str, baseUrl) => {
  const url = new URL(str, baseUrl || undefined);
  return {
    href: url.href,
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    host: url.host,
    origin: url.origin,
    username: url.username,
    password: url.password,
    searchParams: Object.fromEntries(url.searchParams),
  };
});

engine.registerFilter("query_string", (input: string | Record<string, string>, key?: string) => {
  if (typeof input === "object") {
    if (key) {
      return input[key];
    }
    return new URLSearchParams(input).toString();
  }
  const searchParams = new URLSearchParams(input);
  if (key) {
    return searchParams.get(key);
  }
  return Object.fromEntries(searchParams);
});

// {{ 30 | random_string %}}
engine.registerFilter("random_string", (length, digitOnly?: boolean) =>
  generatePassword(parseInt(length) || STRONG_PASSWORD_LENGTH, digitOnly)
);

// {{ "123456" | md5sum }}
engine.registerFilter("md5sum", (input, binaryString?: boolean) => {
  const spark = new SparkMD5();
  spark.append(input); // it fails to do with ArrayBuffer
  return spark.end(binaryString);
});

engine.registerFilter("sha1sum", async (input: unknown, binaryString?: boolean) => {
  const hashBuffer = await crypto.subtle.digest("SHA-1", toArrayBuffer(input));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  if (binaryString) {
    return String.fromCharCode(...hashArray);
  }
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
});

engine.registerFilter("sha256sum", async (input: unknown, binaryString?: boolean) => {
  const hashBuffer = await crypto.subtle.digest("SHA-256", toArrayBuffer(input));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  if (binaryString) {
    return String.fromCharCode(...hashArray);
  }
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
});

engine.registerFilter("hmac_sha256_sign", async (payload: unknown, key: string) => {
  const sign = await hmacSha256Sign(key, payload);
  return sign;
});

/*
{% fetch "variableName" "url" %}

{% fetch "variableName" "url" "POST" "@foo=1&bar=2" %}

The first two args are variableName & url. Afterwards are optional flags which could be any of:

- "GET" / "POST" / "PUT"...: http method name, default to GET.
- "Content-Type: application/json" : request header.
- "@..." : http request body, prefixed with "@".
*/
engine.registerTag("fetch", {
  parse: function (tagToken) {
    this.args = parseArgs(tagToken.args);
    if (this.args.length < 2) {
      throw new Error("fetch tag requires at least 2 arguments: variableName and url");
    }
  },
  // https://liquidjs.com/tutorials/parse-parameters.html
  // Just use yield instead await on promise.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  *render(ctx, emitter): Generator<unknown, any, any> {
    const selfRequest = ctx.getSync([TPL_CONTEXT_KEY_REQUEST]) as SelfRequest;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = this.args as any[];
    const variableName = `${yield evalToken(args[0], ctx)}`;
    const url = new URL(`${yield evalToken(args[1], ctx)}`, selfRequest.url);

    let nobodyMode = false;
    const request: RequestInit = {};
    const headers = new Headers();
    const optionArgs = args.slice(2);
    for (const arg of optionArgs) {
      const value = yield evalToken(arg, ctx);
      if (typeof value === "object") {
        Object.assign(request, value);
      } else {
        const valueStr = `${value}`;
        if ((METHODS as readonly string[]).includes(valueStr)) {
          request.method = valueStr;
        } else if (valueStr === TPL_FETCH_NOBODY) {
          nobodyMode = true;
        } else if (valueStr.startsWith("@")) {
          request.body = valueStr.slice(1);
        } else {
          const index = valueStr.indexOf(":");
          if (index != -1) {
            // A "Content-Type: application/json" style header
            headers.set(valueStr.slice(0, index).trim(), valueStr.slice(index + 1).trim());
          }
        }
      }
    }
    const finalHeaders = new Headers(request.headers);
    headers.forEach((value, key) => finalHeaders.set(key, value));
    request.headers = finalHeaders;

    const res: Response = yield fetch(url, request);
    let body: ReadableStream | string | null = res.body;
    let data = null;
    if (!nobodyMode) {
      body = (yield res.text()) as string;
      data = null;
      try {
        data = JSON.parse(body);
      } catch (e) {
        /* empty */
      }
    }

    const response: FetchResponse = {
      status: res.status,
      headers: headers2Record(res.headers),
      body,
      data,
    };
    // Save to context
    const bottom = ctx.bottom() as Record<string, unknown>;
    bottom[variableName] = response;
  },
});

/*
{% set_header "Content-Type" "text/plain" %}
{% set_header "Content-Type: text/plain" %}
{% set_header "Status" 404 %}
{% set_header headers %} # headers is Record<string,string> type

Set value to "" / undefined / null to delete a header
*/
engine.registerTag("set_header", {
  parse: function (tagToken) {
    this.args = parseArgs(tagToken.args);
    if (this.args.length < 1 || this.args.length > 2) {
      throw new Error("set_header tag requires 1-2 arguments: name [value]");
    }
  },
  // https://liquidjs.com/tutorials/parse-parameters.html
  // Just use yield instead await on promise.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  *render(ctx, emitter): Generator<unknown, any, any> {
    const headers = ctx.getSync([TPL_CONTEXT_KEY_HEADERS]) as Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = this.args as any[];
    let name: string | Record<string, string>;
    let value = "";
    name = yield evalToken(args[0], ctx);
    if (typeof name === "object") {
      for (let key in name) {
        const value = name[key];
        key = normalizeHeaderName(key);
        if (value) {
          headers[key] = value;
        } else {
          delete headers[key];
        }
      }
      return;
    }
    if (args.length >= 2) {
      value = yield evalToken(args[1], ctx);
    } else {
      // name is "name: value" format
      const index = name.indexOf(":");
      if (index != -1) {
        value = name.slice(index + 1).trim();
        name = normalizeHeaderName(name.slice(0, index).trim());
      }
    }
    if (value) {
      headers[name] = value;
    } else {
      delete headers[name];
    }
  },
});

engine.registerTag("set_body", {
  parse: function (tagToken) {
    this.args = parseArgs(tagToken.args);
    if (this.args.length !== 1) {
      throw new Error("set_body tag requires exact 1 argument");
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  *render(ctx, emitter): Generator<unknown, any, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = this.args as any[];
    const body = yield evalToken(args[0], ctx);
    const data = ctx.getSync([TPL_CONTEXT_KEY_DATA]) as Record<string, unknown>;
    data[TPL_CONTEXT_KEY_DATA_BODY] = body;
  },
});

/*
Sample templates.

-----

<h1>Async Fetch Test</h1>
{% fetch "todoItem" "https://jsonplaceholder.typicode.com/todos/1" %}
<div class="card">
    <h3>Todo ID: {{ todoItem.data.id }}</h3>
    <p>Title: {{ todoItem.data.title }}</p>
    <p>Completed: {{ todoItem.data.completed }}</p>
</div>

-----

{%- fetch "res" "https://raw.githubusercontent.com/pdx-cs-sound/wavs/refs/heads/main/car-horn.wav" "NOBODY" -%}

{%- set_header "Content-Type" res.headers["Content-Type"] -%}
{%- set_body res.body -%}
*/

/**
 * Render an LiquidJs template
 */
export async function executeCgi(
  request: Request,
  template: string,
  fullHtml = false,
  env: Record<string, string> = {}
): Promise<Response> {
  try {
    const headers: Record<string, string> = { [HEADER_CONTENT_TYPE]: MIME_TXT };
    const requestHeaders = headers2Record(request.headers, [HEADER_PREFIX_FLAREDRIVE]);
    const req: SelfRequest = {
      url: request.url,
      method: request.method,
      headers: requestHeaders,
    };
    const data: Record<string, unknown> = {};
    const context: Record<string, unknown> = {
      [TPL_CONTEXT_KEY_REQUEST]: req,
      [TPL_CONTEXT_KEY_HEADERS]: headers,
      [TPL_CONTEXT_KEY_DATA]: data,
      [TPL_CONTEXT_KEY_ENV]: env,
    };
    const tpl = engine.parse(template);
    const html = await engine.render(tpl, context);
    let status = 200;
    let body: BodyInit | null | undefined;
    if (headers[TPL_CONTEXT_KEY_HEADERS_STATUS]) {
      status = parseInt(headers[TPL_CONTEXT_KEY_HEADERS_STATUS]) || 200;
      delete headers[TPL_CONTEXT_KEY_HEADERS_STATUS];
    }
    if (data[TPL_CONTEXT_KEY_DATA_BODY]) {
      body = data[TPL_CONTEXT_KEY_DATA_BODY] as BodyInit;
    } else {
      body = html;
    }
    // headers were passed to LiquidJs template as part of context and may be tampered.
    // For security reason, don't use it directly.
    const actualHeaders = new Headers();
    for (const name in headers) {
      actualHeaders.set(`${name}`, `${headers[name]}`);
    }
    actualHeaders.set(HEADER_CONTENT_TYPE_OPTIONS, CONTENT_TYPE_OPTIONS_NOSNIFF);
    actualHeaders.set(HEADER_REFERRER_POLICY, REFERRER_POLICY_NOREFERRER);
    if (!actualHeaders.has(HEADER_CACHE_CONTROL)) {
      actualHeaders.set(HEADER_CACHE_CONTROL, CACHE_CONTROL_NO_CACHE);
    }
    if (!fullHtml) {
      actualHeaders.set(HEADER_CONTENT_SECURITY_POLICY, CONTENT_SECURITY_POLICY_SANDBOX);
    }
    return new Response(body, {
      status,
      headers: actualHeaders,
    });
  } catch (err) {
    console.log("cgi error", err);
    return responseInternalServerError();
  }
}
