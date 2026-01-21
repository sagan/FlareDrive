import {
  HEADER_AUTHORIZATION,
  HEADER_CONTENT_TYPE,
  METHOD_GET,
  METHOD_POST,
  MIME_JSON,
  REINDEX_API,
} from "../../lib/commons";
import { ReindexerPayload, ReindexerStorage } from "../../lib/reindexer";

export async function reindexerApi(auth: string, payload: ReindexerPayload): Promise<unknown> {
  const res = await fetch(`${REINDEX_API}`, {
    method: METHOD_POST,
    headers: {
      ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
      [HEADER_CONTENT_TYPE]: MIME_JSON,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  const data = await res.json();
  return data;
}

export async function reindexerStatus(auth: string): Promise<ReindexerStorage> {
  const res = await fetch(`${REINDEX_API}`, {
    method: METHOD_GET,
    headers: {
      ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  const data = await res.json<ReindexerStorage>();
  return data;
}
