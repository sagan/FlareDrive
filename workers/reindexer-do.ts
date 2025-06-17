// It's a CF durable object ( https://developers.cloudflare.com/durable-objects/ ).
// In Pages deployment mode, it must be deployed to CF separately.
import {
  REINDEXER_KEY_LAST_ERROR,
  REINDEXER_KEY_STATUS,
  ReindexerStorage,
  ReindexerStorageKeys,
  ReindexerStorageLastError,
  ReindexerStorageStatus,
  type ReindexerPayload,
} from "../lib/reindexer";
import {
  Env,
  jsonResponse,
  responseBadRequest,
  responseConflict,
  responseInternalServerError,
} from "../functions/commons";
import { deleteAllDbFiles, upsertDbFile } from "../functions/db";

const BATCH_SIZE = 100; // Number of files to process per R2 list operation
const ALARM_DELAY_MS = 5000; // Delay between batches

export class ReindexerDO implements DurableObject {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.env.DB) {
      return responseInternalServerError("DB is not binded");
    }

    // Assuming commands are sent via POST body or specific paths
    if (request.method === "POST") {
      let jsonData: ReindexerPayload = {};
      try {
        jsonData = await request.json<ReindexerPayload>();
      } catch (e) {
        // Gracefully handle if no JSON body, e.g. for alarm-triggered internal fetches
      }
      const { command, path_prefix } = jsonData;

      if (command === "start") {
        const currentStatus = await this.state.storage.get<ReindexerStorageStatus>(REINDEXER_KEY_STATUS);
        if (currentStatus === "running") {
          return responseConflict("Re-indexing already in progress.");
        }

        const data: ReindexerStorage = {
          status: "running",
          pathPrefix: path_prefix || "",
          currentR2Cursor: undefined,
          filesProcessed: 0,
          filesFailed: 0,
          lastError: undefined,
          startTime: Date.now(),
          endTime: undefined,
        };
        await this.state.storage.put<any>(data);

        await this.state.storage.setAlarm(Date.now() + 100); // Start processing shortly
        return jsonResponse({ message: "Re-indexing started." });
      }

      if (command === "stop") {
        const currentStatus = await this.state.storage.get<ReindexerStorageStatus>(REINDEXER_KEY_STATUS);
        if (currentStatus !== "running") {
          return responseConflict("No re-indexing process is running.");
        }

        const data: ReindexerStorage = {
          status: "idle",
          pathPrefix: "",
          currentR2Cursor: undefined,
          filesProcessed: 0,
          filesFailed: 0,
          lastError: undefined,
          startTime: undefined,
          endTime: Date.now(),
        };
        await this.state.storage.put<any>(data);
        return jsonResponse({ message: "Re-indexing stopped." });
      }

      if (command === "flush") {
        await deleteAllDbFiles(this.env.DB, path_prefix);
        return jsonResponse({ message: `Index flushed for dir ${path_prefix}` });
      }

      if (command === "status") {
        // storage.get return Map, which is not recognized by JSON.stringify (serialized to "{}")
        const data = Object.fromEntries(
          await this.state.storage.get<any>(ReindexerStorageKeys)
        ) as unknown as ReindexerStorage;
        return jsonResponse(data);
      }
    }
    return responseBadRequest("Unknown command or method");
  }

  async alarm() {
    const data = Object.fromEntries(
      await this.state.storage.get<any>(ReindexerStorageKeys)
    ) as unknown as ReindexerStorage;
    if (data.status != "running" || !this.env.DB) {
      return;
    }
    const pathPrefix: string = data.pathPrefix || "";
    let filesProcessed: number = data.filesProcessed || 0;
    let filesFailed: number = data.filesFailed || 0;

    try {
      const listOptions: R2ListOptions = {
        prefix: pathPrefix,
        limit: BATCH_SIZE,
        cursor: data.currentR2Cursor,
        // @ts-ignore
        include: ["httpMetadata", "customMetadata"],
      };
      const listed = await this.env.BUCKET.list(listOptions);

      for (const obj of listed.objects) {
        try {
          await upsertDbFile(this.env.DB, obj);
          filesProcessed++;
        } catch (fileError: any) {
          filesFailed++;
          console.error(`Error processing file ${obj.key}: ${fileError.message}`);
          await this.state.storage.put<ReindexerStorageLastError>(
            REINDEXER_KEY_LAST_ERROR,
            `Error processing ${obj.key}: ${fileError.message}`
          );
        }
      }

      const updateData: ReindexerStorage = {
        filesProcessed,
        filesFailed,
      };

      if (listed.truncated) {
        updateData.currentR2Cursor = listed.cursor;
        await this.state.storage.put(updateData);
        await this.state.storage.setAlarm(Date.now() + ALARM_DELAY_MS);
      } else {
        updateData.status = "completed";
        updateData.currentR2Cursor = undefined;
        updateData.endTime = Date.now();
        await this.state.storage.put(updateData);
        console.log(
          `Re-indexing completed for prefix '${pathPrefix}'. Processed: ${filesProcessed}, Failed: ${filesFailed}`
        );
      }
    } catch (e: any) {
      const updateData: ReindexerStorage = {
        status: "failed",
        lastError: `${e?.message}`,
        endTime: Date.now(),
      };
      console.error(`Error during re-indexing batch for prefix '${pathPrefix}': ${e}`);
      await this.state.storage.put(updateData);
    }
  }
}
