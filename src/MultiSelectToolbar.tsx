import React, { useMemo, useState } from "react";
import { IconButton, Menu, MenuItem, Slide, Toolbar } from "@mui/material";
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  MoreHoriz as MoreHorizIcon,
} from "@mui/icons-material";
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ShareIcon from '@mui/icons-material/Share';
import SearchIcon from '@mui/icons-material/Search';
import { KEY_PART_SEARCH, dirname, dirUrlPath, fileUrl } from "../lib/commons";
import { useConfig } from "./commons";


export default function MultiSelectToolbar({
  isSearch,
  multiSelected,
  writable,
  onClose,
  getLink,
  onOpenDir,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
  onSelectAll,
  onInvertSelection,
  onShare,
}: {
  isSearch: boolean;
  writable: boolean;
  multiSelected: string[];
  onClose: () => void;
  /**
   * @param key
   * @returns [link, linkIsDir]
   */
  getLink: (key: string) => [string, boolean];
  onOpenDir: (key: string) => void;
  onRename: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onInvertSelection: () => void;
  onShare: (key: string) => void;
}) {
  const { auth } = useConfig();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const [link, linkIsDir] = multiSelected.length === 1 ? getLink(multiSelected[0]) : ["", false];
  const dirLink = multiSelected.length === 1 ? fileUrl({ key: dirname(multiSelected[0]), isDir: true }) : "";
  const allLinks = useMemo(() => {
    return multiSelected.map(getLink).filter(link => !link[1]).map(link => link[0]);
  }, [getLink, multiSelected]);

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
        <span>
          <IconButton color="primary" onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <span title={`${multiSelected.length} selected`}>{multiSelected.length}</span>
        </span>
        <IconButton color="primary" disabled={multiSelected.length !== 1} title="Share & Publish" onClick={() => {
          onShare(multiSelected[0])
        }}><ShareIcon /></IconButton>
        <IconButton
          color="primary"
          href={link && !linkIsDir ? link : ""}
          disabled={allLinks.length === 0}
          onClick={(e) => {
            e.preventDefault();
            if (multiSelected.length > 1) {
              if (!confirm(`Downlod ${allLinks.length} files? (Note: dir won't be downloaded)`)) {
                return;
              }
            }
            for (const link of allLinks) {
              const a = document.createElement("a");
              a.href = link;
              a.download = (new URL(link).pathname).split("/").pop()!;
              a.click();
            }
          }}
        >
          <DownloadIcon />
        </IconButton>
        {
          isSearch ? <IconButton color="primary" disabled={multiSelected.length !== 1} href={dirLink}
            title={`Open ${linkIsDir ? "folder" : "file"} location`}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) {
                return;
              }
              e.preventDefault();
              onOpenDir(dirname(multiSelected[0]));
            }}>
            <FolderOpenIcon />
          </IconButton> : <IconButton disabled={!auth || !linkIsDir} color="primary"
            title={`Search in "${multiSelected[0]}"`}
            href={dirUrlPath(multiSelected[0] + "/" + KEY_PART_SEARCH)}
            onClick={e => {
              if (e.ctrlKey || e.metaKey) {
                return;
              }
              e.preventDefault();
              onOpenDir(multiSelected[0] + "/" + KEY_PART_SEARCH);
            }}>
            <SearchIcon />
          </IconButton>
        }
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
            {multiSelected.length === 1 && <MenuItem disabled={!writable} onClick={() => {
              setAnchorEl(null);
              onRename();
            }}>Rename</MenuItem>}
            {multiSelected.length === 1 && !linkIsDir && <MenuItem disabled={!writable} onClick={() => {
              setAnchorEl(null);
              onDuplicate();
            }}>Create Copy</MenuItem>}
            <MenuItem disabled={!writable} onClick={() => {
              setAnchorEl(null);
              onMove();
            }}>Move</MenuItem>
            <MenuItem disabled={!writable} onClick={() => {
              setAnchorEl(null);
              onDelete();
            }}>Delete</MenuItem>
            <MenuItem onClick={() => {
              setAnchorEl(null);
              onSelectAll();
            }}>Select all</MenuItem>
            <MenuItem onClick={() => {
              setAnchorEl(null);
              onInvertSelection();
            }}>Invert selection</MenuItem>
          </Menu>
        )}
      </Toolbar>
    </Slide >
  );
}
