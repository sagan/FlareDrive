import React, { useState } from "react";
import { IconButton, Menu, MenuItem, Slide, Toolbar } from "@mui/material";
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  MoreHoriz as MoreHorizIcon,
} from "@mui/icons-material";
import LinkIcon from '@mui/icons-material/Link';
import { CopyButton } from "./components";

export default function MultiSelectToolbar({
  readonly,
  multiSelected,
  onClose,
  getLink,
  onRename,
  onMove,
  onDelete,
  onShare,
}: {
  readonly: boolean
  multiSelected: string[];
  onClose: () => void;
  getLink: (key: string) => string;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onShare: (key: string) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const link = multiSelected.length === 1 ? getLink(multiSelected[0]) : ""

  return (
    <Slide direction="up" in={multiSelected.length > 0}>
      <Toolbar
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: (theme) => theme.palette.background.paper,
          borderTop: "1px solid lightgray",
          justifyContent: "space-evenly",
        }}
      >
        <IconButton color="primary" onClick={onClose}>
          <CloseIcon />
        </IconButton>
        <CopyButton color="primary" href={link} isIcon={true} text={link}><LinkIcon /></CopyButton>
        <IconButton
          color="primary"
          disabled={!link || link.endsWith("/")}
          onClick={() => {
            const a = document.createElement("a");
            a.href = link;
            a.download = (new URL(link).pathname).split("/").pop()!;
            a.click();
          }}
        >
          <DownloadIcon />
        </IconButton>
        <IconButton disabled={readonly} color="primary" onClick={onDelete}>
          <DeleteIcon />
        </IconButton>
        <IconButton
          color="primary"
          disabled={multiSelected.length == 0}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <MoreHorizIcon />
        </IconButton>
        {multiSelected.length && (
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            {multiSelected.length === 1 && <MenuItem disabled={readonly} onClick={() => {
              setAnchorEl(null)
              onRename()
            }}>Rename</MenuItem>}
            <MenuItem disabled={readonly} onClick={() => {
              setAnchorEl(null)
              onMove()
            }}>Move</MenuItem>
            {multiSelected.length === 1 && <MenuItem disabled={readonly} onClick={() => {
              setAnchorEl(null)
              onShare(multiSelected[0])
            }}>Share</MenuItem>}
          </Menu>
        )}
      </Toolbar>
    </Slide >
  );
}
