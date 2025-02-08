import React from "react";
import {
  Grid,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import MimeIcon from "./MimeIcon";
import {
  fileUrl, humanReadableSize, basename, str2int, EXPIRES_VARIABLE, SCOPE_VARIABLE, TOKEN_VARIABLE
} from "../lib/commons";
import { ViewProps, isDirectory, useConfig } from "./commons";


export default function FileGrid({
  auth,
  files,
  onClick,
  onContextMenu,
  multiSelected,
  emptyMessage,
}: ViewProps) {
  const { expires, authSearchParams, fullControl } = useConfig();
  if (files.length === 0) {
    return emptyMessage
  }

  return <Grid container sx={{ paddingBottom: "48px" }}>
    {files.map((file) => {
      const IconComponent = file.icon
      return <Grid item key={file.key} xs={12} sm={6} md={4} lg={3} xl={2}>
        <ListItemButton
          selected={multiSelected.includes(file.key)}
          onClick={(e) => {
            e.preventDefault();
            onClick(file)
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu(file);
          }}
          sx={{ userSelect: "none" }}
        >
          <ListItemIcon>
            {(file.customMetadata?.thumbnail ? (
              <img src={fileUrl({
                key: file.key,
                auth: auth,
                thumbnail: auth && file.customMetadata?.thumbnail ? file.customMetadata.thumbnail : true,
                thumbnailContentType: file.httpMetadata.contentType,
                expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
                scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
                token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
                fullControl: auth ? undefined : fullControl,
              })}
                alt={file.key} style={{ width: 36, height: 36, objectFit: "cover" }} />
            ) : (
              IconComponent ? <IconComponent /> : <MimeIcon contentType={file.httpMetadata.contentType} />))}
          </ListItemIcon>
          <ListItemText
            primary={file.name || basename(file.key)}
            primaryTypographyProps={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            secondary={
              <>
                <span style={{
                  display: "inline-block",
                  minWidth: "160px",
                  marginRight: 1,
                }}>
                  {file.system ? file.key : file.uploaded.toLocaleString()}
                </span>
                {!isDirectory(file) && humanReadableSize(file.size)}
              </>
            }
          />
        </ListItemButton>
      </Grid>
    })}
  </Grid>
}
