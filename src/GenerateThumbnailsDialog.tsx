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
import { FileItem, isImage } from './commons';
import { generateThumbnailFromUrl, generateThumbnailsServerSide, putThumbnail } from './app/transfer';


export default function GenerateThumbnailsDialog({ auth, files, open, onClose, onDone }: {
  auth: string | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  files: FileItem[];
}) {
  const [ts, setTs] = useState(0)
  const [force, setForce] = useState(false);
  const [working, setWorking] = useState(false)
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

  const onGenerateThumbnailsSS = useCallback((force: boolean) => {
    setWorking(true)
    setResult({});
    (async () => {
      let successCnt = 0
      for (const file of files) {
        if (!mountedRef.current) {
          return
        }
        if (!isImage(file)) {
          setResult(result => ({ ...result, [file.key]: `Unsupported type` }))
          continue
        }
        try {
          setResult(result => ({ ...result, [file.key]: `Generating...` }))
          const result = await generateThumbnailsServerSide([file.key], auth, force)
          if (result[file.key] === 0) {
            successCnt++
            setResult(result => ({ ...result, [file.key]: `Generated` }))
          } else {
            setResult(result => ({ ...result, [file.key]: `Result: ${result[file.key]}` }))
          }
        } catch (e) {
          setResult(result => ({ ...result, [file.key]: `${e}` }))
        }
      }
      setWorking(false);
      if (successCnt > 0) {
        setTs(+new Date)
        onDone()
      }
    })();
  }, [files, onDone])

  const onGenerateThumbnails = useCallback((force: boolean) => {
    const items = files
    setWorking(true);
    setResult({});
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
        setTs(+new Date)
        onDone()
      }
    })();
  }, [files, onDone])

  return <Dialog onClose={onClose} open={open} maxWidth="lg">
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
            ts,
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
      {working && <span>...&nbsp;</span>}
      <FormControlLabel control={<Checkbox checked={force} onChange={e => setForce(e.target.checked)} />}
        label="Force" title='Re-generate existing thumbnails' />
      <Button title="Generate thumbnails"
        disabled={working || !files.length} onClick={() => onGenerateThumbnails(force)}>
        Go
      </Button>
      <Button title="Generate thumbnails at the server side"
        disabled={working || !files.length} onClick={() => onGenerateThumbnailsSS(force)}>
        Go (SS)
      </Button>
    </DialogActions>
  </Dialog>
}
