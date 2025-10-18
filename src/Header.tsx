import { IconButton, InputBase, ListItemIcon, Menu, MenuItem, Toolbar } from "@mui/material";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MoreHoriz as MoreHorizIcon } from "@mui/icons-material";
import LoginIcon from '@mui/icons-material/Login';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckIcon from '@mui/icons-material/Check';
import { Permission } from "../lib/commons";
import { SHARES_FOLDER_KEY, SearchOptions, Sort, ViewMode, search2Cwd, sortLabels, useConfig } from "./commons";

export default function Header({
  cwd,
  isSearch,
  searchOptions,
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
  setShowAdminDialog,
  fetchFiles,
  onDownloadAsZip,
  onShare,
}: {
  cwd: string;
  isSearch: boolean;
  searchOptions: SearchOptions;
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
  setShowProgressDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAdminDialog: React.Dispatch<React.SetStateAction<boolean>>;
  fetchFiles: () => void;
  onDownloadAsZip?: () => void;
  onShare?: () => void;
}) {
  const { auth, effectiveAuth, fullControl } = useConfig();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [anchorEl2, setAnchorEl2] = useState<null | HTMLElement>(null);

  const permitWrite = !!auth || (effectiveAuth ? fullControl : permission == Permission.OpenRwDir);

  return (
    <Toolbar disableGutters sx={{ padding: 1 }}>
      <Link to="/" onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          return;
        }
        e.preventDefault();
        setSearch("");
        setCwd("");
      }}>
        <IconButton title={window.__SITENAME__} sx={{ width: 24, height: 24 }}>
          <img src="/assets/favicon.png" style={{ objectFit: "contain" }} />
        </IconButton>
      </Link>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (!auth) {
            return;
          }
          setCwd(
            search2Cwd(search, search || isSearch || cwd === SHARES_FOLDER_KEY ? searchOptions : { baseDir: cwd }));
        }}
        style={{ display: 'flex', flexGrow: 1 }}
      >
        <InputBase
          size="small"
          fullWidth
          type="search"
          placeholder={searchOptions.baseDir ? `Search in "${searchOptions.baseDir}"` : `Search`}
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
          setViewMode(vm => {
            if (vm === ViewMode.Default) return ViewMode.Album;
            if (vm === ViewMode.Album) return ViewMode.Details;
            // if (vm === ViewMode.Details)
            return ViewMode.Default;
          })
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
        {!!auth && cwd !== SHARES_FOLDER_KEY && <MenuItem onClick={() => {
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
        {!!onShare && !isSearch && <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onShare();
          }}
        >
          Share & Publish dir
        </MenuItem>}
        {!!onDownloadAsZip && <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onDownloadAsZip();
          }}
        >
          Download dir
        </MenuItem>}
        {!!auth && <MenuItem onClick={() => {
          setAnchorEl(null);
          setShowAdminDialog(true);
        }}>Administration</MenuItem>}
      </Menu>
      <IconButton title={auth ? "Authorized" : "Unauthorized. Click to sign in"}
        onClick={(e) => {
          if (auth) {
            setAnchorEl2(e.currentTarget);
          } else {
            onSignnIn();
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
