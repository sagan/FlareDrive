import React from "react";
import {
  Box,
  Grid,
} from "@mui/material";
import MimeIcon from "./MimeIcon";
import { basename, fileUrl, humanReadableSize, THUMBNAIL_SIZE } from "../lib/commons";
import { ViewProps } from "./commons";


export default function FileAlbum({
  auth,
  files,
  onClick,
  onContextMenu,
  multiSelected,
  emptyMessage,
}: ViewProps) {
  if (files.length === 0) {
    return emptyMessage
  }

  return <Grid container spacing={3} sx={{ paddingBottom: "48px", ml: 1, mr: 1 }}>
    {files.map((f) => {
      const thumbnailUrl = f.customMetadata?.thumbnail ? fileUrl({
        auth,
        key: f.key,
        thumbnail: auth && f.customMetadata?.thumbnail ? f.customMetadata.thumbnail : true,
      }) : "";
      const name = f.name || basename(f.key)
      const title = `Size: ${humanReadableSize(f.size)}\nDate: ${f.uploaded}`
      return <Grid item xs="auto"
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
              ? <img title={title} src={thumbnailUrl} />
              : <MimeIcon titleAccess={title} contentType={f.httpMetadata.contentType}
                sx={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }} />
            }
          </Box>
          <Box className="file-album-item-title" sx={{ width: THUMBNAIL_SIZE, height: 24 }}>
            {name}
          </Box>
        </Box>
      </Grid>;
    })}
  </Grid>
}
