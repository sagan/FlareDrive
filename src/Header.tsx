import { IconButton, InputBase, Menu, MenuItem, Toolbar } from "@mui/material";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MoreHoriz as MoreHorizIcon } from "@mui/icons-material";
import LoginIcon from '@mui/icons-material/Login';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Permission } from "../lib/commons";
import { ViewMode } from "./commons";

export default function Header({
  permission,
  authed,
  search,
  onSignOut,
  setViewMode,
  onSearchChange,
  onGenerateThumbnails,
  setShowProgressDialog,
  fetchFiles,
}: {
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>,
  permission: Permission;
  authed: boolean;
  search: string;
  onSignOut: () => void;
  onSearchChange: (newSearch: string) => void;
  onGenerateThumbnails: () => void;
  setShowProgressDialog: (show: boolean) => void;
  fetchFiles: () => void;
}) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [anchorEl2, setAnchorEl2] = useState<null | HTMLElement>(null);

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
        <MenuItem>Sort by</MenuItem>
        {authed && <MenuItem onClick={() => {
          setAnchorEl(null);
          onGenerateThumbnails();
        }}>Generate thumbnails</MenuItem>}
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setShowProgressDialog(true);
          }}
        >
          Progress
        </MenuItem>
      </Menu>
      <IconButton title={authed ? "Authorized" : "Unauthorized. Click to sign in"}
        onClick={(e) => {
          if (authed) {
            setAnchorEl2(e.currentTarget)
          } else if (permission === Permission.OpenDir) {
            navigate("/")
          } else {
            fetchFiles()
          }
        }}
      >
        {authed ? <PersonIcon /> : <LoginIcon />}
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

