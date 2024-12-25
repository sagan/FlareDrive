import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { generateThumbnailFromUrl, generateThumbnailsServerSide, putThumbnail } from './app/transfer';
import { FileItem, isImage } from './FileGrid';

export default function GenerateThumbnailsDialog({ auth, files, open, onClose, onDone }: {
  auth: string | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  files: FileItem[];
}) {
  const [force, setForce] = useState(false);
  const [working, setWorking] = useState(false)
  const [msg, setMsg] = useState("")
  const [result, setResult] = useState<Record<string, string>>({})
  const mountedRef = useRef(true)
  /**
   * Record key is digest, if target thumbnail image fails to load (not exists), set value to 1.
   */
  const thumbnailError = useRef<Record<string, number>>({})

  useEffect(() => {
    // required, as React 18+ call useEffect twice in development mode during component initialization.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false
    }
  }, [])

  const imageKeys = files.filter(isImage).map(f => f.key);

  const onGenerateThumbnailsServerSide = useCallback((force: boolean) => {
    setWorking(true)
    setResult({});
    setMsg("");
    generateThumbnailsServerSide(imageKeys, auth, force)
      .then(onDone)
      .catch(e => setMsg(`${e}`))
      .finally(() => setWorking(false))
  }, [imageKeys, onDone])

  const onGenerateThumbnails = useCallback((force: boolean) => {
    const items = files
    setWorking(true);
    setResult({});
    setMsg("");
    (async () => {
      let successCnt = 0
      for (const file of items) {
        if (!mountedRef.current) {
          return
        }
        if (!force && file.customMetadata?.thumbnail && !thumbnailError.current[file.customMetadata.thumbnail]) {
          setResult(result => ({ ...result, [file.key]: `Thumbnail already exists` }))
          continue
        }
        try {
          setResult(result => ({ ...result, [file.key]: `Generating...` }))
          const blob = await generateThumbnailFromUrl(fileUrl({ key: file.key, auth, }), file.httpMetadata.contentType)
          const thumbnailObj = await putThumbnail(file.key, blob, auth)
          delete thumbnailError.current[thumbnailObj.digest]
          successCnt++
          setResult(result => ({ ...result, [file.key]: `Generated` }))
        } catch (e) {
          setResult(result => ({ ...result, [file.key]: `${e}` }))
        }
      }
      setWorking(false);
      if (successCnt > 0) {
        onDone();
      }
    })();
  }, [files, onDone])

  return <Dialog onClose={onClose} open={open}>
    <DialogTitle>(Re)Generate thumbnails of following files?</DialogTitle>
    <DialogContent>
      <List sx={{ pt: 0 }}>
        {files.map(file => {
          const thumbnailUrl = fileUrl({
            key: file.key,
            auth,
            thumbnail: file.customMetadata?.thumbnail || true,
            // an "image" (Content-Type: "image/*") response won't trigger onerror event of img,
            // even if it's status is 404 or some like.
            thumbNoFallback: true,
          })
          return <ListItem disableGutters key={file.key}>
            <ListItemIcon>
              <img width={16} height={16} src={thumbnailUrl}
                onLoad={() => {
                  if (file.customMetadata?.thumbnail) {
                    delete thumbnailError.current[file.customMetadata.thumbnail]
                  }
                }}
                onError={() => {
                  // Unfortunately, there is no easy way to differentiate a 404 response with other type errors.
                  // The only way is to use fetch to manually read and display image, which is much more complex.
                  if (file.customMetadata?.thumbnail) {
                    thumbnailError.current[file.customMetadata.thumbnail] = 1
                  }
                }} />
            </ListItemIcon>
            <ListItemText primary={file.key} secondary={result[file.key]} />
          </ListItem>
        })}
      </List>
    </DialogContent>
    <DialogActions>
      <span>{msg}</span>
      {working && <span>...&nbsp;</span>}
      <FormControlLabel control={<Checkbox checked={force} onChange={e => setForce(e.target.checked)} />}
        label="Force" title='Re-generate existing thumbnails' />
      <Button title="Generate thumbnails" disabled={working || !files.length} onClick={() => onGenerateThumbnails(force)}>
        Go
      </Button>
      <Button title="Generate thumbnails at the server side"
        disabled={working || !imageKeys.length} onClick={() => onGenerateThumbnailsServerSide(force)}>
        Go (SS)
      </Button>
    </DialogActions>
  </Dialog>
}
