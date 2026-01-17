import { checkAuthFailure, FdCfFunc, responseInternalServerError } from "../commons";
import { Liquid } from "liquidjs";

// Initialize the engine
const engine = new Liquid();

// REGISTER CUSTOM TAG: {% fetch variableName "url" %}
engine.registerTag("fetch", {
  parse: function (tagToken, remainTokens) {
    // Parse arguments: {% fetch [variable] [url] %}
    this.args = tagToken.args.split(" ");
    this.variableName = this.args[0];
    this.url = this.args[1].replace(/["']/g, ""); // Simple quote stripping
  },
  render: async function (ctx, emitter) {
    // 1. Perform the fetch
    // Note: Real-world usage should handle errors/timeouts
    const response = await fetch(this.url);
    const data = await response.json();

    // 2. Store the result in the context
    // LiquidJS contexts are scopes; we push to the current scope
    ctx.bottom()[this.variableName] = data;
  },
});

// Sample template:
/*
  <h1>Async Fetch Test</h1>
  {% fetch todoItem "https://jsonplaceholder.typicode.com/todos/1" %}
  <div class="card">
      <h3>Todo ID: {{ todoItem.id }}</h3>
      <p>Title: {{ todoItem.title }}</p>
      <p>Completed: {{ todoItem.completed }}</p>
  </div>
*/

// test: render a template
export const onRequestPost: FdCfFunc = async function (context) {
  const { request, env } = context;
  const [failResponse] = await checkAuthFailure(request, env.WEBDAV_USERNAME, env.WEBDAV_PASSWORD);
  if (failResponse) {
    return failResponse;
  }
  try {
    const template = await request.text();
    const html = await engine.parseAndRender(template);
    return new Response(html, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    return responseInternalServerError(`${err}`);
  }
};
