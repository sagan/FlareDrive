import React from "react";
import {
  Grid,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import MimeIcon from "./MimeIcon";
import {
  EXPIRES_VARIABLE, SCOPE_VARIABLE, TOKEN_VARIABLE,
  fileUrl, humanReadableSize, basename, str2int, validateAndGetSafeUrl,
} from "../lib/commons";
import { isDirectory, isUrlFile } from "../lib/mime";
import { ViewProps, useConfig } from "./commons";


export default function FileGrid({
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

  return <Grid container sx={{ paddingBottom: "48px" }}>
    {files.map((file) => {
      const IconComponent = file.icon;
      let title = "";
      if (isUrlFile(file)) {
        title = validateAndGetSafeUrl(file.customMetadata?.url || "") || "";
      }
      if (isSearch) {
        title += (title ? "\n" : "") + `Key: ${file.key}`;
      }
      return <Grid item key={file.key} xs={12} sm={6} md={4} lg={3} xl={2}>
        <ListItemButton
          title={title}
          href={isDirectory(file) ? fileUrl({
            key: file.key,
            isDir: true,
            expires: auth ? undefined : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
            scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
            token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
            fullControl: auth ? undefined : fullControl,
          }) : ""}
          selected={multiSelected.includes(file.key)}
          onClick={(e) => {
            e.preventDefault();
            onClick(file, e);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu(file);
          }}
          sx={{ userSelect: "none", pl: 1, pr: 1 }}
        >
          <ListItemIcon>
            {(file.customMetadata?.thumbnail ? (
              <img src={fileUrl({
                key: file.key,
                auth,
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
            primary={`${file.name || basename(file.key)}${isSearch ? ` (${file.key})` : ""}`}
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
  </Grid>;
}
