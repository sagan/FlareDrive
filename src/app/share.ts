import { ShareObject, SHARE_ENDPOINT, key2Path } from "../../lib/commons";

/**
 * @returns share project keys
 */
export async function listShares(): Promise<string[]> {
  const res = await fetch(`${SHARE_ENDPOINT}`, { method: "PUT" });
  if (res.status != 200) {
    throw new Error(`status=${res.status}`);
  }
  const data = (await res.json()) as string[];
  return data;
}

export async function createShare(key: string, share: ShareObject): Promise<void> {
  const res = await fetch(`${SHARE_ENDPOINT}${key2Path(key)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(share),
  });
  if (res.status != 200) {
    throw new Error(`status=${res.status}`);
  }
  return;
}

export async function deleteShare(key: string): Promise<void> {
  const res = await fetch(`${SHARE_ENDPOINT}${key2Path(key)}`, { method: "DELETE" });
  if (res.status != 200) {
    throw new Error(`status=${res.status}`);
  }
  return;
}

export async function getShare(key: string): Promise<ShareObject> {
  const res = await fetch(`${SHARE_ENDPOINT}${key2Path(key)}?meta=1`);
  if (res.status != 200) {
    throw new Error(`status=${res.status}`);
  }
  return res.json();
}
