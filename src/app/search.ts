import { z } from "zod";
import { HEADER_AUTHORIZATION, SEARCH_API } from "../../lib/commons";
import { FileSchema, File } from "../../lib/schema";

/**
 * @returns share project keys
 */
export async function searchFiles(auth: string, query: string, prefix = ""): Promise<File[]> {
  const res = await fetch(`${SEARCH_API}?query=${encodeURIComponent(query)}&prefix=${encodeURIComponent(prefix)}`, {
    method: "GET",
    headers: {
      ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  const data = await res.json();
  const files = z.array(FileSchema).parse(data);
  return files;
}
