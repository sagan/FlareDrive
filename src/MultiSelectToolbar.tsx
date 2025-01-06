import React, { useState } from "react";
import { IconButton, Menu, MenuItem, Slide, Toolbar } from "@mui/material";
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  MoreHoriz as MoreHorizIcon,
} from "@mui/icons-material";
import ShareIcon from '@mui/icons-material/Share';
import LinkIcon from '@mui/icons-material/Link';
import { CopyButton } from "./components";
import { useConfig } from "./commons";

export default function MultiSelectToolbar({
  multiSelected,
  onClose,
  getLink,
  onRename,
  onMove,
  onDelete,
  onShare,
}: {
  multiSelected: string[];
  onClose: () => void;
  /**
   * @param key
   * @returns [link, linkIsDir]
   */
  getLink: (key: string) => [string, boolean];
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onShare: (key: string) => void;
}) {
  const { auth } = useConfig();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const [link, linkIsDir] = multiSelected.length === 1 ? getLink(multiSelected[0]) : ["", false]

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
        {auth
          ? <IconButton color="primary" disabled={multiSelected.length !== 1} title="Share & Publish" onClick={() => {
            onShare(multiSelected[0])
          }}><ShareIcon /></IconButton>
          : <CopyButton color="primary" href={link} isIcon={true} text={link}><LinkIcon /></CopyButton>
        }
        <IconButton
          color="primary"
          disabled={!link || linkIsDir}
          onClick={() => {
            const a = document.createElement("a");
            a.href = link;
            a.download = (new URL(link).pathname).split("/").pop()!;
            a.click();
          }}
        >
          <DownloadIcon />
        </IconButton>
        <IconButton disabled={!auth} color="primary" onClick={onDelete}>
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
            {multiSelected.length === 1 && <MenuItem disabled={!auth} onClick={() => {
              setAnchorEl(null)
              onRename()
            }}>Rename</MenuItem>}
            <MenuItem disabled={!auth} onClick={() => {
              setAnchorEl(null)
              onMove()
            }}>Move</MenuItem>
          </Menu>
        )}
      </Toolbar>
    </Slide >
  );
}
