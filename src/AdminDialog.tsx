import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import CloseIcon from '@mui/icons-material/Close';
import ReindexerAdmin from './components/ReindexerAdmin';
import GlobalConfigAdmin from "./components/GlobalConfigAdmin";
import StatisticsAdmin from "./components/StatisticsAdmin";
import packageInfo from "../package.json";
import { GlobalConfig, KEY_PART_SEARCH, SEARCH_MAGIC_WORD_LARGEST, SEARCH_MAGIC_WORD_RECENT } from "../lib/commons";
import { Link } from "react-router-dom";
import { search2Cwd } from "./commons";


export default function AdminDialog({
  currentDir,
  open,
  onClose,
  setCwd,
  setSearch,
  setGlobalConfig,
}: {
  currentDir: string;
  open: boolean;
  onClose: () => void;
  setCwd: (cwd: string) => void;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  setGlobalConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>
}) {
  const [tab, setTab] = useState(0);

  return (
    <Dialog open={open} onClose={onClose} fullWidth fullScreen>
      <DialogTitle component={Typography} sx={{ p: 1, pb: 0 }} className='single-line'>
        <IconButton title="Close" color='secondary'
          onClick={onClose}><CloseIcon /></IconButton>
        <span>Administration</span>
      </DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, newTab) => setTab(newTab)}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        <Tab label="Global Config" />
        <Tab label="Reindexer" />
        <Tab label="Statistics" />
        <Tab label="Files" />
        <Tab label="About" />
      </Tabs>
      <DialogContent sx={{ p: 1 }}>
        <Box hidden={tab !== 0} sx={{ pt: 1 }}>
          <GlobalConfigAdmin setGlobalConfig={setGlobalConfig} />
        </Box>
        <Box hidden={tab !== 1} sx={{ pt: 1 }}>
          <ReindexerAdmin currentDir={currentDir} />
        </Box>
        <Box hidden={tab !== 2} sx={{ pt: 1 }}>
          <StatisticsAdmin />
        </Box>
        <Box hidden={tab !== 3} sx={{ pt: 1 }}>
          <Typography variant="h5" gutterBottom>
            Manage files
          </Typography>
          <Typography >
            <ul>
              <li><Link to={"/" + KEY_PART_SEARCH + "/" + SEARCH_MAGIC_WORD_LARGEST} onClick={e => {
                e.preventDefault();
                setSearch(SEARCH_MAGIC_WORD_LARGEST);
                setCwd(search2Cwd(SEARCH_MAGIC_WORD_LARGEST));
              }}>Largest files</Link></li>
              <li><Link to={"/" + KEY_PART_SEARCH + "/" + SEARCH_MAGIC_WORD_RECENT} onClick={e => {
                e.preventDefault();
                setSearch(SEARCH_MAGIC_WORD_RECENT);
                setCwd(search2Cwd(SEARCH_MAGIC_WORD_RECENT));
              }}>Recent files</Link></li>
            </ul>
          </Typography>
        </Box>
        <Box hidden={tab !== 4} sx={{ pt: 1 }}>
          <Typography variant="h5" gutterBottom>
            About
          </Typography>
          <Typography>
            FlareDrive v{packageInfo.version} (<a href="https://github.com/sagan/FlareDrive">GitHub</a>)
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
