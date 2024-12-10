import { Home as HomeIcon } from "@mui/icons-material";
import { Box, Breadcrumbs, Button, CircularProgress, IconButton, Link, Typography } from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PublicIcon from '@mui/icons-material/Public';

import { Permission, WEBDAV_ENDPOINT, basename, cleanPath, key2Path, trimPrefixSuffix } from "../lib/commons";
import FileGrid, { encodeKey, FileItem, isDirectory } from "./FileGrid";
import MultiSelectToolbar from "./MultiSelectToolbar";
import UploadDrawer, { UploadFab } from "./UploadDrawer";
import { copyPaste } from "./app/transfer";
import { useTransferQueue, useUploadEnqueue } from "./app/transferQueue";
import { PreventDefaultEventCb } from "./commons";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
      }}
    >
      {children}
    </Box>
  );
}

function PathBreadcrumb({ permission, path, onCwdChange }: {
  permission: Permission;
  path: string;
  onCwdChange: (newCwd: string) => void
}) {
  const parts = path ? path.replace(/\/$/, "").split("/") : [];

  let cwdHref = "/" + key2Path(path)
  if (!cwdHref.endsWith("/")) {
    cwdHref += "/"
  }

  return (
    <Breadcrumbs separator="›" sx={{ padding: 1 }}>
      <Button
        onClick={() => onCwdChange("")}
        sx={{
          minWidth: 0,
          padding: 0,
        }}
      >
        <HomeIcon />
      </Button>
      {parts.map((part, index) =>
        index === parts.length - 1 ? (
          <Typography key={index} color="text.primary">
            {part}
          </Typography>
        ) : (
          <Link
            key={index}
            component="button"
            onClick={() => {
              onCwdChange(parts.slice(0, index + 1).join("/") + "/");
            }}
          >
            {part}
          </Link>
        )
      )}
      {permission !== Permission.RequireAuth && <Button sx={{
        minWidth: 0,
        padding: 0,
      }}
        title={
          permission === Permission.OpenDir
            ? "Public Dir Permalink: this dir can be publicly accessed (read)"
            : "Files inside this dir can be publicly accessed (read), but dir browsing is not available"
        }
        {...(permission === Permission.OpenDir ? {
          href: cwdHref,
          onClick: PreventDefaultEventCb,
        } : {})}>
        <PublicIcon color={permission == Permission.OpenDir ? "inherit" : "disabled"} />
      </Button>}
    </Breadcrumbs>
  );
}

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

  const transferQueue = useTransferQueue();
  const uploadEnqueue = useUploadEnqueue();

  useEffect(() => {
    document.title = cwd ? `${cwd} - ${window.__SITENAME__}` : window.__SITENAME__
  }, [cwd]);

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
      (search ? files.filter((file) => file.key.toLowerCase().includes(search.toLowerCase())) : files).sort((a, b) =>
        isDirectory(a) ? -1 : isDirectory(b) ? 1 : 0
      ),
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
      <PathBreadcrumb permission={permission} path={cwd} onCwdChange={setCwd} />
      {loading ? (
        <Centered>
          <CircularProgress />
        </Centered>
      ) : (
        <DropZone
          onDrop={async (files) => {
            uploadEnqueue(...Array.from(files).map((file) => ({ file, basedir: cwd })));
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
      <UploadDrawer open={showUploadDrawer} setOpen={setShowUploadDrawer} cwd={cwd} onUpload={fetchFiles} />
      <MultiSelectToolbar
        multiSelected={multiSelected}
        onClose={() => setMultiSelected([])}
        onDownload={() => {
          if (multiSelected.length !== 1) {
            return;
          }
          const a = document.createElement("a");
          a.href = `${WEBDAV_ENDPOINT}${encodeKey(multiSelected[0])}`;
          a.download = multiSelected[0].split("/").pop()!;
          a.click();
        }}
        onRename={async () => {
          const oldName = basename(multiSelected[0]);
          const newName = window.prompt("Rename to:", oldName);
          if (!newName || oldName === newName) {
            return;
          }
          await copyPaste(cwd + oldName, cwd + newName, true);
          fetchFiles();
        }}
        onMove={async () => {
          let dir = cwd ? cleanPath(cwd) : "/";
          let newdir = window.prompt("Move files to:", dir);
          if (!newdir) {
            return;
          }
          newdir = cleanPath(newdir);
          if (newdir == dir) {
            return;
          }
          for (const file of multiSelected) {
            const name = basename(file);
            const src = cwd + name;
            const dst = trimPrefixSuffix(newdir + "/" + name, "/");
            await copyPaste(src, dst, true);
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
            await fetch(`${WEBDAV_ENDPOINT}${encodeKey(key)}`, { method: "DELETE" });
          }
          fetchFiles();
        }}
      />
    </>
  );
}

export default Main;
