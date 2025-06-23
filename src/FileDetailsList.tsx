import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  ListItemIcon,
} from "@mui/material";
import MimeIcon from "./MimeIcon";
import {
  basename,
  humanReadableSize,
  isDirectory,
  isUrlFile,
} from "../lib/commons";
import { ViewProps } from "./commons";

export default function FileDetailsList({
  isSearch,
  files,
  onClick,
  onContextMenu,
  multiSelected,
  emptyMessage,
}: ViewProps) {
  if (files.length === 0) {
    return emptyMessage;
  }

  return (
    <TableContainer component={Paper} sx={{ margin: 1, width: "calc(100% - 16px)" }}>
      <Table stickyHeader size="small" aria-label="file details list">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 40, padding: "6px 0px 6px 16px" }}></TableCell> {/* Icon */}
            <TableCell>Name</TableCell>
            <TableCell align="right" sx={{ minWidth: 100 }}>Size</TableCell>
            <TableCell sx={{ minWidth: 150 }}>Type</TableCell>
            <TableCell sx={{ minWidth: 180 }}>Last Modified</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {files.map((file) => {
            const IconComponent = file.icon;
            const name = file.name || basename(file.key);
            let title = ""
            if (isUrlFile(file)) {
              title = file.customMetadata?.url || ""
            }
            if (isSearch) {
              title += (title ? "\n" : "") + `Key: ${file.key}`;
            } else {
              title += (title ? "\n" : "") + name;
            }
            return (
              <TableRow
                hover
                key={file.key}
                selected={multiSelected.includes(file.key)}
                onClick={() => {
                  onClick(file);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onContextMenu(file);
                }}
                title={title}
                sx={{ cursor: "pointer", userSelect: "none", '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell sx={{ padding: "6px 0px 6px 16px" }}>
                  <ListItemIcon sx={{ minWidth: "auto" }}>
                    {IconComponent ? (
                      <IconComponent />
                    ) : (
                      <MimeIcon contentType={file.httpMetadata?.contentType} fontSize="medium" />
                    )}
                  </ListItemIcon>
                </TableCell>
                <TableCell
                  component="th"
                  scope="row"
                  sx={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: { xs: 150, sm: 200, md: 300, lg: 400 },
                  }}
                >
                  {name}{isSearch ? ` (${file.key})` : ""}
                </TableCell>
                <TableCell align="right">
                  {!isDirectory(file) ? humanReadableSize(file.size) : "—"}
                </TableCell>
                <TableCell
                  sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}
                >
                  {isDirectory(file) ? "File folder" : (file.httpMetadata?.contentType || "File")}
                </TableCell>
                <TableCell
                  sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}
                >
                  {file.system ? file.key : file.uploaded.toLocaleString()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}