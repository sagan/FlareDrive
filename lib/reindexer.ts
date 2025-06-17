const storageExample = {
  status: "" as "idle" | "running" | "completed" | "failed",
  pathPrefix: "" as string,
  currentR2Cursor: "" as string,
  filesProcessed: 0 as number,
  filesFailed: 0 as number,
  lastError: "" as string,
  startTime: 0 as number,
  endTime: 0 as number,
};

export type ReindexerStorage = Partial<typeof storageExample>;
export type ReindexerStorageStatus = typeof storageExample.status;
export type ReindexerStorageLastError = typeof storageExample.lastError;

export const ReindexerStorageKeys = Object.keys(storageExample);
export const REINDEXER_KEY_STATUS: keyof ReindexerStorage = "status";
export const REINDEXER_KEY_LAST_ERROR: keyof ReindexerStorage = "lastError";

export type ReindexerPayload = {
  command?: "start" | "status" | "stop" | "flush";
  /**
   * path prefix to re-index. only used in "start" & "flush" command.
   */
  path_prefix?: string;
};
