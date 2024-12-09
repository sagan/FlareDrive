import React, { useEffect, useState } from "react";
import { IconButton, Menu, MenuItem, Slide, Toolbar } from "@mui/material";
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  MoreHoriz as MoreHorizIcon,
} from "@mui/icons-material";
import LinkIcon from '@mui/icons-material/Link';
import DoneIcon from '@mui/icons-material/Done';
import { WEBDAV_ENDPOINT, key2Path } from "../lib/commons";

function MultiSelectToolbar({
  multiSelected,
  onClose,
  onDownload,
  onRename,
  onMove,
  onDelete,
}: {
  multiSelected: string[];
  onClose: () => void;
  onDownload: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [copied, setCopied] = useState("")

  useEffect(() => {
    setCopied("");
  }, [multiSelected])

  const link = multiSelected.length === 1 ? location.origin + WEBDAV_ENDPOINT + key2Path(multiSelected[0]) : "";

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
        <IconButton
          href={link}
          title={link && link == copied ? "Link Copied" : "Copy Link"}
          color="primary"
          disabled={!link}
          onClick={(e) => {
            e.preventDefault();
            navigator.clipboard.writeText(link);
            setCopied(link);
          }}
        >
          {link && link == copied ? <DoneIcon /> : <LinkIcon />}
        </IconButton>
        <IconButton
          color="primary"
          disabled={
            multiSelected.length !== 1 || multiSelected[0].endsWith("/")
          }
          onClick={onDownload}
        >
          <DownloadIcon />
        </IconButton>
        <IconButton color="primary" onClick={onDelete}>
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
            {multiSelected.length === 1 && <MenuItem onClick={onRename}>Rename</MenuItem>}
            <MenuItem onClick={onMove}>Move</MenuItem>
            <MenuItem>Share</MenuItem>
          </Menu>
        )}
      </Toolbar>
    </Slide >
  );
}

export default MultiSelectToolbar;
