import React, { ReactEventHandler, useCallback, useEffect, useMemo, useReducer } from "react";
import JSZip from "jszip";
import pLimit from "p-limit";
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Typography, Box, LinearProgress
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  EXPIRES_VARIABLE,
  SCOPE_VARIABLE,
  TOKEN_VARIABLE,
  fileUrl,
  humanReadableSize,
  isDirectory,
  basename,
  str2int,
  newFileName,
} from "../lib/commons";
import { downloadFile, FileItem, useConfig } from "./commons";
import { fetchPath } from "./app/transfer";

enum Status {
  Idle,
  Downloading,
  Downloaded,
  Failed,
}

type FileProgress = {
  loaded: number;
  total: number;
}

type State = {
  status: Status;
  log: string[];
  abortController: AbortController | null;
  overallProgress: {
    added: number;
    total: number;
    size: number;
  };
  fileProgress: Record<string, FileProgress>;
};

type Action =
  | { type: "START" }
  | { type: "CANCEL" }
  | { type: "RESET"; payload: FileItem[] }
  | { type: "SUCCESS" }
  | { type: "FAIL"; payload: string }
  | { type: "ADD_LOG"; payload: string }
  | { type: "SET_TOTAL"; payload: number }
  | { type: "UPDATE_OVERALL_PROGRESS"; payload: { fileCount: number; size: number } }
  | { type: "UPDATE_FILE_PROGRESS"; payload: { fileKey: string; progress: FileProgress } };

const initialState: State = {
  status: Status.Idle,
  log: [],
  abortController: null,
  overallProgress: { added: 0, total: 0, size: 0 },
  fileProgress: {},
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START":
      return {
        ...initialState,
        status: Status.Downloading,
        log: [...state.log, "Starting download...\n"],
        abortController: new AbortController(),
      };
    case "CANCEL":
      state.abortController?.abort();
      return {
        ...state,
        status: Status.Idle,
        log: [...state.log, "Download cancelled by user.\n"],
        abortController: null,
      };
    case "RESET":
      return {
        ...initialState,
        log: action.payload.map(
          file => `${isDirectory(file) ? "📁" : "📄"} ${file.key}\n`
        )
      };
    case "SUCCESS":
      return {
        ...state,
        status: Status.Downloaded,
        log: [...state.log, "Done.\n"],
        abortController: null,
      };
    case "FAIL":
      return {
        ...state,
        status: Status.Failed,
        log: [...state.log, `Error: ${action.payload}\n`],
        abortController: null,
      };
    case "ADD_LOG":
      return { ...state, log: [...state.log, action.payload] };
    case "SET_TOTAL":
      return {
        ...state,
        overallProgress: { ...state.overallProgress, total: state.overallProgress.total + action.payload },
      };
    case "UPDATE_OVERALL_PROGRESS":
      return {
        ...state,
        overallProgress: {
          ...state.overallProgress,
          added: state.overallProgress.added + action.payload.fileCount,
          size: state.overallProgress.size + action.payload.size,
        },
      };
    case "UPDATE_FILE_PROGRESS":
      return {
        ...state,
        fileProgress: {
          ...state.fileProgress,
          [action.payload.fileKey]: action.payload.progress,
        },
      };
    default:
      throw new Error("Unknown action type");
  }
}

