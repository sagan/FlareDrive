/**
 * A simple Forwarder worker.
 * Fetch and forward a request
 * Receive {url, token, options} from POST json body,
 * verify token === env.TOKEN,
 * then fetch(url, options) and return it's response.
 * @param {Request} request
 */
export default {
  async fetch(request, env, ctx) {
    // Parse request URL to get access to query string
    // const url = new URL(request.url);
    if (request.method !== "POST" || !request.body) {
      return new Response(null, { status: 400 });
    }
    const { url, token, options } = await request.json();
    if (!env.TOKEN || env.TOKEN !== token) {
      return new Response(null, { status: 401 });
    }
    // basic sanity check
    if (!url) {
      return new Response(null, { status: 400 });
    }

    // Returning fetch() with resizing options will pass through response with the resized image.
    return fetch(url, options || {});
  },
};
