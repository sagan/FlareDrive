import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import Box from '@mui/material/Box';
import { Button, TextField } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function SignInDialog({ open, onSignIn, onClose }: {
  open: boolean;
  onSignIn: (user: string, pass: string) => void;
  onClose?: () => void;
}) {
  const userEl = useRef<HTMLInputElement>(null)
  const passEl = useRef<HTMLInputElement>(null)

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
    <DialogTitle sx={{ display: "flex", justifyContent: "space-between" }}>
      <span>Sign in to continue</span>
      {!!onClose && <IconButton title="Close" color='secondary' onClick={onClose}><CloseIcon /></IconButton>}
    </DialogTitle>
    <DialogContent>
      <form>
        <Box sx={{ mt: 1 }}>
          <TextField autoFocus label="Username" fullWidth placeholder='username' inputRef={userEl} />
        </Box>
        <Box sx={{ mt: 1 }}>
          <TextField type='password' label="Password" fullWidth placeholder='password' inputRef={passEl} />
        </Box>
        <Box sx={{ mt: 1 }}>
          <Button type="submit" onClick={(e) => {
            e.preventDefault();
            onSignIn(userEl.current?.value || "", passEl.current?.value || "")
          }} color='primary'>Sign In</Button>
        </Box>
      </form>
    </DialogContent>
  </Dialog >;
}
