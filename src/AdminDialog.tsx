import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import React from "react";
import CloseIcon from '@mui/icons-material/Close';
import ReindexerAdmin from './components/ReindexerAdmin';
import SystemConfigAdmin from "./components/SystemConfigAdmin";


export default function AdminDialog({
  currentDir,
  open,
  onClose,
}: {
  currentDir: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth fullScreen>
      <DialogTitle component={Typography} sx={{ p: 1, pb: 0 }} className='single-line'>
        <IconButton title="Close" color='secondary'
          onClick={onClose}><CloseIcon /></IconButton>
        <span>Administration</span>
      </DialogTitle>
      <DialogContent sx={{ p: 1 }}>
        <SystemConfigAdmin />
        <ReindexerAdmin currentDir={currentDir} />
      </DialogContent>
    </Dialog>
  );
}
