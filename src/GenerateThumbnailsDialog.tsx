import React, { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Button
} from "@mui/material";
import { generateThumbnails } from './app/transfer';

export default function GenerateThumbnailsDialog({ auth, keys, open, onClose, onDone, onError }: {
  auth: string | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  onError: (e: any) => void;
  keys: string[];
}) {
  const onGenerateThumbnails = useCallback((force: boolean) => {
    onClose();
    generateThumbnails(keys, auth, force)
      .then(onDone)
      .catch(onError)
  }, [keys, onDone])

  return <Dialog onClose={onClose} open={open}>
    <DialogTitle>Re(Generate) thumbnails of following files?</DialogTitle>
    <DialogContent>
      <pre>
        {keys.join("\n")}
      </pre>
    </DialogContent>
    <DialogActions>
      <Button onClick={() => onGenerateThumbnails(false)}>Generate</Button>
      <Button onClick={() => onGenerateThumbnails(true)}>Generate (force)</Button>
    </DialogActions>
  </Dialog>
}
