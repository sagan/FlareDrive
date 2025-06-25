import React, { forwardRef, useCallback, useMemo, useState } from "react";

import { Button, Card, Drawer, Fab, Grid, Typography } from "@mui/material";
import {
  Camera as CameraIcon,
  CreateNewFolder as CreateNewFolderIcon,
  Image as ImageIcon,
  Upload as UploadIcon,
} from "@mui/icons-material";
import CreateIcon from '@mui/icons-material/Create';
import LinkIcon from '@mui/icons-material/Link';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import AddIcon from '@mui/icons-material/Add';
import { Permission } from "../lib/commons";
import { putFile, createFolder } from "./app/transfer";
import { useUploadEnqueue } from "./app/transferQueue";
import CloudDownloadDialog from "./CloudDownloadDialog";
import UrlFileEditorDialog from "./UrlFileEditorDialog";
import { useConfig } from "./commons";


function IconCaptionButton({
  icon,
  caption,
  onClick,
}: {
  icon: React.ReactNode;
  caption: string;
  onClick?: () => void;
}) {
  return (
    <Button
      color="inherit"
      sx={{ width: "100%", display: "flex", flexDirection: "column" }}
      onClick={onClick}
    >
      {icon}
      <Typography
        variant="caption"
        sx={{ textTransform: "none", textWrap: "nowrap" }}
      >
        {caption}
      </Typography>
    </Button>
  );
}

export const UploadFab = forwardRef<HTMLButtonElement, { onClick: () => void }>(
  function ({ onClick }, ref) {
    return (
      <Fab
        ref={ref}
        aria-label="Upload"
        variant="circular"
        color="primary"
        size="large"
        sx={{ position: "fixed", right: 16, bottom: 16, color: "white" }}
        onClick={onClick}
      >
        <UploadIcon fontSize="large" />
      </Fab>
    );
  }
);

export default function UploadDrawer({
  open,
  permission,
  setOpen,
  cwd,
  onStartUpload,
  onUpload,
  setError,
}: {
  permission: Permission;
  open: boolean;
  setOpen: (open: boolean) => void;
  cwd: string;
  onStartUpload: () => void,
  /**
   * Hook after file(s) uploaded.
   * @param created If provided, caller should open this new created file
   * @returns
   */
  onUpload: (created?: string) => void;
  setError: React.Dispatch<React.SetStateAction<any>>;
}) {
  const { auth, effectiveAuth } = useConfig()
  const uploadEnqueue = useUploadEnqueue();

  const [uploadFromUrlOpen, setUploadFromUrlOpen] = useState(false);
  const [newUrlOpen, setNewUrlOpen] = useState(false);

  const handleUpload = useCallback(
    (action: string) => () => {
      const input = document.createElement("input");
      input.type = "file";
      switch (action) {
        case "photo":
          input.accept = "image/*";
          input.capture = "environment";
          break;
        case "image":
          input.accept = "image/*,video/*";
          break;
        case "file":
          input.accept = "*/*";
          break;
      }
      input.multiple = true;
      input.onchange = async () => {
        if (!input.files) {
          return;
        }
        const files = Array.from(input.files);
        uploadEnqueue(...files.map((file) => ({ file, basedir: cwd })));
        onStartUpload();
        setOpen(false);
      };
      input.click();
    },
    [cwd, onUpload, setOpen, uploadEnqueue]
  );

  const takePhoto = useMemo(() => handleUpload("photo"), [handleUpload]);
  const uploadImage = useMemo(() => handleUpload("image"), [handleUpload]);
  const uploadFile = useMemo(() => handleUpload("file"), [handleUpload]);

  const onUploadFromUrl = useCallback(() => {
    setOpen(false);
    setUploadFromUrlOpen(true);
  }, [])

  const onNewUrl = useCallback(() => {
    setOpen(false);
    setNewUrlOpen(true);
  }, [])

  const onCreate = useCallback(async (edit?: boolean) => {
    const filename = prompt("Enter new file name: ");
    if (!filename) {
      return;
    }
    if (filename !== filename.trim() || filename.includes("/")) {
      setError(`invalid filename: cann't start or end with space or contains "/" char`);
      return;
    }
    setOpen(false);
    const key = (cwd ? cwd + "/" : "") + filename;
    try {
      await putFile({ key, auth: effectiveAuth, create: true });
      onUpload(edit ? key : undefined);
    } catch (e) {
      setError(e);
    }
  }, [effectiveAuth, cwd, onUpload])

  return (
    <>
      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { borderRadius: "16px 16px 0 0" } }}
      >
        <Card sx={{ padding: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <IconCaptionButton
                icon={<CameraIcon fontSize="large" />}
                caption="Camera"
                onClick={takePhoto}
              />
            </Grid>
            <Grid item xs={3}>
              <IconCaptionButton
                icon={<ImageIcon fontSize="large" />}
                caption="Image/Video"
                onClick={uploadImage}
              />
            </Grid>
            <Grid item xs={3}>
              <IconCaptionButton
                icon={<UploadIcon fontSize="large" />}
                caption="Upload"
                onClick={uploadFile}
              />
            </Grid>
            <Grid item xs={3}>
              <IconCaptionButton
                icon={<CreateNewFolderIcon fontSize="large" />}
                caption="Create Folder"
                onClick={async () => {
                  const folderName = prompt("New folder name");
                  if (!folderName) {
                    return;
                  }
                  if (folderName.includes("/") || folderName !== folderName.trim()) {
                    setError(`invalid folder name: cann't contain '/', or start or end with space`);
                    return;
                  }
                  setOpen(false);
                  const folderKey = (cwd ? cwd + "/" : "") + folderName;
                  try {
                    await createFolder(folderKey, effectiveAuth);
                    onUpload();
                  } catch (e) {
                    setError(e);
                  }
                }}
              />
            </Grid>
            {!!auth && <Grid item xs={3}>
              <IconCaptionButton
                icon={<CloudDownloadIcon fontSize="large" />}
                caption="Cloud Download"
                onClick={onUploadFromUrl}
              />
            </Grid>}
            <Grid item xs={3}>
              <IconCaptionButton
                icon={<AddIcon fontSize="large" />}
                caption="New file"
                onClick={() => onCreate()}
              />
            </Grid>
            <Grid item xs={3}>
              <IconCaptionButton
                icon={<CreateIcon fontSize="large" />}
                caption="Create text"
                onClick={() => onCreate(true)}
              />
            </Grid>
            <Grid item xs={3}>
              <IconCaptionButton
                icon={<LinkIcon fontSize="large" />}
                caption="New Url"
                onClick={onNewUrl}
              />
            </Grid>
          </Grid>
        </Card>
      </Drawer>
      <CloudDownloadDialog cwd={cwd} open={uploadFromUrlOpen} onUpload={onUpload}
        close={() => setUploadFromUrlOpen(false)} />
      {newUrlOpen && <UrlFileEditorDialog cwd={cwd} open={newUrlOpen} onUpload={onUpload}
        close={() => setNewUrlOpen(false)} />}
    </>
  );
}
