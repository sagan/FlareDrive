import React from "react";
import {
  Grid,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import MimeIcon from "./MimeIcon";
import { fileUrl, humanReadableSize, basename } from "../lib/commons";
import { ViewProps, isDirectory, useConfig } from "./commons";


export default function FileGrid({
  auth,
  files,
  onClick,
  onContextMenu,
  multiSelected,
  emptyMessage,
}: ViewProps) {
  const { expires } = useConfig();
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
                expires,
                thumbnail: auth && file.customMetadata?.thumbnail ? file.customMetadata.thumbnail : true,
                thumbnailContentType: file.httpMetadata.contentType,
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
                  {file.system ? file.key : new Date(file.uploaded).toLocaleString()}
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
