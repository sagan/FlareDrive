import React from "react";
import {
  Box,
  Grid,
} from "@mui/material";
import MimeIcon from "./MimeIcon";
import { basename, EXPIRES_VARIABLE, fileUrl, humanReadableSize, SCOPE_VARIABLE, str2int, THUMBNAIL_SIZE, TOKEN_VARIABLE } from "../lib/commons";
import { ViewProps, useConfig } from "./commons";


export default function FileAlbum({
  auth,
  files,
  onClick,
  onContextMenu,
  multiSelected,
  emptyMessage,
}: ViewProps) {
  const { expires, authSearchParams } = useConfig();

  if (files.length === 0) {
    return emptyMessage
  }

  return <Grid container spacing={1} sx={{ paddingBottom: "48px" }}>
    {files.map((f) => {
      const thumbnailUrl = f.customMetadata?.thumbnail ? fileUrl({
        auth,
        key: f.key,
        thumbnail: auth && f.customMetadata?.thumbnail ? f.customMetadata.thumbnail : true,
        thumbnailContentType: f.httpMetadata.contentType,
        expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
        scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
        token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
      }) : "";
      const name = f.name || basename(f.key)
      const title = `Size: ${humanReadableSize(f.size)}\nDate: ${f.uploaded}`
      return <Grid item xs="auto" key={f.key}
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu(f);
        }}
        onClick={(e) => {
          e.preventDefault();
          onClick(f);
        }} >
        <Box className={`file-album-item ${multiSelected.includes(f.key) ? "selected" : ""}`}
          sx={{ width: THUMBNAIL_SIZE + 4, height: THUMBNAIL_SIZE + 28 }}>
          <Box className="file-album-item-image" sx={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}>
            {thumbnailUrl
              ?
              <img title={title} src={thumbnailUrl} />
              : <MimeIcon titleAccess={title} contentType={f.httpMetadata.contentType}
                sx={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }} />
            }
          </Box>
          <Box className="file-album-item-title single-line" sx={{ width: THUMBNAIL_SIZE, height: 24 }}>
            {name}
          </Box>
        </Box>
      </Grid>;
    })}
  </Grid>
}
