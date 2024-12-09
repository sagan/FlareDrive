import { IconButton, InputBase, Menu, MenuItem, Toolbar } from "@mui/material";
import { useState } from "react";
import { MoreHoriz as MoreHorizIcon } from "@mui/icons-material";
import LoginIcon from '@mui/icons-material/Login';
import PersonIcon from '@mui/icons-material/Person';

function Header({
  authed,
  search,
  onSearchChange,
  setShowProgressDialog,
  fetchFiles,
}: {
  authed: boolean;
  search: string;
  onSearchChange: (newSearch: string) => void;
  setShowProgressDialog: (show: boolean) => void;
  fetchFiles: () => void;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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
          padding: "8px 16px",
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
      <IconButton title={authed ? "Authorized" : "Unauthorized"}>
        {authed ? <PersonIcon /> : <LoginIcon />}
      </IconButton>
    </Toolbar>
  );
}

export default Header;
