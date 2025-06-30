import { DocumentNode } from "graphql";
import { print } from "graphql/language/printer.js";
import { HEADER_CONTENT_TYPE, MIME_JSON } from "../lib/commons";
import { getSdk } from "./generated/graphql";

// Use Cloudflare GraphQL Analytics API
// https://developers.cloudflare.com/analytics/graphql-api/
export const CF_GRAPHQL_API = "https://api.cloudflare.com/client/v4/graphql";

export function createSdk(token: string) {
  // The requester must accept a DocumentNode and convert it to a string for the fetch body.
  const requester = async <R, V>(doc: DocumentNode, variables?: V): Promise<R> => {
    // Use the `print` function to convert the query AST to a string
    const query = print(doc);

    const apiResponse = await fetch(CF_GRAPHQL_API, {
      method: "POST",
      headers: {
        [HEADER_CONTENT_TYPE]: MIME_JSON,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`GraphQL request failed: ${apiResponse.status} ${apiResponse.statusText} - ${errorText}`);
    }

    const result = await apiResponse.json<any>();

    // The generic SDK expects the `data` part of the GraphQL response.
    // It's also good to check for an `errors` array.
    if (result.errors) {
      throw new Error(`GraphQL returned errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  };
  return getSdk(requester);
}
