import { IconButton, InputBase, ListItemIcon, Menu, MenuItem, Toolbar } from "@mui/material";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MoreHoriz as MoreHorizIcon } from "@mui/icons-material";
import LoginIcon from '@mui/icons-material/Login';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckIcon from '@mui/icons-material/Check';
import { Sort, ViewMode, sortLabels, useConfig } from "./commons";

export default function Header({
  sort,
  search,
  onSignOut,
  onSignnIn,
  setSort,
  setViewMode,
  onSearchChange,
  onGenerateThumbnails,
  setShowProgressDialog,
  fetchFiles,
  onShare,
}: {
  sort: Sort;
  setSort: React.Dispatch<React.SetStateAction<Sort>>;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  search: string;
  onSignOut: () => void;
  onSignnIn: () => void;
  onSearchChange: (newSearch: string) => void;
  onGenerateThumbnails: () => void;
  setShowProgressDialog: (show: boolean) => void;
  fetchFiles: () => void;
  onShare?: () => void;
}) {
  const { auth, effectiveAuth, fullControl } = useConfig();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [anchorEl2, setAnchorEl2] = useState<null | HTMLElement>(null);

  const permitWrite = !!auth || (!!effectiveAuth && fullControl);

  return (
    <Toolbar disableGutters sx={{ padding: 1 }}>
      <Link to="/">
        <IconButton title={window.__SITENAME__} sx={{ width: 24, height: 24 }}>
          <img src="/favicon.png" style={{ objectFit: "contain" }} />
        </IconButton>
      </Link>
      <InputBase
        size="small"
        fullWidth
        type="search"
        placeholder="Search…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{
          backgroundColor: "whitesmoke",
          borderRadius: "999px",
          padding: "5px 16px",
        }}
      />
      <IconButton
        color="inherit"
        title="Refresh"
        sx={{ marginLeft: 0.5 }}
        onClick={fetchFiles}
      >
        <RefreshIcon />
      </IconButton>
      <IconButton
        title="More"
        color="inherit"
        sx={{ marginLeft: 0.5 }}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        <MoreHorizIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setAnchorEl(null);
          setViewMode(vm => vm ? ViewMode.Default : ViewMode.Album)
        }}>Toggle view</MenuItem>
        {sortLabels.map((label, index) => <MenuItem key={index} onClick={e => {
          setAnchorEl(null);
          setSort(index)
        }}>
          {label}
          {index === sort && <ListItemIcon>
            <CheckIcon />
          </ListItemIcon>}
        </MenuItem>)}
        {!!auth && <MenuItem onClick={() => {
          setAnchorEl(null);
          onGenerateThumbnails();
        }}>Generate thumbnails</MenuItem>}
        {permitWrite && <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setShowProgressDialog(true);
          }}
        >
          Uploads progress
        </MenuItem>}
        {!!auth && !!onShare && <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onShare()
          }}
        >
          Share & Publish
        </MenuItem>}
      </Menu>
      <IconButton title={auth ? "Authorized" : "Unauthorized. Click to sign in"}
        onClick={(e) => {
          if (auth) {
            setAnchorEl2(e.currentTarget)
          } else {
            onSignnIn()
          }
        }}
      >
        {auth ? <PersonIcon /> : <LoginIcon />}
      </IconButton>
      <Menu
        anchorEl={anchorEl2}
        open={Boolean(anchorEl2)}
        onClose={() => setAnchorEl2(null)}
      >
        <MenuItem onClick={() => {
          setAnchorEl2(null);
          onSignOut();
        }}>Sign out</MenuItem>
      </Menu>
    </Toolbar>
  );
}

