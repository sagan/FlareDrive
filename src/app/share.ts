import { SHARE_ENDPOINT, HEADER_AUTHORIZATION, HEADER_CONTENT_TYPE, ShareObject, key2Path } from "../../lib/commons";

/**
 * @returns share project keys
 */
export async function listShares(auth: string): Promise<string[]> {
  const res = await fetch(`${SHARE_ENDPOINT}`, {
    method: "POST",
    headers: {
      ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  const data = await res.json<string[]>();
  return data;
}

export async function createShare(key: string, share: ShareObject, auth: string): Promise<void> {
  const res = await fetch(`${SHARE_ENDPOINT}${key2Path(key)}`, {
    method: "PUT",
    headers: {
      [HEADER_CONTENT_TYPE]: "application/json",
      ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
    },
    body: JSON.stringify(share),
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  return;
}

export async function deleteShare(key: string, auth: string): Promise<void> {
  const res = await fetch(`${SHARE_ENDPOINT}${key2Path(key)}`, {
    method: "DELETE",
    headers: {
      ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  return;
}

export async function getShare(key: string, auth: string): Promise<ShareObject> {
  const res = await fetch(`${SHARE_ENDPOINT}${key2Path(key)}?meta=1`, {
    headers: {
      ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  return res.json<ShareObject>();
}
