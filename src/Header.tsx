import { IconButton, InputBase, ListItemIcon, Menu, MenuItem, Toolbar } from "@mui/material";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MoreHoriz as MoreHorizIcon } from "@mui/icons-material";
import LoginIcon from '@mui/icons-material/Login';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckIcon from '@mui/icons-material/Check';
import { joinPathes, KEY_PART_SEARCH, Permission } from "../lib/commons";
import { Sort, ViewMode, sortLabels, useConfig } from "./commons";

export default function Header({
  cwd,
  permission,
  sort,
  search,
  onSignOut,
  onSignnIn,
  setSort,
  setViewMode,
  setCwd,
  setSearch,
  onGenerateThumbnails,
  setShowProgressDialog,
  fetchFiles,
  onShare,
}: {
  cwd: string;
  permission: Permission;
  sort: Sort;
  setSort: React.Dispatch<React.SetStateAction<Sort>>;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  setCwd: (newCwd: string) => void;
  search: string;
  onSignOut: () => void;
  onSignnIn: () => void;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  onGenerateThumbnails: () => void;
  setShowProgressDialog: (show: boolean) => void;
  fetchFiles: () => void;
  onShare?: () => void;
}) {
  const { auth, effectiveAuth, fullControl } = useConfig();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [anchorEl2, setAnchorEl2] = useState<null | HTMLElement>(null);

  const permitWrite = !!auth || (effectiveAuth ? fullControl : permission == Permission.OpenRwDir)

  return (
    <Toolbar disableGutters sx={{ padding: 1 }}>
      <Link to="/" onClick={(e) => {
        e.preventDefault();
        setSearch("");
        setCwd("");
      }}>
        <IconButton title={window.__SITENAME__} sx={{ width: 24, height: 24 }}>
          <img src="/favicon.png" style={{ objectFit: "contain" }} />
        </IconButton>
      </Link>
      <form
        onSubmit={e => {
          e.preventDefault()
          if (!search || !auth) {
            return
          }
          let cwdParts = cwd.split("/")
          let index = cwdParts.indexOf(KEY_PART_SEARCH)
          if (index >= 0) {
            cwdParts = cwdParts.slice(0, index)
          }
          cwdParts.push(KEY_PART_SEARCH, encodeURIComponent(search))
          let newCwd = joinPathes(...cwdParts)
          if (newCwd === cwd) {
            return
          }
          console.log("search", search)
          setCwd(newCwd)
        }}
        style={{ display: 'flex', flexGrow: 1 }}
      >
        <InputBase
          size="small"
          fullWidth
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            backgroundColor: "whitesmoke",
            borderRadius: "999px",
            padding: "5px 16px",
          }}
        />
      </form>
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

