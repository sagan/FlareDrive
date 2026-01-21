import { z } from "zod";
import { HEADER_AUTHORIZATION, METHOD_GET, SEARCH_API } from "../../lib/commons";
import { FileSchema, File } from "../../lib/schema";
import { SearchOptions } from "../commons";

/**
 * @returns share project keys
 */
export async function searchFiles(auth: string, query: string, searchOptions: SearchOptions = {}): Promise<File[]> {
  const prefix = searchOptions.baseDir || "";
  const res = await fetch(
    `${SEARCH_API}?query=${encodeURIComponent(query)}&prefix=${encodeURIComponent(prefix)}&full=${
      searchOptions.full ? "1" : "0"
    }`,
    {
      method: METHOD_GET,
      headers: {
        ...(auth ? { [HEADER_AUTHORIZATION]: auth } : {}),
      },
    }
  );
  if (!res.ok) {
    throw new Error(`status=${res.status}`);
  }
  const data = await res.json();
  const files = z.array(FileSchema).parse(data);
  return files;
}
