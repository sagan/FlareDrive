import React from "react";
import {
  Box,
  Grid,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import MimeIcon from "./MimeIcon";
import { extname, humanReadableSize, KEY_PREFIX_THUMBNAIL, MIME_DIR, WEBDAV_ENDPOINT } from "../lib/commons";

export interface FileItem {
  key: string;
  size: number;
  uploaded: string;
  httpMetadata: { contentType: string };
  customMetadata?: { thumbnail?: string };
}

function extractFilename(key: string) {
  return key.split("/").pop();
}

export function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function isDirectory(file: FileItem) {
  return file.httpMetadata?.contentType === MIME_DIR;
}

function FileGrid({
  authed,
  auth,
  files,
  onCwdChange,
  multiSelected,
  onMultiSelect,
  emptyMessage,
}: {
  authed: boolean;
  auth: string | null;
  files: FileItem[];
  onCwdChange: (newCwd: string) => void;
  multiSelected: string[];
  onMultiSelect: (key: string) => void;
  emptyMessage?: React.ReactNode;
}) {
  return files.length === 0 ? (
    emptyMessage
  ) : (
    <Grid container sx={{ paddingBottom: "48px" }}>
      {files.map((file) => (
        <Grid item key={file.key} xs={12} sm={6} md={4} lg={3} xl={2}>
          <ListItemButton
            selected={multiSelected.includes(file.key)}
            onClick={() => {
              if (multiSelected.length > 0) {
                onMultiSelect(file.key);
              } else if (isDirectory(file)) {
                onCwdChange(file.key + "/");
              } else
                window.open(
                  `${WEBDAV_ENDPOINT}${encodeKey(file.key)}` + `${auth ? "?auth=" + encodeURIComponent(auth) : ""}`,
                  "_blank",
                  "noopener,noreferrer"
                );
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onMultiSelect(file.key);
            }}
            sx={{ userSelect: "none" }}
          >
            <ListItemIcon>
              {authed && file.customMetadata?.thumbnail ? (
                <img
                  src={`${WEBDAV_ENDPOINT}${KEY_PREFIX_THUMBNAIL}${file.customMetadata.thumbnail}${extname(file.key)}`
                    + `${auth ? "?auth=" + encodeURIComponent(auth) : ""}`}
                  alt={file.key}
                  style={{ width: 36, height: 36, objectFit: "cover" }}
                />
              ) : (
                <MimeIcon contentType={file.httpMetadata.contentType} />
              )}
            </ListItemIcon>
            <ListItemText
              primary={extractFilename(file.key)}
              primaryTypographyProps={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              secondary={
                <>
                  <Box
                    sx={{
                      display: "inline-block",
                      minWidth: "160px",
                      marginRight: 1,
                    }}
                  >
                    {new Date(file.uploaded).toLocaleString()}
                  </Box>
                  {!isDirectory(file) && humanReadableSize(file.size)}
                </>
              }
            />
          </ListItemButton>
        </Grid>
      ))}
    </Grid>
  );
}

export default FileGrid;
