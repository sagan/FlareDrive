import { Liquid, Tokenizer, evalToken } from "liquidjs";
import JSOX from "jsox";
import SparkMD5 from "spark-md5";
import {
  CACHE_CONTROL_NO_CACHE,
  CONTENT_SECURITY_POLICY_SANDBOX,
  HEADER_CACHE_CONTROL,
  HEADER_CONTENT_SECURITY_POLICY,
  METHODS,
  MIME_TXT,
} from "../lib/commons";
import { responseInternalServerError } from "./commons";

const TPL_CONTEXT_KEY_HEADERS = "_headers";

const TPL_CONTEXT_KEY_REQUEST = "_request";

const TPL_CONTEXT_KEY_STATUS = "_status";

export interface SelfRequest {
  url: string;
}

export interface FetchResponse {
  status: number;
  headers: Headers;
  body: string;
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

// Initialize the template engine
const engine = new Liquid();

engine.registerFilter("json_parse", (str) => JSOX.parse(str));

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

    let method = "GET";
    let requestBody: string | undefined;
    const headers: Record<string, string> = {};
    const optionArgs = args.slice(2);
    for (const arg of optionArgs) {
      const token = `${yield evalToken(arg, ctx)}`;
      if ((METHODS as readonly string[]).includes(token)) {
        method = token;
      } else if (token.startsWith("@")) {
        requestBody = token.slice(1);
      } else {
        const index = token.indexOf(":");
        if (index != -1) {
          // A "Content-Type: application/json" style header
          headers[token.slice(0, index).trim()] = token.slice(index + 1).trim();
        }
      }
    }

    const res: Response = yield fetch(url, { method, headers, body: requestBody });
    const body = yield res.text();
    let data = null;
    try {
      data = JSON.parse(body);
    } catch (e) {
      /* empty */
    }
    const response: FetchResponse = {
      status: res.status,
      headers: res.headers,
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
{% set_header "_status" 404 %}

pseudo header: _status

Set value to "-" to delete a header
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = this.args as any[];
    let name = "";
    let value = "";
    name = `${yield evalToken(args[0], ctx)}`;
    if (args.length >= 2) {
      value = `${yield evalToken(args[1], ctx)}`;
    } else {
      // name is "name: value" format
      const index = name.indexOf(":");
      if (index != -1) {
        value = name.slice(index + 1).trim();
        name = name.slice(0, index).trim();
      }
    }
    const headers = ctx.getSync([TPL_CONTEXT_KEY_HEADERS]) as Record<string, string>;
    if (value === "-") {
      delete headers[name];
    } else {
      headers[name] = value;
    }
  },
});

/*
{% md5sum "123456" %}

or:

{%- capture md5 -%}
  {%- md5sum "123456" -%}
{%- endcapture -%}
md5: {{ md5 }}

Note the {% assign %} tag works only with values and filters, not the direct tag output. So this is invalid:
  {% assign md5 = md5sum "123456" %}
  {{ md5 }}
*/
engine.registerTag("md5sum", {
  parse: function (tagToken) {
    this.args = parseArgs(tagToken.args);
    if (this.args.length == 0) {
      throw new Error("set_header tag requires at least 1 argument");
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  *render(ctx, emitter): Generator<unknown, any, any> {
    const values: string[] = [];
    for (const arg of this.args) {
      values.push(yield evalToken(arg, ctx));
    }
    const spark = new SparkMD5();
    for (const val of values) {
      spark.append(val);
    }
    emitter.write(spark.end());
  },
});

// Sample template:
/*
<h1>Async Fetch Test</h1>
{% fetch "todoItem" "https://jsonplaceholder.typicode.com/todos/1" %}
<div class="card">
    <h3>Todo ID: {{ todoItem.data.id }}</h3>
    <p>Title: {{ todoItem.data.title }}</p>
    <p>Completed: {{ todoItem.data.completed }}</p>
</div>
*/

/**
 * Render an LiquidJs template
 */
export async function executeCgi(request: Request, template: string, fullHtml = false): Promise<Response> {
  try {
    const headers: Record<string, string> = { "Content-Type": MIME_TXT };
    const req: SelfRequest = {
      url: request.url,
    };
    const context: Record<string, unknown> = {
      [TPL_CONTEXT_KEY_REQUEST]: req,
      [TPL_CONTEXT_KEY_HEADERS]: headers,
    };
    const tpl = engine.parse(template);
    const html = await engine.render(tpl, context);
    let status = 200;
    if (headers[TPL_CONTEXT_KEY_STATUS]) {
      status = parseInt(headers[TPL_CONTEXT_KEY_STATUS]) || 200;
      delete headers[TPL_CONTEXT_KEY_STATUS];
    }
    // headers were passed to LiquidJs template as part of context and may be tampered.
    // For security reason, don't use it directly.
    const actualHeaders = new Headers();
    for (const name in headers) {
      actualHeaders.set(`${name}`, `${headers[name]}`);
    }
    if (!fullHtml) {
      actualHeaders.set(HEADER_CONTENT_SECURITY_POLICY, CONTENT_SECURITY_POLICY_SANDBOX);
    }
    actualHeaders.set(HEADER_CACHE_CONTROL, CACHE_CONTROL_NO_CACHE);
    return new Response(html, {
      status,
      headers: actualHeaders,
    });
  } catch (err) {
    return responseInternalServerError(`${err}`);
  }
}
