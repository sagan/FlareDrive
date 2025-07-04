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
import SystemConfigAdmin from "./components/SystemConfigAdmin";
import StatisticsAdmin from "./components/StatisticsAdmin";
import packageInfo from "../package.json";
import { PublicSystemConfig } from "../lib/commons";


export default function AdminDialog({
  currentDir,
  open,
  onClose,
  setSystemConfig,
}: {
  currentDir: string;
  open: boolean;
  onClose: () => void;
  setSystemConfig: React.Dispatch<React.SetStateAction<PublicSystemConfig>>
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
        <Tab label="System Config" />
        <Tab label="Reindexer" />
        <Tab label="Statistics" />
        <Tab label="About" />
      </Tabs>
      <DialogContent sx={{ p: 1 }}>
        <Box hidden={tab !== 0} sx={{ pt: 1 }}>
          <SystemConfigAdmin setSystemConfig={setSystemConfig} />
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
