import React, { useCallback, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  FormControlLabel,
  Checkbox
} from "@mui/material";
import { fileUrl } from '../lib/commons';
import { generateThumbnailFromUrl, generateThumbnails, putThumbnail } from './app/transfer';
import { FileItem, isImage } from './FileGrid';


export default function GenerateThumbnailsDialog({ auth, files, open, onClose, onDone, onError }: {
  auth: string | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  onError: (e: any) => void;
  files: FileItem[];
}) {

  const [force, setForce] = useState(false);
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<Record<string, string>>({})
  const imageKeys = files.filter(isImage).map(f => f.key);

  const onGenerateThumbnailsServerSide = useCallback((force: boolean) => {
    setWorking(true)
    generateThumbnails(imageKeys, auth, force)
      .then(onDone)
      .catch(onError)
      .finally(() => setWorking(false))
  }, [imageKeys, onDone])

  const onGenerateThumbnails = useCallback((force: boolean) => {
    const items = files
    setWorking(true);
    setResult({});
    (async () => {
      for (const file of items) {
        if (file.customMetadata?.thumbnail && !force) {
          setResult(result => ({ ...result, [file.key]: `Thumbnail already exists` }))
          continue
        }
        try {
          setResult(result => ({ ...result, [file.key]: `Generating...` }))
          const blob = await generateThumbnailFromUrl(fileUrl({ key: file.key, auth, }), file.httpMetadata.contentType)
          await putThumbnail(file.key, blob, auth)
          setResult(result => ({ ...result, [file.key]: `Generated` }))
        } catch (e) {
          setResult(result => ({ ...result, [file.key]: `${e}` }))
        }
      }
      setWorking(false);
    })();
  }, [files, onDone])

  return <Dialog onClose={onClose} open={open}>
    <DialogTitle>Re(Generate) thumbnails of following files?</DialogTitle>
    <DialogContent>
      <List sx={{ pt: 0 }}>
        {files.map(file => {
          const thumbnailUrl = fileUrl({ key: file.key, auth, thumbnail: true })
          return <ListItem disableGutters key={file.key}>
            <ListItemIcon><img width={16} height={16} src={thumbnailUrl} /></ListItemIcon>
            <ListItemText primary={file.key} secondary={result[file.key]} />
          </ListItem>
        })}
      </List>
    </DialogContent>
    <DialogActions>
      {working && <span>...&nbsp;</span>}
      <FormControlLabel control={<Checkbox checked={force} onChange={e => setForce(e.target.checked)} />}
        label="Force" />
      <Button disabled={working || !files.length} onClick={() => onGenerateThumbnails(force)}>
        Generate
      </Button>
      <Button disabled={working || !imageKeys.length} onClick={() => onGenerateThumbnailsServerSide(force)}>
        Generate (Server Side)
      </Button>
    </DialogActions>
  </Dialog>
}
