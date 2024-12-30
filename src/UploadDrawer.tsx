import React, { forwardRef, useCallback, useMemo, useState } from "react";

import { Button, Card, Drawer, Fab, Grid, Typography } from "@mui/material";
import {
  Camera as CameraIcon,
  CreateNewFolder as CreateNewFolderIcon,
  Image as ImageIcon,
  Upload as UploadIcon,
} from "@mui/icons-material";
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { Permission } from "../lib/commons";
import { createFolder } from "./app/transfer";
import { useUploadEnqueue } from "./app/transferQueue";
import CloudDownloadDialog from "./CloudDownloadDialog";


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
  auth,
  open,
  permission,
  setOpen,
  cwd,
  onUpload,
}: {
  auth: string | null;
  permission: Permission;
  open: boolean;
  setOpen: (open: boolean) => void;
  cwd: string;
  onUpload: () => void;
}) {
  const uploadEnqueue = useUploadEnqueue();

  const [uploadFromUrlOpen, setUploadFromUrlOpen] = useState(false);

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
                  setOpen(false);
                  await createFolder(cwd, auth);
                  onUpload();
                }}
              />
            </Grid>
            <Grid item xs={3}>
              <IconCaptionButton
                icon={<CloudDownloadIcon fontSize="large" />}
                caption="Cloud Download"
                onClick={onUploadFromUrl}
              />
            </Grid>
          </Grid>
        </Card>
      </Drawer>
      <CloudDownloadDialog cwd={cwd} auth={auth} open={uploadFromUrlOpen} onUpload={onUpload}
        permission={permission} close={() => setUploadFromUrlOpen(false)} />
    </>
  );
}
