import { ShareObject, SHARE_ENDPOINT, key2Path } from "../../lib/commons";

/**
 * @returns share project keys
 */
export async function listShares(auth: string | null): Promise<string[]> {
  const res = await fetch(`${SHARE_ENDPOINT}`, {
    method: "POST",
    headers: {
      ...(auth ? { Authorization: auth } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  const data = (await res.json()) as string[];
  return data;
}

export async function createShare(key: string, share: ShareObject, auth: string | null): Promise<void> {
  const res = await fetch(`${SHARE_ENDPOINT}${key2Path(key)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(share),
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  return;
}

export async function deleteShare(key: string, auth: string | null): Promise<void> {
  const res = await fetch(`${SHARE_ENDPOINT}${key2Path(key)}`, {
    method: "DELETE",
    headers: {
      ...(auth ? { Authorization: auth } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  return;
}

export async function getShare(key: string, auth: string | null): Promise<ShareObject> {
  const res = await fetch(`${SHARE_ENDPOINT}${key2Path(key)}?meta=1`, {
    headers: {
      ...(auth ? { Authorization: auth } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  return res.json();
}
