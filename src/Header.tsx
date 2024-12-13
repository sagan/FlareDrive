import { IconButton, InputBase, Menu, MenuItem, Toolbar } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHoriz as MoreHorizIcon } from "@mui/icons-material";
import LoginIcon from '@mui/icons-material/Login';
import PersonIcon from '@mui/icons-material/Person';
import { Permission } from "../lib/commons";
import { LOCAL_STORAGE_KEY_AUTH } from "./commons";

function Header({
  permission,
  authed,
  search,
  onSearchChange,
  setShowProgressDialog,
  fetchFiles,
}: {
  permission: Permission;
  authed: boolean;
  search: string;
  onSearchChange: (newSearch: string) => void;
  setShowProgressDialog: (show: boolean) => void;
  fetchFiles: () => void;
}) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [anchorEl2, setAnchorEl2] = useState<null | HTMLElement>(null);

  return (
    <Toolbar disableGutters sx={{ padding: 1 }}>
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
        aria-label="More"
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
          fetchFiles();
        }}>Refresh</MenuItem>
        <MenuItem>View as</MenuItem>
        <MenuItem>Sort by</MenuItem>
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
            location.reload()
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
        <MenuItem onClick={async () => {
          setAnchorEl2(null);
          localStorage.removeItem(LOCAL_STORAGE_KEY_AUTH)
          location.href = "/api/signout"
        }}>Sign out</MenuItem>
      </Menu>
    </Toolbar>
  );
}

export default Header;
