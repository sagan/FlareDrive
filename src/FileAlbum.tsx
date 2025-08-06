import React from "react";
import Link from '@mui/material/Link';
import {
  Box,
  Grid,
} from "@mui/material";
import MimeIcon from "./MimeIcon";
import {
  THUMBNAIL_SIZE, TOKEN_VARIABLE, EXPIRES_VARIABLE, SCOPE_VARIABLE,
  basename, fileUrl, humanReadableSize, isUrlFile, str2int, validateAndGetSafeUrl, isDirectory,
} from "../lib/commons";
import { ViewProps, useConfig } from "./commons";


export default function FileAlbum({
  isSearch,
  files,
  onClick,
  onContextMenu,
  multiSelected,
  emptyMessage,
}: ViewProps) {
  const { auth, expires, authSearchParams, fullControl } = useConfig();
  if (files.length === 0) {
    return emptyMessage;
  }

  return <Grid container spacing={1} sx={{ paddingBottom: "48px" }}>
    {files.map((f) => {
      const IconComponent = f.icon;
      const thumbnailUrl = f.customMetadata?.thumbnail ? fileUrl({
        auth,
        key: f.key,
        thumbnail: auth && f.customMetadata?.thumbnail ? f.customMetadata.thumbnail : true,
        thumbnailContentType: f.httpMetadata.contentType,
        expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
        scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
        token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
        fullControl: auth ? undefined : fullControl,
      }) : "";
      const name = f.name || basename(f.key);
      let title: string;
      if (isUrlFile(f)) {
        title = validateAndGetSafeUrl(f.customMetadata?.url || "") || "";
      } else {
        title = `Size: ${humanReadableSize(f.size)}\nDate: ${f.uploaded.toUTCString()}`;
      }
      if (isSearch) {
        title += `\nKey: ${f.key}`;
      }
      const mainElement = <Box className={`file-album-item ${multiSelected.includes(f.key) ? "selected" : ""}`}
        sx={{ width: THUMBNAIL_SIZE + 4, height: THUMBNAIL_SIZE + 28 }}>
        <Box className="file-album-item-image" sx={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}>
          {thumbnailUrl
            ? <img title={title} src={thumbnailUrl} />
            : IconComponent
              ? <IconComponent sx={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }} />
              : <MimeIcon titleAccess={title} contentType={f.httpMetadata.contentType}
                sx={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }} />
          }
        </Box>
        <Box className="file-album-item-title single-line" sx={{ width: THUMBNAIL_SIZE, height: 24 }}>
          {name}
        </Box>
      </Box>;
      return <Grid item xs="auto" key={f.key}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(f);
        }}
        onClickCapture={(e) => {
          e.preventDefault();
          onClick(f, e);
        }} >
        {isDirectory(f) ? <Link color="inherit" underline="none" href={fileUrl({
          key: f.key,
          isDir: true,
          expires: auth ? undefined : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
          scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
          token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
          fullControl: auth ? undefined : fullControl,
        })} >
          {mainElement}
        </Link> : mainElement}
      </Grid>;
    })}
  </Grid>;
}
