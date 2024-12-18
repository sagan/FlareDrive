import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, } from "@mui/material";
import { MIME_DIR, Permission, WEBDAV_ENDPOINT, basename, cleanPath, compareBoolean, compareString, key2Path, trimPrefixSuffix } from "../lib/commons";
import FileGrid, { FileItem, isDirectory } from "./FileGrid";
import MultiSelectToolbar from "./MultiSelectToolbar";
import UploadDrawer, { UploadFab } from "./UploadDrawer";
import ShareDialog from "./ShareDialog";
import { Centered } from "./components";
import { copyPaste } from "./app/transfer";
import { useTransferQueue, useUploadEnqueue } from "./app/transferQueue";


function DropZone({ children, onDrop }: { children: React.ReactNode; onDrop: (files: FileList) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflowY: "auto",
        backgroundColor: (theme) => theme.palette.background.default,
        filter: dragging ? "brightness(0.9)" : "none",
        transition: "filter 0.2s",
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.files);
        setDragging(false);
      }}
    >
      {children}
    </Box>
  );
}

function Main({
  cwd,
  setCwd,
  loading,
  search,
  permission,
  authed,
  auth,
  files,
  multiSelected,
  setMultiSelected,
  fetchFiles,
}: {
  cwd: string;
  setCwd: (cwd: string) => void;
  loading: boolean;
  search: string;
  permission: Permission;
  authed: boolean;
  auth: string | null;
  files: FileItem[];
  multiSelected: string[];
  setMultiSelected: React.Dispatch<React.SetStateAction<string[]>>;
  fetchFiles: () => void;
}) {
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [lastUploadKey, setLastUploadKey] = useState<string | null>(null);
  const [sharing, setSharing] = useState(""); // sharing file key

  const transferQueue = useTransferQueue();
  const uploadEnqueue = useUploadEnqueue();

  useEffect(() => {
    if (!transferQueue.length) {
      return;
    }
    const lastFile = transferQueue[transferQueue.length - 1];
    if (["pending", "in-progress"].includes(lastFile.status)) {
      setLastUploadKey(lastFile.remoteKey);
    } else if (lastUploadKey) {
      fetchFiles();
      setLastUploadKey(null);
    }
  }, [cwd, fetchFiles, lastUploadKey, transferQueue]);

  const filteredFiles = useMemo(
    () =>
      (search ? files.filter((file) => (file.name || file.key).toLowerCase().includes(search.toLowerCase())) : files)
        .sort((a, b) => compareBoolean(!a.system, !b.system) ||
          compareBoolean(!isDirectory(a), !isDirectory(b)) || compareString(a.key, b.key)),
    [files, search]
  );

  const handleMultiSelect = useCallback((key: string) => {
    setMultiSelected((multiSelected) => {
      if (multiSelected.length == 0) {
        return [key];
      } else if (multiSelected.includes(key)) {
        const newSelected = multiSelected.filter((k) => k !== key);
        return newSelected.length ? newSelected : [];
      }
      return [...multiSelected, key];
    });
  }, []);

  return (
    <>
      {loading ? (
        <Centered>
          <CircularProgress />
        </Centered>
      ) : (
        <DropZone
          onDrop={async (files) => {
            uploadEnqueue(...Array.from(files).map((file) => ({ file, basedir: cwd != "/" ? cwd : "" })));
          }}
        >
          <FileGrid
            authed={authed}
            auth={auth}
            files={filteredFiles}
            onCwdChange={(newCwd: string) => setCwd(newCwd)}
            multiSelected={multiSelected}
            onMultiSelect={handleMultiSelect}
            emptyMessage={<Centered>No files or folders</Centered>}
          />
        </DropZone>
      )}
      {authed && multiSelected.length == 0 && <UploadFab onClick={() => setShowUploadDrawer(true)} />}
      <UploadDrawer auth={auth} open={showUploadDrawer} setOpen={setShowUploadDrawer} cwd={cwd} onUpload={fetchFiles} />
      <MultiSelectToolbar
        readonly={!authed}
        multiSelected={multiSelected}
        getLink={(file: string) => {
          let link = location.origin + WEBDAV_ENDPOINT + key2Path(file);
          if (auth && permission == Permission.RequireAuth) {
            link += "?auth=" + encodeURIComponent(auth)
          }
          return link
        }}
        onShare={(filekey: string) => {
          const file = files.find(f => f.key === filekey)
          setSharing(filekey + (file?.httpMetadata.contentType === MIME_DIR ? "/" : ""))
        }}
        onClose={() => setMultiSelected([])}
        onRename={async () => {
          const oldName = basename(multiSelected[0]);
          const newName = window.prompt("Rename to:", oldName);
          if (!newName || oldName === newName) {
            return;
          }
          await copyPaste(cwd + oldName, cwd + newName, auth, true);
          fetchFiles();
        }}
        onMove={async () => {
          let dir = cwd ? cleanPath(cwd) : "/";
          let newdir = window.prompt(`Move files to dir (enter "/" to move to root dir):`, dir);
          if (!newdir) {
            return;
          }
          newdir = cleanPath(newdir);
          if (newdir == dir) {
            return;
          }
          if (!newdir.endsWith("/")) {
            newdir += "/"
          }
          for (const file of multiSelected) {
            const name = basename(file);
            const src = cwd + name;
            const dst = trimPrefixSuffix(newdir + name, "/");
            await copyPaste(src, dst, auth, true);
          }
          fetchFiles();
          return;
        }}
        onDelete={async () => {
          if (multiSelected.length == 0) {
            return;
          }
          const filenames = multiSelected.map((key) => key.replace(/\/$/, "").split("/").pop()).join("\n");
          const confirmMessage = "Delete the following file(s) permanently?";
          if (!window.confirm(`${confirmMessage}\n${filenames}`)) {
            return;
          }
          for (const key of multiSelected) {
            await fetch(`${WEBDAV_ENDPOINT}${key2Path(key)}`, {
              method: "DELETE",
              headers: {
                ...(auth ? { Authorization: auth } : {}),
              },
            });
          }
          fetchFiles();
        }}
      />
      {!!sharing && <ShareDialog auth={auth} filekey={sharing} open={!!sharing} onClose={() => setSharing("")} />}
    </>
  );
}

export default Main;
