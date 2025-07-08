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
import { GlobalConfig } from "../lib/commons";


export default function AdminDialog({
  currentDir,
  open,
  onClose,
  setGlobalConfig,
}: {
  currentDir: string;
  open: boolean;
  onClose: () => void;
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