export default function DownloadDialog({ files, open, onClose }: {
  open: boolean;
  files: FileItem[];
  onClose: () => void;
}) {
  const { auth, effectiveAuth, authSearchParams, expires } = useConfig();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, log, abortController, overallProgress, fileProgress } = state;
  const normalFiles = useMemo(() => files.filter(f => !isDirectory(f)), [files]);

  useEffect(() => {
    dispatch({ type: "RESET", payload: files });
  }, [files, open]);


  useEffect(() => {
    if (status !== Status.Downloading || !abortController) {
      return;
    }
    const limit = pLimit(5);

    const addFileToZip = async (zip: JSZip, file: FileItem, url: string, signal: AbortSignal, asName = "") => {
      const res = await fetch(url, { signal });
      if (!res.body) {
        throw new Error("Response body is not readable.");
      }
      if (!res.ok) {
        throw new Error(`Failed to fetch ${file.key}: ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const total = Number(res.headers.get('Content-Length')) || 0;
      let loaded = 0;
      const chunks: Uint8Array[] = [];

      // Initial progress update
      dispatch({ type: "UPDATE_FILE_PROGRESS", payload: { fileKey: file.key, progress: { loaded, total } } });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total > 0) {
          dispatch({ type: "UPDATE_FILE_PROGRESS", payload: { fileKey: file.key, progress: { loaded, total } } });
        }
      }

      const blob = new Blob(chunks);
      zip.file(asName || basename(file.key), blob);
      return { fileCount: 1, size: blob.size };
    };

    const addDirectoryToZip = async (zip: JSZip, dir: FileItem, added: Set<string>, signal: AbortSignal): Promise<void> => {
      if (added.has(dir.key)) {
        return;
      }
      added.add(dir.key);
      const fetchedFiles = await limit(() => fetchPath(dir.key, effectiveAuth, signal));
      const items = fetchedFiles.items || [];
      dispatch({ type: "SET_TOTAL", payload: items.length });

      await Promise.all(items.map(async (item) => {
        if (signal.aborted) {
          return;
        }
        const itemName = basename(item.key);

        if (isDirectory(item)) {
          const dirZip = zip.folder(itemName);
          if (!dirZip) {
            throw new Error(`Failed to create directory: ${itemName}`);
          }
          dispatch({ type: "ADD_LOG", payload: `Scanning directory: ${itemName}\n` });
          await addDirectoryToZip(dirZip, item, added, signal);
        } else if (!added.has(item.key)) {
          added.add(item.key);
          dispatch({ type: "ADD_LOG", payload: `Queueing file: ${itemName}\n` });
          const progress = await limit(() => {
            const downloadUrl = fileUrl({
              auth,
              key: item.key,
              raw: true,
              expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
              scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
              token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
            });
            return addFileToZip(zip, item, downloadUrl, signal);
          });
          dispatch({ type: "UPDATE_OVERALL_PROGRESS", payload: progress });
        }
      }));
    };

    const processDownload = async () => {
      const signal = abortController.signal;
      const zip = new JSZip();
      const added = new Set<string>();
      dispatch({ type: "SET_TOTAL", payload: files.length });

      let zipFilename: string;
      if (files.length == 1) {
        zipFilename = `${basename(files[0].key)}.zip`;
      } else if (files.length == 2) {
        zipFilename = `${basename(files[0].key)} and ${basename(files[1].key)}.zip`;
      } else {
        zipFilename = `${basename(files[0].key)}, ${basename(files[1].key)} and ${files.length - 2} items.zip`;
      }

      // top level files may have duplicate names, such as in search result page.
      const topLevelFileNames = new Set<string>();
      try {
        await Promise.all(files.map(async (file) => {
          if (signal.aborted) {
            return;
          }
          let name = basename(file.key);
          while (topLevelFileNames.has(name)) {
            name = newFileName(name);
          }
          topLevelFileNames.add(name);
          if (isDirectory(file)) {
            const dirZip = zip.folder(name);
            if (!dirZip) {
              throw new Error(`Failed to create directory: ${name}`);
            }
            await addDirectoryToZip(dirZip, file, added, signal);
            dispatch({ type: "UPDATE_OVERALL_PROGRESS", payload: { fileCount: 1, size: 0 } });
          } else if (!added.has(file.key)) {
            added.add(file.key);
            // Wrap top-level file downloads in the limiter as well
            const progress = await limit(() => {
              const downloadUrl = fileUrl({
                auth,
                key: file.key,
                raw: true,
                expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
                scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
                token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
              });
              return addFileToZip(zip, file, downloadUrl, signal, name);
            });
            dispatch({ type: "UPDATE_OVERALL_PROGRESS", payload: progress });
          }
        }));

        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        dispatch({ type: "ADD_LOG", payload: "Finalizing zip file...\n" });
        const blob = await zip.generateAsync({ type: "blob" });

        downloadFile(window.URL.createObjectURL(blob), zipFilename);
        dispatch({ type: "SUCCESS" });

      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log("Download process was aborted.");
        } else {
          dispatch({ type: "FAIL", payload: (error as Error).message });
        }
      }
    };
    processDownload().then(() => { }, () => { });
  }, [status, abortController, files, auth, expires, effectiveAuth, authSearchParams]);

  const handleClose = () => {
    if (status === Status.Downloading) {
      dispatch({ type: "CANCEL" });
    }
    onClose();
  };

  const handleDownload = () => {
    if (status === Status.Downloading) {
      return;
    }
    dispatch({ type: "START" });
  };

  const directDownload: ReactEventHandler = useCallback((e) => {
    if (normalFiles.length > 3 && !confirm(`Download ${normalFiles.length} files through browser directly?`)) {
      return;
    }
    for (const file of normalFiles) {
      const link = fileUrl({
        auth,
        key: file.key,
        raw: true,
        origin: location.origin,
        expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
        scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
        token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
      });
      downloadFile(link);
      dispatch({ type: "ADD_LOG", payload: `download ${file.key}\n` });
    }
  }, [auth, authSearchParams, expires, normalFiles]);

  const statusTitles: Record<Status, string> = {
    [Status.Idle]: "Download",
    [Status.Downloading]: "Downloading",
    [Status.Downloaded]: "Downloaded",
    [Status.Failed]: "Failed",
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {statusTitles[status]} {files.length} items
        {files.length > normalFiles.length && <>&nbsp;(including {files.length - normalFiles.length} dirs)</>}
        {status === Status.Downloading && overallProgress.total > 0 &&
          ` (${overallProgress.added}/${overallProgress.total} items, ${humanReadableSize(overallProgress.size)})`
        }
        <IconButton aria-label="close" onClick={handleClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {status === Status.Downloading && (
          <Box mb={2}>
            <Typography variant="h6" gutterBottom>Download Progress</Typography>
            {files.map(file => {
              if (isDirectory(file)) {
                return null;
              }
              const progress = fileProgress[file.key];
              const progressPercent = progress && progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0;
              return (
                <Box key={file.key} sx={{ mb: 1.5 }}>
                  <Typography variant="body2" noWrap>{basename(file.key)}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: '100%', mr: 1 }}>
                      <LinearProgress variant="determinate" value={progressPercent} />
                    </Box>
                    <Box sx={{ minWidth: 70 }}>
                      <Typography variant="body2" color="text.secondary">
                        {`${Math.round(progressPercent)}%`}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
        <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '200px', overflowY: 'auto' }}>
          {log.join('')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDownload} disabled={status === Status.Downloading || files.length === 0}>
          {status === Status.Downloaded ? "Download all again (zip)" : "Download all (zip)"}
        </Button>
        <Button onClick={directDownload} disabled={status === Status.Downloading || normalFiles.length === 0}>
          Download files
        </Button>
        <Button onClick={() => dispatch({ type: "CANCEL" })} disabled={status !== Status.Downloading}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
