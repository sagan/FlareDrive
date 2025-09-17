import React, { useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Typography,
} from "@mui/material"
import CloseIcon from '@mui/icons-material/Close';
import * as docxPreview from "docx-preview";
import { EXPIRES_VARIABLE, SCOPE_VARIABLE, TOKEN_VARIABLE, fileUrl, str2int } from '../lib/commons';
import { FileViewerProps, useConfig } from './commons';

export default function DocxDialog({ filekey, open, close, setError }: FileViewerProps) {
  const { auth, authSearchParams, expires, fullControl } = useConfig()
  const fileLink = useMemo(() => fileUrl({
    key: filekey,
    auth,
    expires: auth ? expires : str2int(authSearchParams?.get(EXPIRES_VARIABLE)),
    scope: auth ? "" : authSearchParams?.get(SCOPE_VARIABLE),
    token: auth ? "" : authSearchParams?.get(TOKEN_VARIABLE),
    fullControl: auth ? undefined : fullControl,
  }), [filekey, auth, expires, authSearchParams, fullControl]);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ac = new AbortController();
    fetch(fileLink, { signal: ac.signal }).then(res => res.blob()).then(blob => {
      if (!containerRef.current) {
        return;
      }
      docxPreview.renderAsync(blob, containerRef.current).then(() => { }, setError);
    }, err => {
      if (err?.name === 'AbortError') {
        return;
      }
      setError(err);
    });
    return () => {
      ac.abort();
    }
  }, [fileLink, setError]);

  return <Dialog open={open} onClose={close} fullScreen>
    <DialogTitle component={Typography} className='single-line' sx={{ p: 1 }}>
      <IconButton title="Close" color='secondary' onClick={close}><CloseIcon /></IconButton>
      <Link href={fileLink}><span title={filekey}>{filekey}</span></Link>
    </DialogTitle>
    <DialogContent>
      {/*
      DialogTitle height: 40px + 16px (padding-top + padding-bottom ) = 56px
      DialogContent padding-bottom: 20px
      */}
      <Box sx={{ minHeight: "50vh", height: "calc(100vh - 76px)" }}>
        <div ref={containerRef}></div>
      </Box>
    </DialogContent>
  </Dialog >;
}
